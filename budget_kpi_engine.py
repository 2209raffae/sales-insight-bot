"""
Budget KPI Engine — deterministic, period-aligned.

All KPIs operate on a single (year, month) window.
Winning lead attribution:
  1. If closed_at IS NOT NULL  → use closed_at
  2. Otherwise                 → use updated_at  (documented fallback)

All KPI functions return transparent denominators so the UI can show exactly
what was used. The field used for winning attribution is returned as:
  winning_leads_date_field: "closed_at" | "updated_at"
"""
from __future__ import annotations
import calendar
from datetime import datetime
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text

DEFAULT_WINNING = {"LAVORATA", "CHIUSA"}


# ── Internal helpers ─────────────────────────────────────────────────────────

def _month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    """Return (first_day, last_day) as datetime for a given year/month."""
    last_day = calendar.monthrange(year, month)[1]
    return datetime(year, month, 1), datetime(year, month, last_day, 23, 59, 59)


def _actual_spend_df(db: Session, year: int, month: int) -> pd.DataFrame:
    """Load actual spend for the month from campaign_spends."""
    start, end = _month_bounds(year, month)
    rows = db.execute(
        text("""
            SELECT source_normalized AS source, campaign, SUM(spend) AS spend
            FROM campaign_spends
            WHERE date >= :start AND date <= :end
            GROUP BY source_normalized, campaign
        """),
        {"start": start, "end": end},
    ).fetchall()
    if not rows:
        return pd.DataFrame(columns=["source", "campaign", "spend"])
    df = pd.DataFrame(rows, columns=["source", "campaign", "spend"])
    df["spend"] = pd.to_numeric(df["spend"], errors="coerce").fillna(0)
    return df


def _budget_df(db: Session, year: int, month: int) -> pd.DataFrame:
    """Load planned monthly budgets."""
    rows = db.execute(
        text("""
            SELECT source, campaign_name AS campaign, planned_budget
            FROM campaign_monthly_budgets
            WHERE year = :year AND month = :month
        """),
        {"year": year, "month": month},
    ).fetchall()
    if not rows:
        return pd.DataFrame(columns=["source", "campaign", "planned_budget"])
    df = pd.DataFrame(rows, columns=["source", "campaign", "planned_budget"])
    df["planned_budget"] = pd.to_numeric(df["planned_budget"], errors="coerce").fillna(0)
    return df


def _leads_df(db: Session, year: int, month: int) -> pd.DataFrame:
    """
    Load leads opened in the given month.
    Also compute winning_date = closed_at if present, else updated_at.
    """
    start, end = _month_bounds(year, month)
    rows = db.execute(
        text("""
            SELECT lead_id, source, status, opened_at, closed_at, updated_at
            FROM lead_records
            WHERE opened_at >= :start AND opened_at <= :end
        """),
        {"start": start, "end": end},
    ).fetchall()
    if not rows:
        return pd.DataFrame(columns=["lead_id", "source", "status", "opened_at", "closed_at", "updated_at"])
    df = pd.DataFrame(rows, columns=["lead_id", "source", "status", "opened_at", "closed_at", "updated_at"])
    df["source"] = df["source"].fillna("UNKNOWN").str.strip().str.upper()
    df["status"] = df["status"].fillna("").str.strip().str.upper()
    df["opened_at"] = pd.to_datetime(df["opened_at"], errors="coerce")
    df["closed_at"] = pd.to_datetime(df["closed_at"], errors="coerce")
    df["updated_at"] = pd.to_datetime(df["updated_at"], errors="coerce")
    # Winning date = closed_at  (preferred) OR updated_at  (fallback)
    df["winning_date"] = df["closed_at"].combine_first(df["updated_at"])
    df["winning_date_field"] = df["closed_at"].notna().map(
        {True: "closed_at", False: "updated_at"}
    )
    return df


def _source_spend(df: pd.DataFrame) -> pd.Series:
    return df.groupby("source")["spend"].sum()


def _source_budget(df: pd.DataFrame) -> pd.Series:
    return df.groupby("source")["planned_budget"].sum()


# ── KPI 1: Full Budget Report (merged per source) ─────────────────────────────

