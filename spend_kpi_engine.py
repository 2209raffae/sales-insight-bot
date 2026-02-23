"""
Campaign Spend KPI Engine - deterministic, period-aware.

mode = "imported" -> only campaign_spends
mode = "actual"   -> only actual_spends (manual)
mode = "both"     -> actual overrides imported
"""
from __future__ import annotations

import pandas as pd
from datetime import date, datetime
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from actual_spend_service import get_true_spend_df, _normalize_mode

DEFAULT_WINNING = {"LAVORATA", "CHIUSA"}

def _parse_date(d: str | None) -> date | None:
    if not d:
        return None
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except Exception:
        return None

def normalize_source(s: str) -> str:
    return str(s).strip().upper() if s and str(s).strip() else "UNKNOWN"

def _leads_df_for_kpi(db: Session, start: str | None, end: str | None) -> pd.DataFrame:
    sql = "SELECT lead_id, source, status, opened_at FROM lead_records WHERE 1=1"
    params: dict = {}

    start_date = _parse_date(start)
    end_date = _parse_date(end)
    if start_date:
        sql += " AND opened_at >= :start"
        params["start"] = datetime.combine(start_date, datetime.min.time())
    if end_date:
        sql += " AND opened_at <= :end"
        params["end"] = datetime.combine(end_date, datetime.max.time())

    rows = db.execute(text(sql), params).fetchall()
    if not rows:
        return pd.DataFrame(columns=["lead_id", "source", "status", "opened_at"])

    df = pd.DataFrame(rows, columns=["lead_id", "source", "status", "opened_at"])
    df["source"] = df["source"].apply(normalize_source)
    df["status"] = df["status"].fillna("").str.strip().str.upper()
    df["opened_at"] = pd.to_datetime(df["opened_at"], errors="coerce")
    return df

def debug_spend_inputs(db: Session, start: str | None = None, end: str | None = None, mode: str = "both") -> dict:
    mode = _normalize_mode(mode)
    start_date = _parse_date(start)
    end_date = _parse_date(end)
    df = get_true_spend_df(db, start_date, end_date, mode)

    return {
        "from": start,
        "to": end,
        "mode": mode,
        "budgets_found_count": 0, # not used in spend_kpi anymore
        "budgets_found_sum": 0.0,
        "actual_rows_found_count": int(len(df)),
        "actual_rows_found_sum": float(round(df["spend"].sum(), 2)) if not df.empty else 0.0,
    }

def kpi_spend_by_source(db: Session, start: str | None = None, end: str | None = None, mode: str = "both") -> dict:
    mode = _normalize_mode(mode)
    df = get_true_spend_df(db, _parse_date(start), _parse_date(end), mode)
    if df.empty:
        return {"total_spend": 0.0, "spend_by_source": [], "period": {"start": start, "end": end}, "mode": mode}

    total = float(df["spend"].sum())
    by_src = df.groupby("source", as_index=False).agg(total_spend=("spend", "sum")).round(2).sort_values("total_spend", ascending=False)
    by_src["pct_of_total"] = (by_src["total_spend"] / total * 100).round(1) if total else 0

    return {
        "total_spend": round(total, 2),
        "period": {"start": start, "end": end},
        "mode": mode,
        "spend_by_source": by_src.to_dict(orient="records"),
    }

def kpi_cpl_by_source(db: Session, start: str | None = None, end: str | None = None, mode: str = "both") -> dict:
    mode = _normalize_mode(mode)
    spend_df = get_true_spend_df(db, _parse_date(start), _parse_date(end), mode)
    leads_df = _leads_df_for_kpi(db, start, end)

    if spend_df.empty:
        return {"cpl_by_source": [], "period": {"start": start, "end": end}, "mode": mode}

    spend_by = spend_df.groupby("source", as_index=False)["spend"].sum()
    spend_by.columns = ["source", "total_spend"]

    if not leads_df.empty:
        leads_by = leads_df.groupby("source", as_index=False)["lead_id"].count()
        leads_by.columns = ["source", "leads_count"]
        spend_by = spend_by.merge(leads_by, on="source", how="left")
        spend_by["leads_count"] = spend_by["leads_count"].fillna(0).astype(int)
        spend_by["cpl"] = spend_by.apply(
            lambda r: round(float(r["total_spend"]) / int(r["leads_count"]), 2) if int(r["leads_count"]) > 0 else None,
            axis=1,
        )
    else:
        spend_by["leads_count"] = 0
        spend_by["cpl"] = None

    return {
        "period": {"start": start, "end": end},
        "mode": mode,
        "cpl_by_source": spend_by.sort_values("total_spend", ascending=False).to_dict(orient="records"),
    }

