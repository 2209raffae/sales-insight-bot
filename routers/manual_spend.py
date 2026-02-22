"""
Manual Spend router — CRUD for manually entered actual spend entries.
Also provides GET /api/leads/sources for populating source dropdowns.

POST   /api/spend/manual
GET    /api/spend/manual
PUT    /api/spend/manual/{id}
DELETE /api/spend/manual/{id}
GET    /api/leads/sources
"""
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import CampaignSpend

router = APIRouter(tags=["spend"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ManualSpendCreate(BaseModel):
    date:     date
    source:   str
    campaign: Optional[str] = None
    spend:    float
    note:     Optional[str] = None


class ManualSpendUpdate(BaseModel):
    date:     Optional[date]  = None
    source:   Optional[str]   = None
    campaign: Optional[str]   = None
    spend:    Optional[float] = None
    note:     Optional[str]   = None


class ManualSpendResponse(BaseModel):
    id:                int
    date:              datetime
    source_normalized: str
    campaign:          Optional[str]
    spend:             float
    entry_type:        str
    note:              Optional[str]
    upload_id:         Optional[str]

    class Config:
        orm_mode = True


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/api/spend/manual", response_model=ManualSpendResponse)
def create_manual_spend(body: ManualSpendCreate, db: Session = Depends(get_db)):
    row = CampaignSpend(
        date=datetime.combine(body.date, datetime.min.time()),
        source_normalized=body.source.strip().upper(),
        campaign=body.campaign or "",
        spend=body.spend,
        entry_type="manual",
        note=body.note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/api/spend/manual", response_model=list[ManualSpendResponse])
def list_manual_spend(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    source: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(CampaignSpend).filter(CampaignSpend.entry_type == "manual")
    if from_date:
        q = q.filter(CampaignSpend.date >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        q = q.filter(CampaignSpend.date <= datetime.combine(to_date, datetime.max.time()))
    if source:
        q = q.filter(CampaignSpend.source_normalized == source.strip().upper())
    return q.order_by(CampaignSpend.date.desc()).all()


@router.put("/api/spend/manual/{entry_id}", response_model=ManualSpendResponse)
def update_manual_spend(entry_id: int, body: ManualSpendUpdate, db: Session = Depends(get_db)):
    row = db.query(CampaignSpend).filter(
        CampaignSpend.id == entry_id,
        CampaignSpend.entry_type == "manual",
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Manual spend entry not found")
    if body.date is not None:
        row.date = datetime.combine(body.date, datetime.min.time())
    if body.source is not None:
        row.source_normalized = body.source.strip().upper()
    if body.campaign is not None:
        row.campaign = body.campaign
    if body.spend is not None:
        row.spend = body.spend
    if body.note is not None:
        row.note = body.note
    db.commit()
    db.refresh(row)
    return row


@router.delete("/api/spend/manual/{entry_id}")
def delete_manual_spend(entry_id: int, db: Session = Depends(get_db)):
    row = db.query(CampaignSpend).filter(
        CampaignSpend.id == entry_id,
        CampaignSpend.entry_type == "manual",
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Manual spend entry not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": entry_id}


# ── Sources endpoint (for dropdowns) ─────────────────────────────────────────

@router.get("/api/leads/sources")
def get_lead_sources(db: Session = Depends(get_db)):
    """Return distinct, normalized source values from lead_records."""
    rows = db.execute(text(
        "SELECT DISTINCT source FROM lead_records WHERE source IS NOT NULL AND source != '' ORDER BY source"
    )).fetchall()
    sources = [r[0] for r in rows if r[0]]
    return {"sources": sources}
