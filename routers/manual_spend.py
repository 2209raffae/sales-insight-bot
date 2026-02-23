"""
Manual Spend router — CRUD for manually entered actual spend entries.
Also provides GET /api/leads/sources for populating source dropdowns.

POST   /api/spend/manual
GET    /api/spend/manual
PUT    /api/spend/manual/{id}
DELETE /api/spend/manual/{id}
GET    /api/leads/sources
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from database import get_db
from models import ActualSpend

router = APIRouter(tags=["spend"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ActualSpendCreate(BaseModel):
    source:       str
    period_type:  str
    period_value: str
    amount:       float
    note:         Optional[str] = None


class ActualSpendUpdate(BaseModel):
    source:       Optional[str] = None
    period_type:  Optional[str] = None
    period_value: Optional[str] = None
    amount:       Optional[float] = None
    note:         Optional[str] = None


class ActualSpendResponse(BaseModel):
    id:           int
    source:       str
    period_type:  str
    period_value: str
    amount:       float
    note:         Optional[str]
    created_at:   datetime

    class Config:
        from_attributes = True


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/api/spend/manual", response_model=ActualSpendResponse)
def create_manual_spend(body: ActualSpendCreate, db: Session = Depends(get_db)):
    row = ActualSpend(
        source=body.source.strip().upper(),
        period_type=body.period_type,
        period_value=body.period_value,
        amount=body.amount,
        note=body.note,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="An entry for this source and period already exists.")
    db.refresh(row)
    return row


@router.get("/api/spend/manual", response_model=list[ActualSpendResponse])
def list_manual_spend(
    source: Optional[str] = Query(None),
    period_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ActualSpend)
    if source:
        q = q.filter(ActualSpend.source == source.strip().upper())
    if period_type:
        q = q.filter(ActualSpend.period_type == period_type)
    return q.order_by(ActualSpend.created_at.desc()).all()


@router.put("/api/spend/manual/{entry_id}", response_model=ActualSpendResponse)
def update_manual_spend(entry_id: int, body: ActualSpendUpdate, db: Session = Depends(get_db)):
    row = db.query(ActualSpend).filter(ActualSpend.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Manual spend entry not found")
    
    if body.source is not None:
        row.source = body.source.strip().upper()
    if body.period_type is not None:
        row.period_type = body.period_type
    if body.period_value is not None:
        row.period_value = body.period_value
    if body.amount is not None:
        row.amount = body.amount
    if body.note is not None:
        row.note = body.note

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Update causes a duplicate entry for source and period.")
    db.refresh(row)
    return row


@router.delete("/api/spend/manual/{entry_id}")
def delete_manual_spend(entry_id: int, db: Session = Depends(get_db)):
    row = db.query(ActualSpend).filter(ActualSpend.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Manual spend entry not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": entry_id}


# ── Sources endpoint (for dropdowns) ─────────────────────────────────────────

@router.get("/api/leads/sources")
def get_lead_sources(db: Session = Depends(get_db)):
    """Return distinct, normalized source values from lead_records and campaign_spends."""
    rows_leads = db.execute(text(
        "SELECT DISTINCT source FROM lead_records WHERE source IS NOT NULL AND source != ''"
    )).fetchall()
    leads_sources = {r[0] for r in rows_leads if r[0]}
    
    try:
        rows_spends = db.execute(text(
            "SELECT DISTINCT source_normalized FROM campaign_spends WHERE source_normalized IS NOT NULL AND source_normalized != ''"
        )).fetchall()
        spends_sources = {r[0] for r in rows_spends if r[0]}
    except Exception:
        spends_sources = set()

    sources = sorted(list(leads_sources | spends_sources))
    return {"sources": sources}
