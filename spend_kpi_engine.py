"""
Campaign Spend KPI Engine - deterministic, period-aware.

mode = "actual"  -> only CampaignSpend rows (csv + manual)
mode = "planned" -> only CampaignMonthlyBudget (prorated to date range)
mode = "both"    -> actual + planned summed together
"""
from __future__ import annotations

import calendar
from datetime import date, datetime
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

VALID_MODES = {"actual", "planned", "both"}
DEFAULT_WINNING = {"LAVORATA", "CHIUSA"}


def normalize_source(s: str) -> str:
    return str(s).strip().upper() if s and str(s).strip() else "UNKNOWN"


def _parse_date(d: str | None) -> date | None:
    if not d:
        return None
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _normalize_mode(mode: str) -> str:
    m = (mode or "actual").strip().lower()
    if m not in VALID_MODES:
        return "actual"
    return m


def _prorate_budget(planned: float, year: int, month: int, start_date: date, end_date: date) -> float:
    """
    Return the portion of a monthly budget that falls within [start_date, end_date].
    Prorated by days: (days_overlap / days_in_month) * planned_budget.
    """
    last_day = calendar.monthrange(year, month)[1]
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    overlap_start = max(start_date, month_start)
    overlap_end = min(end_date, month_end)
    if overlap_start > overlap_end:
        return 0.0

    overlap_days = (overlap_end - overlap_start).days + 1
    return round(planned * overlap_days / last_day, 2)


def _actual_spend_df(db: Session, start: str | None, end: str | None) -> pd.DataFrame:
    """Load rows from campaign_spends (csv + manual) within date range."""
    sql = "SELECT source_normalized AS source, spend, campaign FROM campaign_spends WHERE 1=1"
    params: dict = {}

    start_date = _parse_date(start)
    end_date = _parse_date(end)
    if start_date:
        sql += " AND date >= :start"
        params["start"] = datetime.combine(start_date, datetime.min.time())
    if end_date:
        sql += " AND date <= :end"
        params["end"] = datetime.combine(end_date, datetime.max.time())

    rows = db.execute(text(sql), params).fetchall()
    if not rows:
        return pd.DataFrame(columns=["source", "spend", "campaign"])

    df = pd.DataFrame(rows, columns=["source", "spend", "campaign"])
    df["spend"] = pd.to_numeric(df["spend"], errors="coerce").fillna(0)
    df["source"] = df["source"].apply(normalize_source)
    df["campaign"] = df["campaign"].fillna("")
    return df


def _planned_spend_df(db: Session, start: str | None, end: str | None) -> pd.DataFrame:
    """
    Build a DataFrame of prorated planned spend from CampaignMonthlyBudget.
    Each budget row is prorated to the fraction of the month that overlaps [start, end].
    """
    start_date = _parse_date(start) or date(2000, 1, 1)
    end_date = _parse_date(end) or date(2099, 12, 31)
    if end_date < start_date:
        return pd.DataFrame(columns=["source", "spend", "campaign"])

    rows = db.execute(
        text(
            """
            SELECT source, campaign_name, year, month, planned_budget
            FROM campaign_monthly_budgets
            WHERE
                (year > :sy OR (year = :sy AND month >= :sm))
                AND
                (year < :ey OR (year = :ey AND month <= :em))
            """
        ),
        {
            "sy": start_date.year,
            "sm": start_date.month,
            "ey": end_date.year,
            "em": end_date.month,
        },
    ).fetchall()

    if not rows:
        return pd.DataFrame(columns=["source", "spend", "campaign"])

    virtual_rows = []
    for src, campaign, y, m, budget in rows:
        prorated = _prorate_budget(float(budget), int(y), int(m), start_date, end_date)
        if prorated > 0:
            virtual_rows.append(
                {
                    "source": normalize_source(src),
                    "spend": prorated,
                    "campaign": (campaign or "").strip(),
                }
            )

    if not virtual_rows:
        return pd.DataFrame(columns=["source", "spend", "campaign"])

    df = pd.DataFrame(virtual_rows)
    df["spend"] = pd.to_numeric(df["spend"], errors="coerce").fillna(0)
    return df


def _spend_df(db: Session, start: str | None = None, end: str | None = None, mode: str = "actual") -> pd.DataFrame:
    """Return combined spend DataFrame per the requested mode."""
    mode = _normalize_mode(mode)
    parts = []

    if mode in ("actual", "both"):
        parts.append(_actual_spend_df(db, start, end))
    if mode in ("planned", "both"):
        parts.append(_planned_spend_df(db, start, end))

    if not parts:
        return pd.DataFrame(columns=["source", "spend", "campaign"])

    df = pd.concat(parts, ignore_index=True)
    df["spend"] = pd.to_numeric(df["spend"], errors="coerce").fillna(0)
    df["source"] = df["source"].apply(normalize_source)
    return df


