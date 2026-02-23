import io
import re
import json
import uuid
from datetime import datetime
import pandas as pd
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import CampaignSpend, UploadBatch

router = APIRouter(prefix="/api/spend", tags=["spend"])

REQUIRED_COLUMNS = ["date", "source", "spend"]

SYNONYMS = {
    "date": {"data", "giorno", "periodo", "day", "date", "time"},
    "source": {"fonte", "sorgente", "channel", "canale", "piattaforma", "platform", "source"},
    "spend": {"spesa", "cost", "costo", "importo", "spend", "amount"},
    "campaign": {"campagna", "campaign", "nome_campagna", "campaign_name"}
}

def clean_col_name(c: str) -> str:
    # remove spaces, dash, underscore, and lower
    return re.sub(r'[\s\-_]', '', str(c)).lower()

def guess_column(target: str, columns: list[str]) -> str | None:
    syns = {clean_col_name(s) for s in SYNONYMS.get(target, {target})}
    for c in columns:
        cleaned = clean_col_name(c)
        if cleaned in syns:
            return c
    return None

def _norm_source(s) -> str:
    return str(s).strip().upper() if s and str(s).strip() else "UNKNOWN"

def _to_py_datetime(value):
    if pd.isna(value): return None
    if hasattr(value, "to_pydatetime"): return value.to_pydatetime()
    if isinstance(value, datetime): return value
    try:
        parsed = pd.to_datetime(value, errors="coerce")
    except Exception: return None
    if pd.isna(parsed): return None
    return parsed.to_pydatetime() if hasattr(parsed, "to_pydatetime") else parsed

@router.post("/upload")
async def upload_spend_csv(
    file: UploadFile = File(...), 
    mapping: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    # Convert mapping JSON
    user_mapping = {}
    if mapping:
        try:
            user_mapping = json.loads(mapping)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid mapping JSON.")

    contents = await file.read()
    try:
        # Use simple string replacement for decimal formats if it's European format (using comma)
        # However, pandas read_csv handles standard EN decimal easily.
        # We'll use decimal=',' if it looks like there are commas in numeric values.
        # For simplicity, we can load it normally and parse floats later.
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    columns = list(df.columns)
    
    # 1. Determine the mapping
    final_mapping = {}
    if user_mapping:
        final_mapping = user_mapping
    else:
        for req in REQUIRED_COLUMNS + ["campaign"]:
            guessed = guess_column(req, columns)
            if guessed:
                final_mapping[req] = guessed

    # Check if all required columns are resolved
    missing_required = [req for req in REQUIRED_COLUMNS if req not in final_mapping]
    
    # Check if confidence is low (any missing mapping, or user needs to confirm)
    if not user_mapping and missing_required:
        return {
            "status": "needs_mapping",
            "columns": columns,
            "suggested_mapping": final_mapping,
            "missing": missing_required
        }

    if missing_required:
        raise HTTPException(status_code=400, detail=f"Missing required mappings for: {missing_required}")

    # Validate mapping keys exist in CSV
    for k, v in final_mapping.items():
        if v not in df.columns:
            raise HTTPException(status_code=400, detail=f"Mapped column '{v}' not found in CSV.")

    # Parse and validate rows
    mapped_df = pd.DataFrame()
    
    # Data parsing
    # Handle possible numeric formats with comma
    def _parse_numeric(val):
        if pd.isna(val) or val == "":
            return 0.0
        if isinstance(val, str):
            val = val.replace("€", "").replace("$", "").strip()
            # If standard European format like 1.250,50
            if "," in val and "." in val:
                val = val.replace(".", "").replace(",", ".")
            elif "," in val and "." not in val:
                val = val.replace(",", ".")
        try:
            return float(val)
        except Exception:
            return 0.0

    date_col = final_mapping["date"]
    mapped_df["date"] = pd.to_datetime(df[date_col], errors="coerce")
    
    # Track rejects
    initial_rows = len(df)
    valid_df = mapped_df[mapped_df["date"].notna()].copy()
    skipped = initial_rows - len(valid_df)
    
    reject_reasons = {}
    if skipped > 0:
        reject_reasons["invalid_date"] = skipped
        
    valid_df["spend"] = df.iloc[valid_df.index][final_mapping["spend"]].apply(_parse_numeric)
    valid_df["source_normalized"] = df.iloc[valid_df.index][final_mapping["source"]].apply(_norm_source)
    
    if "campaign" in final_mapping:
        valid_df["campaign"] = df.iloc[valid_df.index][final_mapping["campaign"]].fillna("")
    else:
        valid_df["campaign"] = ""

    # Check for empty sources
    empty_sources = valid_df["source_normalized"] == "UNKNOWN"
    if empty_sources.sum() > 0:
        reject_reasons["missing_source"] = empty_sources.sum()
        skipped += empty_sources.sum()
        valid_df = valid_df[~empty_sources]

    # Create upload batch
    batch_id = str(uuid.uuid4())
    batch = UploadBatch(
        upload_id=batch_id,
        dataset="spend",
        filename=file.filename,
        uploaded_at=datetime.utcnow(),
        user="system", # Authentication not implemented yet
        mapping_used=json.dumps(final_mapping),
        reject_reasons=json.dumps(reject_reasons) if reject_reasons else None,
        rows_new=len(valid_df),
        rows_skipped=skipped,
        rows_updated=0,
    )
    db.add(batch)
    db.flush()

    records = [
        CampaignSpend(
            upload_id=batch_id,
            date=_to_py_datetime(row["date"]),
            source_normalized=row["source_normalized"],
            campaign=str(row["campaign"]),
            spend=float(row["spend"]),
            entry_type="csv"
        )
        for _, row in valid_df.iterrows()
    ]
    db.add_all(records)
    db.commit()

    return {
        "status":    "success",
        "upload_id": batch_id,
        "rows_inserted": len(records),
        "rows_skipped":  skipped,
        "filename":  file.filename,
    }


@router.get("/status")
def spend_status(db: Session = Depends(get_db)):
    count = db.query(CampaignSpend).count()
    return {"spend_records_in_db": count, "ready": count > 0}

@router.get("/template")
def spend_template(year: int = Query(None), month: int = Query(None), db: Session = Depends(get_db)):
    """
    Returns a CSV template for importing spend.
    Sources are pre-populated based on leads data.
    """
    rows_leads = db.execute(text("SELECT DISTINCT source FROM lead_records WHERE source IS NOT NULL AND source != ''")).fetchall()
    sources = [r[0] for r in rows_leads if r[0]]
    if not sources:
        sources = ["GOOGLE", "META", "TIKTOK"]

    import csv
    import io
    from datetime import date
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers exactly matching synonyms mapping
    writer.writerow(["Date", "Source", "Spend", "Campaign"])
    
    # Prepopulate rows with the selected month
    if year and month:
        try:
            dummy_date = date(year, month, 1).strftime("%Y-%m-%d")
        except:
            dummy_date = date.today().strftime("%Y-%m-%d")
    else:
        dummy_date = date.today().strftime("%Y-%m-%d")
    
    for src in sources:
        writer.writerow([dummy_date, src, "0.00", ""])
        
    y_str = str(year) if year else "ANY"
    m_str = str(month).zfill(2) if month else "ANY"
    filename = f"spend_import_{y_str}_{m_str}.csv"
        
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})
