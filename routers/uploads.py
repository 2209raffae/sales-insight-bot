"""
Upload history router — list and delete upload batches.
DELETE is scoped: only removes rows from the specific batch.
Other batches' data is never touched.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import UploadBatch, LeadRecord, CampaignSpend

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.get("")
def list_uploads(
    dataset: str | None = Query(None, description="Filter by dataset: leads | spend"),
    db: Session = Depends(get_db),
):
    q = db.query(UploadBatch)
    if dataset:
        q = q.filter(UploadBatch.dataset == dataset)
    batches = q.order_by(UploadBatch.uploaded_at.desc()).all()
    return [
        {
            "upload_id":    b.upload_id,
            "dataset":      b.dataset,
            "filename":     b.filename,
            "uploaded_at":  b.uploaded_at.isoformat() if b.uploaded_at else None,
            "rows_new":     b.rows_new,
            "rows_skipped": b.rows_skipped,
            "rows_updated": b.rows_updated,
        }
        for b in batches
    ]


@router.delete("/{upload_id}", status_code=200)
def delete_upload(upload_id: str, db: Session = Depends(get_db)):
    batch = db.query(UploadBatch).filter(UploadBatch.upload_id == upload_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Upload batch not found.")

    dataset = batch.dataset

    # Delete rows scoped to this batch only
    if dataset == "leads":
        deleted = db.query(LeadRecord).filter(LeadRecord.upload_id == upload_id).delete()
    elif dataset == "spend":
        deleted = db.query(CampaignSpend).filter(CampaignSpend.upload_id == upload_id).delete()
    else:
        deleted = 0

    db.delete(batch)
    db.commit()

    return {
        "status":     "deleted",
        "upload_id":  upload_id,
        "dataset":    dataset,
        "rows_deleted": deleted,
    }
