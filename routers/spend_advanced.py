from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
import pandas as pd
from database import get_db
from models import CampaignSpend
from actual_spend_service import get_granular_spend_df, _normalize_mode, _parse_date

router = APIRouter(prefix="/api/advanced", tags=["advanced"])

@router.get("/drill-down")
def drill_down_spend(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    granularity: str = Query("day", description="day | week | month"),
    group_by: str = Query("source", description="source | campaign"),
    mode: str = Query("both", description="actual | imported | both"),
    db: Session = Depends(get_db)
):
    df = get_granular_spend_df(db, _parse_date(from_date), _parse_date(to_date), mode)
    if df.empty:
        return {"data": []}
    
    # We must expand "date_start" and "date_end" into individual days if granularity = day
    # But that's expensive. A simpler trick: if we have date_start and date_end that span multiple days,
    # we can evenly distribute the spend across those days if granularity is day.
    # If granularity is month, we can just map date_start to its month bucket.
    
    expanded = []
    # approximate expansion
    for _, row in df.iterrows():
        s = row["date_start"]
        e = row["date_end"]
        spend = row["spend"]
        src = row["source"]
        cmp = row["campaign"]
        days = max((e - s).days + 1, 1)
        per_day = spend / days
        
        for i in range(days):
            d = s + timedelta(days=i)
            expanded.append({"date": d, "source": src, "spend": per_day, "campaign": cmp})
            
    edf = pd.DataFrame(expanded)
    edf["date"] = pd.to_datetime(edf["date"])
    
    # Granularity grouping
    if granularity == "month":
        edf["period"] = edf["date"].dt.to_period("M").astype(str)
    elif granularity == "week":
        # simple week format YYYY-WW
        edf["period"] = edf["date"].dt.strftime("%G-W%V")
    else:
        edf["period"] = edf["date"].dt.strftime("%Y-%m-%d")
        
    gcols = ["period", "source"]
    if group_by == "campaign":
        gcols.append("campaign")
        
    grouped = edf.groupby(gcols, as_index=False)["spend"].sum()
    grouped["spend"] = grouped["spend"].round(2)
    return {"data": grouped.to_dict(orient="records")}


@router.get("/explain")
def kpi_explain(
    kpi: str = Query("spend", description="spend | source"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db)
):
    # Determine current period and previous period
    ed = _parse_date(to_date) or date.today()
    sd = _parse_date(from_date) or (ed - timedelta(days=30))
    
    days = (ed - sd).days
    prev_ed = sd - timedelta(days=1)
    prev_sd = prev_ed - timedelta(days=days)
    
    # Compare
    cur_df = get_granular_spend_df(db, sd, ed, "both")
    prev_df = get_granular_spend_df(db, prev_sd, prev_ed, "both")
    
    cur_spend = float(cur_df["spend"].sum()) if not cur_df.empty else 0.0
    prev_spend = float(prev_df["spend"].sum()) if not prev_df.empty else 0.0
    
    delta = cur_spend - prev_spend
    pct = (delta / prev_spend * 100) if prev_spend else 0.0
    
    # Top drivers
    drivers = []
    if not cur_df.empty and not prev_df.empty:
        c_by = cur_df.groupby("source")["spend"].sum()
        p_by = prev_df.groupby("source")["spend"].sum()
        
        diff = c_by.subtract(p_by, fill_value=0).sort_values(ascending=False, key=abs)
        for src, dval in diff.head(3).items():
            drivers.append({"source": src, "impact": round(dval, 2)})
            
    notes = []
    # note: if any 0 spend on normally active ones
    if not prev_df.empty:
        active_prev = set(prev_df[prev_df["spend"] > 0]["source"])
        active_cur = set(cur_df[cur_df["spend"] > 0]["source"]) if not cur_df.empty else set()
        dropped = active_prev - active_cur
        if dropped:
            notes.append(f"Le fonti {', '.join(dropped)} non hanno spesa nel periodo corrente.")
            
    return {
        "current_period": {"start": sd, "end": ed, "spend": round(cur_spend, 2)},
        "previous_period": {"start": prev_sd, "end": prev_ed, "spend": round(prev_spend, 2)},
        "delta": round(delta, 2),
        "delta_pct": round(pct, 2),
        "drivers": drivers,
        "notes": notes
    }


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    # Look back 30 days
    ed = date.today()
    sd = ed - timedelta(days=30)
    df = get_granular_spend_df(db, sd, ed, "both")
    
    alerts = []
    if df.empty:
        return {"alerts": []}
        
    df["date_start"] = pd.to_datetime(df["date_start"]).dt.date
    daily = df.groupby(["source", "date_start"], as_index=False)["spend"].sum()
    
    for src, grp in daily.groupby("source"):
        mean = grp["spend"].mean()
        std = grp["spend"].std() or 0
        
        recent = grp.sort_values("date_start").tail(3)
        if len(recent) > 0:
            avg_recent = recent["spend"].mean()
            if mean > 0 and avg_recent < (mean * 0.1): # basically 0
                alerts.append({
                    "severity": "critic", 
                    "type": "drop", 
                    "source": src, 
                    "message": f"Spesa a 0 o crollata del 90% negli ultimi giorni rispetto alla media mensile (media: {mean:.2f})."
                })
            elif avg_recent > (mean + 2*std) and std > 0:
                alerts.append({
                    "severity": "warn",
                    "type": "spike",
                    "source": src,
                    "message": f"Picco di spesa rilevato: la spesa recente media ({avg_recent:.2f}) supera di 2 deviazioni standard la media ({mean:.2f})."
                })
                
    return {"alerts": alerts}


@router.get("/forecast-trend")
def get_trend_forecast(
    mode: str = Query("both", description="actual | imported | both"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: Session = Depends(get_db)
):
    import spend_kpi_engine as ske
    from ai_layer import forecast_trend
    
    # Run the deterministic trend kpi calculation
    trend_kpi = ske.kpi_monthly_spend_trend(db, mode, from_date, to_date)
    trend_data = trend_kpi.get("monthly_trend", [])
    
    if not trend_data:
        return {"forecast": "Dati insufficienti per calcolare un trend mensile su cui basare la previsione."}
        
    ai_response = forecast_trend(trend_data)
    return {"forecast": ai_response}