def kpi_cost_per_winning(db: Session, start: str | None = None, end: str | None = None, winning_statuses: set[str] | None = None, mode: str = "both") -> dict:
    mode = _normalize_mode(mode)
    if winning_statuses is None:
        winning_statuses = DEFAULT_WINNING
    winning_statuses = {s.strip().upper() for s in winning_statuses}

    spend_df = get_true_spend_df(db, _parse_date(start), _parse_date(end), mode)
    leads_df = _leads_df_for_kpi(db, start, end)

    if spend_df.empty:
        return {
            "cost_per_winning_by_source": [],
            "winning_statuses": list(winning_statuses),
            "period": {"start": start, "end": end},
            "mode": mode,
        }

    spend_by = spend_df.groupby("source", as_index=False)["spend"].sum()
    spend_by.columns = ["source", "total_spend"]

    if not leads_df.empty:
        win = leads_df[leads_df["status"].isin(winning_statuses)]
        if not win.empty:
            win_by = win.groupby("source", as_index=False)["lead_id"].count()
            win_by.columns = ["source", "winning_leads"]
            spend_by = spend_by.merge(win_by, on="source", how="left")
        else:
            spend_by["winning_leads"] = 0
    else:
        spend_by["winning_leads"] = 0

    spend_by["winning_leads"] = spend_by["winning_leads"].fillna(0).astype(int)
    spend_by["cost_per_winning"] = spend_by.apply(
        lambda r: round(float(r["total_spend"]) / int(r["winning_leads"]), 2) if int(r["winning_leads"]) > 0 else None,
        axis=1,
    )

    return {
        "period": {"start": start, "end": end},
        "winning_statuses": list(winning_statuses),
        "mode": mode,
        "cost_per_winning_by_source": spend_by.sort_values("total_spend", ascending=False).to_dict(orient="records"),
    }

def kpi_overspending_alerts(db: Session, start: str | None = None, end: str | None = None, winning_statuses: set[str] | None = None, min_spend_threshold: float = 0.0, mode: str = "both") -> dict:
    mode = _normalize_mode(mode)
    cpw = kpi_cost_per_winning(db, start, end, winning_statuses, mode=mode)
    rows = pd.DataFrame(cpw["cost_per_winning_by_source"])

    if rows.empty:
        return {"alerts": [], "period": cpw["period"], "mode": mode}

    rows = rows[rows["total_spend"] >= min_spend_threshold]
    valid = rows.dropna(subset=["cost_per_winning"])
    alerts_list = []

    if not valid.empty:
        avg_cpw = valid["cost_per_winning"].mean()
        for _, r in rows.iterrows():
            if pd.isna(r.get("cost_per_winning")) and r["total_spend"] > 0:
                r["alert_reason"] = "Zero winning leads"
                r["severity"] = "HIGH"
                alerts_list.append(r.to_dict())
            elif not pd.isna(r.get("cost_per_winning")) and r["cost_per_winning"] > avg_cpw * 2:
                r["alert_reason"] = f"CPW {r['cost_per_winning']:.2f} vs avg {avg_cpw:.2f}"
                r["severity"] = "MEDIUM"
                alerts_list.append(r.to_dict())
    else:
        for _, r in rows[rows["total_spend"] > 0].iterrows():
            r["alert_reason"] = "Zero winning leads"
            r["severity"] = "HIGH"
            alerts_list.append(r.to_dict())

    return {"alerts": alerts_list, "period": cpw["period"], "mode": mode}

