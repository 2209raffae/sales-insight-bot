"""
Budgets router - CRUD for CampaignMonthlyBudget.
POST /api/budgets
GET  /api/budgets?year=&month=&source=
PUT  /api/budgets/{id}
DELETE /api/budgets/{id}
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import CampaignMonthlyBudget
import budget_kpi_engine as bke

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


class BudgetCreate(BaseModel):
    source: str
    campaign_name: Optional[str] = None
    year: int
    month: int
    planned_budget: float


class BudgetUpdate(BaseModel):
    source: Optional[str] = None
    campaign_name: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None
    planned_budget: Optional[float] = None


class BudgetResponse(BaseModel):
    id: int
    source: str
    campaign_name: Optional[str] = None
    year: int
    month: int
    planned_budget: float
    created_at: datetime

    class Config:
        orm_mode = True


@router.post("", response_model=BudgetResponse)
def create_budget(b: BudgetCreate, db: Session = Depends(get_db)):
    if not (1 <= b.month <= 12):
        raise HTTPException(status_code=400, detail="month must be 1-12")

    row = CampaignMonthlyBudget(
        source=b.source.strip().upper(),
        campaign_name=(b.campaign_name or "").strip(),
        year=b.year,
        month=b.month,
        planned_budget=b.planned_budget,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=list[BudgetResponse])
def list_budgets(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    source: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(CampaignMonthlyBudget)
    if year:
        q = q.filter(CampaignMonthlyBudget.year == year)
    if month:
        q = q.filter(CampaignMonthlyBudget.month == month)
    if source:
        q = q.filter(CampaignMonthlyBudget.source == source.strip().upper())
    return q.order_by(CampaignMonthlyBudget.year.desc(), CampaignMonthlyBudget.month.desc()).all()


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(budget_id: int, upd: BudgetUpdate, db: Session = Depends(get_db)):
    row = db.query(CampaignMonthlyBudget).filter(CampaignMonthlyBudget.id == budget_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Budget not found")

    if upd.source is not None:
        row.source = upd.source.strip().upper()
    if upd.campaign_name is not None:
        row.campaign_name = upd.campaign_name.strip()
    if upd.year is not None:
        row.year = upd.year
    if upd.month is not None:
        if not (1 <= upd.month <= 12):
            raise HTTPException(status_code=400, detail="month must be 1-12")
        row.month = upd.month
    if upd.planned_budget is not None:
        row.planned_budget = upd.planned_budget

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    row = db.query(CampaignMonthlyBudget).filter(CampaignMonthlyBudget.id == budget_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": budget_id}


def _winning_set(winning: str) -> set[str]:
    return {s.strip().upper() for s in winning.split(",")} if winning else {"LAVORATA", "CHIUSA"}


@router.get("/kpis/report")
def budget_report(
    year: int = Query(..., description="e.g. 2025"),
    month: int = Query(..., description="1-12"),
    winning: str = Query("LAVORATA,CHIUSA"),
    db: Session = Depends(get_db),
):
    return bke.full_budget_report(db, year, month, _winning_set(winning))


@router.get("/kpis/vs-actual")
def budget_vs_actual(
    year: int = Query(...), month: int = Query(...), db: Session = Depends(get_db)
):
    return bke.kpi_budget_vs_actual(db, year, month)


@router.get("/kpis/cpl")
def budget_cpl(
    year: int = Query(...), month: int = Query(...),
    winning: str = Query("LAVORATA,CHIUSA"), db: Session = Depends(get_db)
):
    return bke.kpi_cpl(db, year, month, _winning_set(winning))


@router.get("/kpis/overspending")
def overspending(
    year: int = Query(...), month: int = Query(...), db: Session = Depends(get_db)
):
    return bke.kpi_overspending_alerts(db, year, month)


@router.get("/kpis/underperforming")
def underperforming(
    year: int = Query(...), month: int = Query(...),
    winning: str = Query("LAVORATA,CHIUSA"), db: Session = Depends(get_db)
):
    return bke.kpi_underperforming_alerts(db, year, month, _winning_set(winning))