def full_budget_report(
    db: Session,
    year: int,
    month: int,
    winning_statuses: set[str] | None = None,
) -> dict:
    """
    One authoritative function returning all budget KPIs per source.
    All other KPI functions delegate here.
    """
    if winning_statuses is None:
        winning_statuses = DEFAULT_WINNING
    winning_statuses_upper = {s.strip().upper() for s in winning_statuses}

    actual_df  = _actual_spend_df(db, year, month)
    budget_df  = _budget_df(db, year, month)
    leads_df   = _leads_df(db, year, month)

    # Build a union of all sources across all three datasets
    all_sources = (
        set(actual_df["source"].unique()) |
        set(budget_df["source"].unique()) |
        set(leads_df["source"].unique() if not leads_df.empty else set())
    )

    actual_by  = _source_spend(actual_df) if not actual_df.empty else pd.Series(dtype=float)
    budget_by  = _source_budget(budget_df) if not budget_df.empty else pd.Series(dtype=float)

    # Wins: filter by status AND winning_date within the month
    start, end = _month_bounds(year, month)
    start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)

    rows = []
    for src in sorted(all_sources):
        planned  = float(budget_by.get(src, 0))
        actual   = float(actual_by.get(src, 0))

        if leads_df.empty:
            leads_opened = 0
            winning_leads = 0
            winning_date_field = None
        else:
            src_leads = leads_df[leads_df["source"] == src]
            leads_opened = int(len(src_leads))

            winning_mask = (
                src_leads["status"].isin(winning_statuses_upper) &
                src_leads["winning_date"].notna() &
                (src_leads["winning_date"] >= start_ts) &
                (src_leads["winning_date"] <= end_ts)
            )
            winning_src = src_leads[winning_mask]
            winning_leads = int(len(winning_src))

            # Determine dominant date field used
            if not winning_src.empty:
                closed_count = int(winning_src["winning_date_field"].eq("closed_at").sum())
                winning_date_field = "closed_at" if closed_count > 0 else "updated_at"
            else:
                winning_date_field = "updated_at"

        # CPL actual
        cpl_actual = round(actual / leads_opened, 2) if leads_opened > 0 and actual > 0 else None
        # CPL target (planned / leads_opened)
        cpl_target = round(planned / leads_opened, 2) if leads_opened > 0 and planned > 0 else None
        # Cost per winning
        cpw = round(actual / winning_leads, 2) if winning_leads > 0 and actual > 0 else None
        # Utilization
        utilization_pct = round(actual / planned * 100, 1) if planned > 0 else None

        # Alerts
        overspending = actual > planned > 0
        underperforming = (planned > 0 and winning_leads == 0 and actual > 0)

        rows.append({
            "source":                  src,
            "planned_budget":          round(planned, 2),
            "actual_spend":            round(actual, 2),
            "leads_opened":            leads_opened,
            "winning_leads":           winning_leads,
            "winning_leads_date_field": winning_date_field,
            "cpl_actual":              cpl_actual,
            "cpl_target":              cpl_target,
            "cost_per_winning":        cpw,
            "utilization_pct":         utilization_pct,
            "alert_overspending":      overspending,
            "alert_underperforming":   underperforming,
        })

    return {
        "year":  year,
        "month": month,
        "winning_statuses": sorted(winning_statuses_upper),
        "note_winning_date": (
            "winning_leads uses closed_at when available, otherwise updated_at. "
            "See winning_leads_date_field per source row."
        ),
        "rows": rows,
    }


# ── Convenience wrappers ──────────────────────────────────────────────────────

def kpi_budget_vs_actual(db: Session, year: int, month: int) -> dict:
    r = full_budget_report(db, year, month)
    return {
        "year": r["year"], "month": r["month"],
        "rows": [{"source": x["source"], "planned_budget": x["planned_budget"],
                  "actual_spend": x["actual_spend"], "utilization_pct": x["utilization_pct"],
                  "alert_overspending": x["alert_overspending"]} for x in r["rows"]],
    }


def kpi_budget_utilization(db: Session, year: int, month: int) -> dict:
    r = full_budget_report(db, year, month)
    return {
        "year": r["year"], "month": r["month"],
        "rows": [{"source": x["source"], "planned_budget": x["planned_budget"],
                  "actual_spend": x["actual_spend"], "utilization_pct": x["utilization_pct"]}
                 for x in r["rows"]],
    }


def kpi_cpl(db: Session, year: int, month: int, winning_statuses=None) -> dict:
    r = full_budget_report(db, year, month, winning_statuses)
    return {
        "year": r["year"], "month": r["month"],
        "note_winning_date": r["note_winning_date"],
        "rows": [{"source": x["source"], "leads_opened": x["leads_opened"],
                  "actual_spend": x["actual_spend"], "planned_budget": x["planned_budget"],
                  "cpl_actual": x["cpl_actual"], "cpl_target": x["cpl_target"]} for x in r["rows"]],
    }


def kpi_overspending_alerts(db: Session, year: int, month: int) -> dict:
    r = full_budget_report(db, year, month)
    alerts = [x for x in r["rows"] if x["alert_overspending"]]
    return {"year": r["year"], "month": r["month"], "alerts": alerts}


def kpi_underperforming_alerts(db: Session, year: int, month: int, winning_statuses=None) -> dict:
    r = full_budget_report(db, year, month, winning_statuses)
    alerts = [x for x in r["rows"] if x["alert_underperforming"]]
    return {"year": r["year"], "month": r["month"], "note_winning_date": r["note_winning_date"], "alerts": alerts}


# ── Intent classifier (for chat integration) ─────────────────────────────────

BUDGET_KEYWORDS = {
    "budget_vs_actual":     ["budget vs actual", "planned vs actual", "how much did we spend", "budget comparison"],
    "utilization":          ["utilization", "budget usage", "how much of the budget", "budget consumption"],
    "cpl":                  ["cost per lead", "cpl", "costo per lead", "lead cost"],
    "overspending":         ["overspend", "over budget", "exceeded", "too much", "alerts"],
    "underperforming":      ["underperform", "low conversion", "bad roi", "wasted budget"],
    "full_report":          ["full report", "overview", "all kpis", "budget report"],
}


def classify_budget_intent(question: str) -> str:
    q = question.lower()
    for intent, kws in BUDGET_KEYWORDS.items():
        if any(kw in q for kw in kws):
            return intent
    return "full_report"