def kpi_monthly_spend_trend(db: Session, mode: str = "both", start: str | None = None, end: str | None = None) -> dict:
    mode = _normalize_mode(mode)
    # The trend uses a daily dataframe and groups by month.
    # get_true_spend_df returns purely source and spend. But for trend we need month.
    # Let's rebuild a granular version for month grouping.
    
    start_date = _parse_date(start) or date(2000, 1, 1)
    end_date = _parse_date(end) or date(2099, 12, 31)
    
    # Simple approx: group by month inside date range
    # Since get_true_spend_df collapses periods, we shouldn't use it directly if we want a month-by-month trend.
    # Since ActualSpend is already period based, we can easily break it down by month.
    
    # We will compute the true spend for each year-month in the range.
    cur_year, cur_month = start_date.year, start_date.month
    end_year, end_month = end_date.year, end_date.month
    
    monthly_data = []
    while (cur_year < end_year) or (cur_year == end_year and cur_month <= end_month):
        import calendar
        m_start = date(cur_year, cur_month, 1)
        m_end = date(cur_year, cur_month, calendar.monthrange(cur_year, cur_month)[1])
        
        # calculate max bounds
        bounds_start = max(start_date, m_start)
        bounds_end = min(end_date, m_end)
        
        df = get_true_spend_df(db, bounds_start, bounds_end, mode)
        m_spend = float(df["spend"].sum()) if not df.empty else 0.0
        
        # calculate leads
        l_df = _leads_df_for_kpi(db, bounds_start.isoformat(), bounds_end.isoformat())
        l_count = int(len(l_df))
        cpl = round(m_spend / l_count, 2) if l_count > 0 else None
        
        monthly_data.append({
            "month": f"{cur_year}-{cur_month:02d}",
            "total_spend": m_spend,
            "leads_count": l_count,
            "cpl": cpl
        })
        
        cur_month += 1
        if cur_month > 12:
            cur_month = 1
            cur_year += 1

    return {"monthly_trend": monthly_data, "mode": mode}

def kpi_spend_summary(db: Session, start=None, end=None, winning_statuses=None, mode: str = "both") -> dict:
    mode = _normalize_mode(mode)
    by_source = kpi_spend_by_source(db, start, end, mode)
    cpl = kpi_cpl_by_source(db, start, end, mode)
    cpw = kpi_cost_per_winning(db, start, end, winning_statuses, mode)
    alerts = kpi_overspending_alerts(db, start, end, winning_statuses, mode=mode)
    trend = kpi_monthly_spend_trend(db, mode, start, end)

    return {
        **by_source,
        "cpl_by_source": cpl.get("cpl_by_source", []),
        "cost_per_winning_by_source": cpw.get("cost_per_winning_by_source", []),
        "overspending_alerts": alerts.get("alerts", []),
        "monthly_trend": trend.get("monthly_trend", []),
    }

SPEND_INTENT_MAP = {
    "spend_by_source": kpi_spend_by_source,
    "cpl": kpi_cpl_by_source,
    "cost_per_winning": kpi_cost_per_winning,
    "overspending_alerts": kpi_overspending_alerts,
    "monthly_trend": kpi_monthly_spend_trend,
    "spend_summary": kpi_spend_summary,
}

SPEND_KEYWORDS = {
    "overspending_alerts": ["alert", "overspend", "high cpl", "warning", "issue", "problem", "expensive", "waste", "burning budget"],
    "cost_per_winning": ["winning", "customer", "conversion", "vinta", "chiusa", "cost per winning", "cpw", "customer acquisition"],
    "cpl": ["cpl", "cost per lead", "lead cost", "efficiency", "performance", "cheap", "expensive source"],
    "monthly_trend": ["trend", "history", "over time", "monthly", "month by month", "growth", "progression"],
    "spend_by_source": ["source", "channel", "platform", "media", "facebook", "google", "breakdown", "by source"],
}

def classify_spend_intent(question: str) -> str:
    q = question.lower()
    for intent, keywords in SPEND_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            return intent
    return "spend_summary"

def compute_spend_kpi_for_question(question: str, db: Session) -> tuple[str, dict]:
    intent = classify_spend_intent(question)
    fn = SPEND_INTENT_MAP.get(intent, kpi_spend_summary)
    if intent in {"cost_per_winning", "overspending_alerts", "spend_summary"}:
        return intent, fn(db, winning_statuses=DEFAULT_WINNING)
    return intent, fn(db)
