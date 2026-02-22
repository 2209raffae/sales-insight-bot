"""
Leads KPI router — all deterministic lead metric endpoints.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
import leads_kpi_engine as lke

router = APIRouter(prefix="/api/kpi/leads", tags=["leads-kpi"])


@router.get("/summary")
def leads_summary(db: Session = Depends(get_db)):
    return lke.kpi_leads_summary(db)


@router.get("/by-source")
def leads_by_source(top_n: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    return lke.kpi_leads_by_source(db, top_n=top_n)


@router.get("/by-status")
def leads_by_status(db: Session = Depends(get_db)):
    return lke.kpi_leads_by_status(db)


@router.get("/by-operator")
def leads_by_operator(db: Session = Depends(get_db)):
    return lke.kpi_operator_workload(db)


@router.get("/aging")
def leads_aging(
    days: int = Query(3, ge=0, description="Stale threshold for aging-risk detection"),
    db: Session = Depends(get_db),
):
    """
    Returns both the aging bucket breakdown and at-risk leads
    (open status + older than `days` threshold).
    """
    aging = lke.kpi_leads_aging(db)
    risks = lke.kpi_aging_risks(db, stale_days=days)
    return {**aging, **risks}
