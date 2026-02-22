"""
Leads upload router — upsert logic with upload batch tracking.
Rules:
  lead_id match  → UPDATE existing row (rows_updated)
  doc_no  match  → SKIP (rows_skipped)
  new lead       → INSERT (rows_new)
All rows tagged with the new upload_id.
Source values are normalized (strip + uppercase).
"""
import io
import uuid
from datetime import datetime
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import LeadRecord, UploadBatch

router = APIRouter(prefix="/api/leads", tags=["leads"])

REQUIRED_COLUMNS = {"lead_id", "status"}

ALL_COLUMNS = {
    "lead_id", "topic", "doc_no", "opened_at", "updated_at", "closed_at",
    "age_days", "operator", "subject", "requester", "assignee",
    "source", "status",
}


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
async def upload_leads_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {missing}. Found: {list(df.columns)}"
        )

    # Parse datetime columns
    for dt_col in ["opened_at", "updated_at"]:
        col_data = df[dt_col] if dt_col in df.columns else pd.Series(dtype="object")
        df[dt_col] = pd.to_datetime(col_data, errors="coerce")

    df["age_days"] = pd.to_numeric(
        df["age_days"] if "age_days" in df.columns else pd.Series(dtype=float),
        errors="coerce"
    ).fillna(0.0)

    # Parse closed_at
    closed_col = df["closed_at"] if "closed_at" in df.columns else pd.Series(dtype="object")
    df["closed_at"] = pd.to_datetime(closed_col, errors="coerce")

    # Fill missing optional cols
    for col in ALL_COLUMNS - set(df.columns):
        df[col] = ""

    # Normalize source
    df["source"] = df["source"].apply(_norm_source)
    df["status"] = df["status"].fillna("").str.strip()

    # Create upload batch
    batch_id = str(uuid.uuid4())
    batch = UploadBatch(
        upload_id=batch_id,
        dataset="leads",
        filename=file.filename,
        uploaded_at=datetime.utcnow(),
        rows_new=0,
        rows_skipped=0,
        rows_updated=0,
    )
    db.add(batch)
    db.flush()  # ensure batch_id is in DB before FK references

    # Load existing keys for dedup
    existing_by_lead_id: dict[str, int] = {
        r[0]: r[1]
        for r in db.execute(text("SELECT lead_id, id FROM lead_records")).fetchall()
    }
    existing_doc_nos: set[str] = {
        r[0] for r in db.execute(text(
            "SELECT doc_no FROM lead_records WHERE doc_no IS NOT NULL AND doc_no != ''"
        )).fetchall()
    }

    rows_new = rows_skipped = rows_updated = 0

    for _, row in df.iterrows():
        lead_id = str(row["lead_id"]).strip()
        doc_no  = str(row.get("doc_no", "")).strip()

        opened_at = _to_py_datetime(row["opened_at"])
        updated_at = _to_py_datetime(row["updated_at"])
        closed_at = _to_py_datetime(row["closed_at"])

        kwargs = dict(
            topic      = str(row.get("topic", "")),
            doc_no     = doc_no or None,
            opened_at  = opened_at,
            updated_at = updated_at,
            closed_at  = closed_at,
            age_days   = float(row["age_days"]),
            operator   = str(row.get("operator", "")),
            subject    = str(row.get("subject", "")),
            requester  = str(row.get("requester", "")),
            assignee   = str(row.get("assignee", "")),
            source     = str(row["source"]),
            status     = str(row["status"]),
            upload_id  = batch_id,
        )

        if lead_id in existing_by_lead_id:
            # UPDATE existing lead
            rec_id = existing_by_lead_id[lead_id]
            db.execute(
                text("""
                    UPDATE lead_records SET
                      topic=:topic, doc_no=:doc_no, opened_at=:opened_at,
                      updated_at=:updated_at, closed_at=:closed_at,
                      age_days=:age_days, operator=:operator,
                      subject=:subject, requester=:requester, assignee=:assignee,
                      source=:source, status=:status, upload_id=:upload_id
                    WHERE id=:id
                """),
                {**kwargs, "id": rec_id}
            )
            rows_updated += 1
        elif doc_no and doc_no in existing_doc_nos:
            # SKIP — duplicate by doc_no
            rows_skipped += 1
        else:
            # INSERT new
            db.add(LeadRecord(lead_id=lead_id, **kwargs))
            existing_by_lead_id[lead_id] = -1  # prevent double-insert within same file
            if doc_no:
                existing_doc_nos.add(doc_no)
            rows_new += 1

    batch.rows_new     = rows_new
    batch.rows_skipped = rows_skipped
    batch.rows_updated = rows_updated
    db.commit()

    return {
        "status":       "success",
        "upload_id":    batch_id,
        "rows_new":     rows_new,
        "rows_skipped": rows_skipped,
        "rows_updated": rows_updated,
        "filename":     file.filename,
    }


@router.get("/status")
def leads_data_status(db: Session = Depends(get_db)):
    count = db.query(LeadRecord).count()
    return {"lead_records_in_db": count, "ready": count > 0}
