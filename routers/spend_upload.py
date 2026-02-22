"""
Campaign Spend upload router — CSV import with batch tracking.
Required columns: date, source, spend
Optional columns: campaign
Source values are normalized (strip + uppercase) to match leads.source.
"""
import io
import uuid
from datetime import datetime
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CampaignSpend, UploadBatch

router = APIRouter(prefix="/api/spend", tags=["spend"])

REQUIRED_COLUMNS = {"date", "source", "spend"}


def _norm_source(s) -> str:
    return str(s).strip().upper() if s and str(s).strip() else "UNKNOWN"


def _to_py_datetime(value):
    if pd.isna(value):
        return None
    if hasattr(value, "to_pydatetime"):
        return value.to_pydatetime()
    if isinstance(value, datetime):
        return value
    try:
        parsed = pd.to_datetime(value, errors="coerce")
    except Exception:
        return None
    if pd.isna(parsed):
        return None
    return parsed.to_pydatetime() if hasattr(parsed, "to_pydatetime") else parsed


@router.post("/upload")
async def upload_spend_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {missing}. Found: {list(df.columns)}"
        )

    # Parse and validate
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df["spend"] = pd.to_numeric(df["spend"], errors="coerce").fillna(0.0)
    df["source_normalized"] = df["source"].apply(_norm_source)
    df["campaign"] = df["campaign"].fillna("") if "campaign" in df.columns else ""

    # Create upload batch
    batch_id = str(uuid.uuid4())
    batch = UploadBatch(
        upload_id=batch_id,
        dataset="spend",
        filename=file.filename,
        uploaded_at=datetime.utcnow(),
        rows_new=len(df),
        rows_skipped=0,
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
        )
        for _, row in df.iterrows()
    ]
    db.add_all(records)
    db.commit()

    return {
        "status":    "success",
        "upload_id": batch_id,
        "rows_new":  len(records),
        "filename":  file.filename,
    }


@router.get("/status")
def spend_status(db: Session = Depends(get_db)):
    count = db.query(CampaignSpend).count()
    return {"spend_records_in_db": count, "ready": count > 0}
