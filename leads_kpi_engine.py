"""
Leads KPI engine — ALL lead metrics computed deterministically via pandas.
The LLM only receives these results to explain; it never calculates numbers.

Columns: lead_id, topic, doc_no, opened_at, updated_at, age_days,
         operator, subject, requester, assignee, source, status
"""
from __future__ import annotations
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text


# ── helpers ───────────────────────────────────────────────────────────────────

def _leads_df(db: Session) -> pd.DataFrame:
    # Use explicit column selection to strictly match DataFrame columns
    query = text("""
        SELECT id, lead_id, topic, doc_no, opened_at, updated_at, closed_at,
               age_days, operator, subject, requester, assignee,
               source, status, upload_id
        FROM lead_records
    """)
    rows = db.execute(query).fetchall()

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=[
        "id", "lead_id", "topic", "doc_no", "opened_at", "updated_at", "closed_at",
        "age_days", "operator", "subject", "requester", "assignee",
        "source", "status", "upload_id"
    ])

    df["opened_at"] = pd.to_datetime(df["opened_at"], errors="coerce")
    df["updated_at"] = pd.to_datetime(df["updated_at"], errors="coerce")
    df["age_days"] = pd.to_numeric(df["age_days"], errors="coerce").fillna(0)
    # Normalise text fields
    for col in ["status", "source", "operator", "assignee"]:
        df[col] = df[col].fillna("Unknown").str.strip()
    return df


def _pct(count: int, total: int) -> float:
    return round((count / total * 100), 1) if total else 0.0


# ── KPI: leads by status ──────────────────────────────────────────────────────

def kpi_leads_by_status(db: Session) -> dict:
    df = _leads_df(db)
    if df.empty:
        return {"total_leads": 0, "leads_by_status": []}
    total = len(df)
    groups = (
        df.groupby("status")
        .agg(count=("lead_id", "count"), avg_age_days=("age_days", "mean"))
        .round(1)
        .reset_index()
        .sort_values("count", ascending=False)
    )
    groups["pct"] = groups["count"].apply(lambda c: _pct(c, total))
    return {
        "total_leads": total,
        "leads_by_status": groups.to_dict(orient="records"),
    }


# ── KPI: leads by source ──────────────────────────────────────────────────────

def kpi_leads_by_source(db: Session, top_n: int = 10) -> dict:
    df = _leads_df(db)
    if df.empty:
        return {"total_leads": 0, "leads_by_source": []}
    total = len(df)
    groups = (
        df.groupby("source")
        .agg(
            count=("lead_id", "count"),
            avg_age_days=("age_days", "mean"),
        )
        .round(1)
        .reset_index()
        .sort_values("count", ascending=False)
        .head(top_n)
    )
    groups["pct"] = groups["count"].apply(lambda c: _pct(c, total))
    return {
        "total_leads": total,
        "leads_by_source": groups.to_dict(orient="records"),
    }


# ── KPI: aging analysis ───────────────────────────────────────────────────────

AGE_BUCKETS = [
    ("0-1 days",  0,  1),
    ("2-3 days",  2,  3),
    ("4-7 days",  4,  7),
    ("8+ days",   8,  float("inf")),
]


def kpi_leads_aging(db: Session) -> dict:
    df = _leads_df(db)
    if df.empty:
        return {"aging_summary": {}, "aging_buckets": []}

    total = len(df)
    summary = {
        "total_leads": total,
        "avg_age_days": round(float(df["age_days"].mean()), 1),
        "median_age_days": round(float(df["age_days"].median()), 1),
        "max_age_days": round(float(df["age_days"].max()), 1),
        "min_age_days": round(float(df["age_days"].min()), 1),
    }

    buckets = []
    for label, lo, hi in AGE_BUCKETS:
        if hi == float("inf"):
            mask = df["age_days"] >= lo
        else:
            mask = (df["age_days"] >= lo) & (df["age_days"] <= hi)
        cnt = int(mask.sum())
        buckets.append({
            "bucket": label,
            "count": cnt,
            "pct": _pct(cnt, total),
        })

    return {"aging_summary": summary, "aging_buckets": buckets}


# ── KPI: operator workload ─────────────────────────────────────────────────────