def _leads_df_for_kpi(db: Session, start: str | None, end: str | None) -> pd.DataFrame:
    sql = "SELECT lead_id, source, status FROM lead_records WHERE 1=1"
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
        return pd.DataFrame(columns=["lead_id", "source", "status"])

    df = pd.DataFrame(rows, columns=["lead_id", "source", "status"])
    df["source"] = df["source"].apply(normalize_source)
    df["status"] = df["status"].fillna("").str.strip().str.upper()
    return df


def debug_spend_inputs(db: Session, start: str | None = None, end: str | None = None, mode: str = "actual") -> dict:
    """Debug helper for endpoint logging: counts/sums of planned and actual components."""
    normalized_mode = _normalize_mode(mode)
    actual_df = _actual_spend_df(db, start, end)
    planned_df = _planned_spend_df(db, start, end)

    return {
        "from": start,
        "to": end,
        "mode": normalized_mode,
        "budgets_found_count": int(len(planned_df)),
        "budgets_found_sum": float(round(planned_df["spend"].sum(), 2)) if not planned_df.empty else 0.0,
        "actual_rows_found_count": int(len(actual_df)),
        "actual_rows_found_sum": float(round(actual_df["spend"].sum(), 2)) if not actual_df.empty else 0.0,
    }


def kpi_spend_by_source(db: Session, start: str | None = None, end: str | None = None, mode: str = "actual") -> dict:
    mode = _normalize_mode(mode)
    df = _spend_df(db, start, end, mode)
    if df.empty:
        return {"total_spend": 0.0, "spend_by_source": [], "period": {"start": start, "end": end}, "mode": mode}

    total = float(df["spend"].sum())
    by_src = (
        df.groupby("source").agg(total_spend=("spend", "sum"), entries=("spend", "count")).round(2).reset_index().sort_values("total_spend", ascending=False)
    )
    by_src["pct_of_total"] = (by_src["total_spend"] / total * 100).round(1) if total else 0

    return {
        "total_spend": round(total, 2),
        "period": {"start": start, "end": end},
        "mode": mode,
        "spend_by_source": by_src.to_dict(orient="records"),
    }


