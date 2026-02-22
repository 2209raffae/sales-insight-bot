"""
Spend KPI router - deterministic spend metric endpoints.
Primary endpoint:
  GET /api/kpi/spend/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&mode=actual|planned|both
"""
import logging
import math
import numbers
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
import spend_kpi_engine as ske

router = APIRouter(prefix="/api/kpi/spend", tags=["spend-kpi"])
logger = logging.getLogger("uvicorn.error")


def _winning_set(winning: str) -> set[str]:
    return {s.strip().upper() for s in winning.split(",")} if winning else {"LAVORATA", "CHIUSA"}


def sanitize_for_json(obj):
    """Recursively replace NaN/Infinity with None to keep JSON RFC-compliant."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, tuple):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, numbers.Integral):
        return int(obj)
    if isinstance(obj, numbers.Real):
        val = float(obj)
        return val if math.isfinite(val) else None
    return obj


@router.get("/by-source")
def spend_by_source(
    from_date: str | None = Query(None, alias="from", description="YYYY-MM-DD"),
    to_date: str | None = Query(None, alias="to", description="YYYY-MM-DD"),
    mode: str = Query("actual", description="actual | planned | both"),
    db: Session = Depends(get_db),
):
    return ske.kpi_spend_by_source(db, from_date, to_date, mode=mode)


@router.get("/cpl")
def cost_per_lead(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    mode: str = Query("actual"),
    db: Session = Depends(get_db),
):
    return ske.kpi_cpl_by_source(db, from_date, to_date, mode=mode)


@router.get("/cost-per-winning")
def cost_per_winning(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    winning: str = Query("LAVORATA,CHIUSA"),
    mode: str = Query("actual"),
    db: Session = Depends(get_db),
):
    return ske.kpi_cost_per_winning(db, from_date, to_date, _winning_set(winning), mode=mode)


@router.get("/alerts")
def overspending_alerts(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    winning: str = Query("LAVORATA,CHIUSA"),
    mode: str = Query("actual"),
    db: Session = Depends(get_db),
):
    return ske.kpi_overspending_alerts(
        db, from_date, to_date, _winning_set(winning), min_spend_threshold=0.0, mode=mode
    )


@router.get("/trend")
def monthly_trend(
    mode: str = Query("actual"),
    db: Session = Depends(get_db),
):
    return ske.kpi_monthly_spend_trend(db, mode=mode)


@router.get("/summary")
def spend_summary(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    winning: str = Query("LAVORATA,CHIUSA"),
    mode: str = Query("actual"),
    db: Session = Depends(get_db),
):
    debug = ske.debug_spend_inputs(db, from_date, to_date, mode)
    print(
        "spend_summary",
        f"from={debug['from']}",
        f"to={debug['to']}",
        f"mode={debug['mode']}",
        f"budgets_found_count={debug['budgets_found_count']}",
        f"budgets_found_sum={debug['budgets_found_sum']:.2f}",
        f"actual_rows_found_count={debug['actual_rows_found_count']}",
        f"actual_rows_found_sum={debug['actual_rows_found_sum']:.2f}",
        flush=True,
    )
    payload = ske.kpi_spend_summary(db, from_date, to_date, _winning_set(winning), mode=mode)
    return JSONResponse(content=sanitize_for_json(payload))
