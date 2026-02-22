import numbers
import math
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from database import get_db
from models import LeadRecord, CampaignSpend, CampaignMonthlyBudget

router = APIRouter(prefix="/api/report", tags=["report"])

def sanitize_for_json(obj):
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

def get_period_label(dt: datetime, period: str) -> str:
    if not dt:
        return "Unknown"
    
    y = dt.year
    m = dt.month
    
    if period == "month":
        return f"{y}-{m:02d}"
    elif period == "quarter":
        q = (m - 1) // 3 + 1
        return f"{y}-Q{q}"
    elif period == "semester":
        s = 1 if m <= 6 else 2
        return f"{y}-S{s}"
    else:
        return f"{y}-{m:02d}"

@router.get("/general")
def get_general_report(
    period: str = Query("month", description="month | quarter | semester"),
    winning: str = Query("LAVORATA,CHIUSA", description="Winning statuses"),
    db: Session = Depends(get_db)
):
    winning_set = {s.strip().upper() for s in winning.split(",")} if winning else {"LAVORATA", "CHIUSA"}

    # Fetch data
    leads = db.query(LeadRecord.opened_at, LeadRecord.source, LeadRecord.status).filter(LeadRecord.opened_at != None).all()
    spends = db.query(CampaignSpend.date, CampaignSpend.source_normalized, CampaignSpend.spend).filter(CampaignSpend.date != None).all()
    budgets = db.query(CampaignMonthlyBudget.year, CampaignMonthlyBudget.month, CampaignMonthlyBudget.source, CampaignMonthlyBudget.planned_budget).all()
    
    summary = {}
    
    # Helper to init dictionary keys
    def get_or_create(key_label, key_source):
        key = (key_label, key_source)
        if key not in summary:
            summary[key] = {
                "period": key_label, 
                "source": key_source, 
                "leads": 0, 
                "winning_leads": 0, 
                "spend": 0.0,
                "budget": 0.0
            }
        return key

    # Aggregate Leads
    for row in leads:
        dt, src, status = row
        label = get_period_label(dt, period)
        source = (src or "UNKNOWN").upper().strip()
        key = get_or_create(label, source)
        
        summary[key]["leads"] += 1
        if status and status.upper().strip() in winning_set:
            summary[key]["winning_leads"] += 1
            
    # Aggregate Spends
    for row in spends:
        dt, src, amt = row
        label = get_period_label(dt, period)
        source = (src or "UNKNOWN").upper().strip()
        key = get_or_create(label, source)
        
        summary[key]["spend"] += (amt or 0.0)
        
    # Aggregate Budgets
    for row in budgets:
        y, m, src, amt = row
        try:
            dt = datetime(y, m, 1)
        except ValueError:
            continue # safety against invalid invalid month values
        
        label = get_period_label(dt, period)
        source = (src or "UNKNOWN").upper().strip()
        key = get_or_create(label, source)
        
        summary[key]["budget"] += (amt or 0.0)
        
    result_list = []
    
    # Calculate KPIs and flatten
    for k in sorted(summary.keys()):
        item = summary[k]
        
        cpl = item["spend"] / item["leads"] if item["leads"] > 0 else 0.0
        cpl_winning = item["spend"] / item["winning_leads"] if item["winning_leads"] > 0 else 0.0
        
        item["cpl"] = cpl
        item["cpl_winning"] = cpl_winning
        result_list.append(item)
        
    return JSONResponse(content=sanitize_for_json({"data": result_list, "period": period}))