def kpi_cpl_by_source(db: Session, start: str | None = None, end: str | None = None, mode: str = "actual") -> dict:
    mode = _normalize_mode(mode)
    spend_df = _spend_df(db, start, end, mode)
    leads_df = _leads_df_for_kpi(db, start, end)

    if spend_df.empty:
        return {"cpl_by_source": [], "period": {"start": start, "end": end}, "mode": mode}

    spend_by = spend_df.groupby("source")["spend"].sum().reset_index()
    spend_by.columns = ["source", "total_spend"]

    if not leads_df.empty:
        leads_by = leads_df.groupby("source")["lead_id"].count().reset_index()
        leads_by.columns = ["source", "leads_count"]
        spend_by = spend_by.merge(leads_by, on="source", how="left")
        spend_by["leads_count"] = spend_by["leads_count"].fillna(0).astype(int)
        spend_by["cpl"] = spend_by.apply(
            lambda r: round(float(r["total_spend"]) / int(r["leads_count"]), 2)
            if int(r["leads_count"]) > 0
            else None,
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


def kpi_cost_per_winning(
    db: Session,
    start: str | None = None,
    end: str | None = None,
    winning_statuses: set[str] | None = None,
    mode: str = "actual",
) -> dict:
    mode = _normalize_mode(mode)
    if winning_statuses is None:
        winning_statuses = DEFAULT_WINNING
    winning_statuses = {s.strip().upper() for s in winning_statuses}

    spend_df = _spend_df(db, start, end, mode)
    leads_df = _leads_df_for_kpi(db, start, end)

    if spend_df.empty:
        return {
            "cost_per_winning_by_source": [],
            "winning_statuses": list(winning_statuses),
            "period": {"start": start, "end": end},
            "mode": mode,
        }

    spend_by = spend_df.groupby("source")["spend"].sum().reset_index()
    spend_by.columns = ["source", "total_spend"]

    if not leads_df.empty:
        win = leads_df[leads_df["status"].isin(winning_statuses)]
        if not win.empty:
            win_by = win.groupby("source")["lead_id"].count().reset_index()
            win_by.columns = ["source", "winning_leads"]
            spend_by = spend_by.merge(win_by, on="source", how="left")
        else:
            spend_by["winning_leads"] = 0
    else:
        spend_by["winning_leads"] = 0

    spend_by["winning_leads"] = spend_by["winning_leads"].fillna(0).astype(int)
    spend_by["cost_per_winning"] = spend_by.apply(
        lambda r: round(float(r["total_spend"]) / int(r["winning_leads"]), 2)
        if int(r["winning_leads"]) > 0
        else None,
        axis=1,
    )

    return {
        "period": {"start": start, "end": end},
        "winning_statuses": list(winning_statuses),
        "mode": mode,
        "cost_per_winning_by_source": spend_by.sort_values("total_spend", ascending=False).to_dict(orient="records"),
    }


def kpi_overspending_alerts(
    db: Session,
    start: str | None = None,
    end: str | None = None,
    winning_statuses: set[str] | None = None,
    min_spend_threshold: float = 0.0,
    mode: str = "actual",
) -> dict:
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


def kpi_monthly_spend_trend(db: Session, mode: str = "actual", start: str | None = None, end: str | None = None) -> dict:
    mode = _normalize_mode(mode)
    leads_df = _leads_df_for_kpi(db, start, end)

    if mode == "planned":
        start_date = _parse_date(start) or date(2000, 1, 1)
        end_date = _parse_date(end) or date(2099, 12, 31)
        if end_date < start_date:
            return {"monthly_trend": [], "mode": mode}

        rows = db.execute(
            text(
                """
                SELECT source, year, month, planned_budget
                FROM campaign_monthly_budgets
                WHERE
                    (year > :sy OR (year = :sy AND month >= :sm))
                    AND
                    (year < :ey OR (year = :ey AND month <= :em))
                """
            ),
            {
                "sy": start_date.year,
                "sm": start_date.month,
                "ey": end_date.year,
                "em": end_date.month,
            },
        ).fetchall()

        if not rows:
            return {"monthly_trend": [], "mode": mode}

        bdf = pd.DataFrame(rows, columns=["source", "year", "month", "planned_budget"])
        bdf["planned_budget"] = pd.to_numeric(bdf["planned_budget"], errors="coerce").fillna(0)
        bdf["month"] = bdf["year"].astype(str) + "-" + bdf["month"].astype(str).str.zfill(2)
        monthly = bdf.groupby("month")["planned_budget"].sum().reset_index()
        monthly.columns = ["month", "total_spend"]
    else:
        sql = "SELECT date, source_normalized, spend FROM campaign_spends WHERE 1=1"
        params: dict = {}
        start_date = _parse_date(start)
        end_date = _parse_date(end)

        if start_date:
            sql += " AND date >= :start"
            params["start"] = datetime.combine(start_date, datetime.min.time())
        if end_date:
            sql += " AND date <= :end"
            params["end"] = datetime.combine(end_date, datetime.max.time())

        rows = db.execute(text(sql), params).fetchall()
        if not rows:
            return {"monthly_trend": [], "mode": mode}

        full_df = pd.DataFrame(rows, columns=["date", "source", "spend"])
        full_df["date"] = pd.to_datetime(full_df["date"], errors="coerce")
        full_df["spend"] = pd.to_numeric(full_df["spend"], errors="coerce").fillna(0)
        full_df["month"] = full_df["date"].dt.to_period("M").astype(str)
        monthly = full_df.groupby("month")["spend"].sum().reset_index()
        monthly.columns = ["month", "total_spend"]

    if not leads_df.empty:
        lrows = db.execute(text("SELECT lead_id, opened_at FROM lead_records WHERE opened_at IS NOT NULL")).fetchall()
        if lrows:
            ldf = pd.DataFrame(lrows, columns=["lead_id", "opened_at"])
            ldf["opened_at"] = pd.to_datetime(ldf["opened_at"], errors="coerce")
            ldf["month"] = ldf["opened_at"].dt.to_period("M").astype(str)
            lmonthly = ldf.groupby("month")["lead_id"].count().reset_index()
            lmonthly.columns = ["month", "leads_count"]
            monthly = monthly.merge(lmonthly, on="month", how="left")
        else:
            monthly["leads_count"] = 0
    else:
        monthly["leads_count"] = 0

    monthly["leads_count"] = monthly["leads_count"].fillna(0).astype(int)
    monthly["cpl"] = monthly.apply(
        lambda r: round(float(r["total_spend"]) / int(r["leads_count"]), 2)
        if int(r["leads_count"]) > 0
        else None,
        axis=1,
    )
    monthly["total_spend"] = monthly["total_spend"].round(2)

    return {"monthly_trend": monthly.sort_values("month").to_dict(orient="records"), "mode": mode}


def kpi_spend_summary(db: Session, start=None, end=None, winning_statuses=None, mode: str = "actual") -> dict:
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
    "overspending_alerts": [
        "alert",
        "overspend",
        "high cpl",
        "warning",
        "issue",
        "problem",
        "expensive",
        "waste",
        "burning budget",
    ],
    "cost_per_winning": [
        "winning",
        "customer",
        "conversion",
        "vinta",
        "chiusa",
        "cost per winning",
        "cpw",
        "customer acquisition",
    ],
    "cpl": [
        "cpl",
        "cost per lead",
        "lead cost",
        "efficiency",
        "performance",
        "cheap",
        "expensive source",
    ],
    "monthly_trend": [
        "trend",
        "history",
        "over time",
        "monthly",
        "month by month",
        "growth",
        "progression",
    ],
    "spend_by_source": [
        "source",
        "channel",
        "platform",
        "media",
        "facebook",
        "google",
        "breakdown",
        "by source",
    ],
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