def kpi_operator_workload(db: Session) -> dict:
    df = _leads_df(db)
    if df.empty:
        return {"operator_workload": []}

    # Use assignee when populated, fall back to operator
    df["worker"] = df["assignee"].where(
        df["assignee"].str.lower() != "unknown", df["operator"]
    )

    groups = (
        df.groupby("worker")
        .agg(
            total_leads=("lead_id", "count"),
            avg_age_days=("age_days", "mean"),
            max_age_days=("age_days", "max"),
        )
        .round(1)
        .reset_index()
        .sort_values("total_leads", ascending=False)
        .rename(columns={"worker": "operator"})
    )

    # Per-operator status breakdown (top 2 statuses)
    status_map = (
        df.groupby(["worker", "status"])["lead_id"]
        .count()
        .reset_index()
        .rename(columns={"lead_id": "cnt", "worker": "operator"})
        .sort_values("cnt", ascending=False)
        .groupby("operator")
        .apply(lambda g: g.head(3)[["status", "cnt"]].to_dict("records"))
        .to_dict()
    )
    groups["top_statuses"] = groups["operator"].map(status_map)

    return {"operator_workload": groups.to_dict(orient="records")}


# ── KPI: conversion readiness / at-risk leads ─────────────────────────────────

def kpi_aging_risks(db: Session, stale_days: int = 3) -> dict:
    """
    Flags leads in 'DA LAVORARE' (or similar open statuses) older than stale_days.
    These represent conversion-readiness risk.
    """
    df = _leads_df(db)
    if df.empty:
        return {"at_risk_leads": [], "stale_threshold_days": stale_days, "total_at_risk": 0}

    # Open/workable statuses — adjust based on your actual status vocabulary
    open_statuses = {
        "da lavorare", "aperto", "open", "nuovo", "assegnato",
        "in lavorazione", "pending", "new", "assigned",
    }
    mask_open = df["status"].str.lower().isin(open_statuses)
    mask_old = df["age_days"] > stale_days

    at_risk = df[mask_open & mask_old].copy()
    at_risk = at_risk.sort_values("age_days", ascending=False)

    # Summarise by operator
    by_operator = (
        at_risk.groupby("operator")
        .agg(at_risk_count=("lead_id", "count"), avg_age=("age_days", "mean"))
        .round(1)
        .reset_index()
        .sort_values("at_risk_count", ascending=False)
        .to_dict(orient="records")
    )

    # Top individual stale leads (worst first)
    sample = at_risk.head(20)[[
        "lead_id", "status", "operator", "assignee", "source",
        "age_days", "subject",
    ]].to_dict(orient="records")

    return {
        "stale_threshold_days": stale_days,
        "total_at_risk": int(len(at_risk)),
        "by_operator": by_operator,
        "sample_at_risk_leads": sample,
    }


# ── summary (all leads KPIs) ──────────────────────────────────────────────────

def kpi_leads_summary(db: Session) -> dict:
    return {
        **kpi_leads_by_status(db),
        **kpi_leads_by_source(db),
        **kpi_leads_aging(db),
        "operator_workload": kpi_operator_workload(db).get("operator_workload", []),
        **kpi_aging_risks(db),
    }


# ── intent → KPI dispatcher ───────────────────────────────────────────────────

LEADS_INTENT_MAP = {
    "leads_status":      kpi_leads_by_status,
    "leads_sources":     kpi_leads_by_source,
    "leads_aging":       kpi_leads_aging,
    "operator_workload": kpi_operator_workload,
    "aging_risks":       kpi_aging_risks,
    "leads_summary":     kpi_leads_summary,
}

LEADS_KEYWORDS = {
    "aging_risks": [
        "risk", "stale", "stuck", "old lead", "da lavorare", "overdue",
        "not contacted", "at risk", "conversion", "urgent",
    ],
    "operator_workload": [
        "operator", "workload", "assignee", "agent", "who is handling",
        "team", "person", "rep", "staff", "assigned to",
    ],
    "leads_sources": [
        "source", "channel", "where do leads come", "lead origin",
        "provenance", "lead channel",
    ],
    "leads_aging": [
        "aging", "age", "days", "how old", "average age", "median",
        "bucket", "time open",
    ],
    "leads_status": [
        "status", "state", "open", "closed", "pending", "new",
        "da lavorare", "aperto", "chiuso", "lead status",
    ],
}


def classify_leads_intent(question: str) -> str:
    q = question.lower()
    for intent, keywords in LEADS_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            return intent
    return "leads_summary"


def compute_leads_kpi_for_question(question: str, db: Session) -> tuple[str, dict]:
    intent = classify_leads_intent(question)
    fn = LEADS_INTENT_MAP.get(intent, kpi_leads_summary)
    return intent, fn(db)
