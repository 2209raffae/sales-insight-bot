from __future__ import annotations

import pandas as pd
from datetime import date, datetime
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from period_utils import parse_period, prorate_amount

VALID_MODES = {"imported", "actual", "both"}

def _parse_date(d: str | None) -> date | None:
    if not d:
        return None
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except Exception:
        return None

def _normalize_mode(mode: str) -> str:
    m = (mode or "both").strip().lower()
    if m not in VALID_MODES:
        return "both"
    return m

def get_true_spend_df(db: Session, start_date: date | None, end_date: date | None, mode: str = "both") -> pd.DataFrame:
    """
    Returns a unified dataframe of spend with columns [source, date, spend_amount].
    mode: "imported" (CSV only), "actual" (Manual only), "both" (Manual overrides CSV for the date).
    """
    mode = _normalize_mode(mode)
    
    sd = start_date or date(2000, 1, 1)
    ed = end_date or date(2099, 12, 31)

    # 1) Get all manual/actual spends that overlap with [sd, ed]
    manual_rows = db.execute(text("SELECT source, period_type, period_value, amount FROM actual_spends")).fetchall()
    
    manual_spends = []
    for row in manual_rows:
        src, ptype, pval, amt = row
        p_start, p_end = parse_period(ptype, pval)
        
        # Check overlap
        overlap_start = max(p_start, sd)
        overlap_end = min(p_end, ed)
        if overlap_start <= overlap_end:
            prorated_amt = prorate_amount(amt, p_start, p_end, overlap_start, overlap_end)
            manual_spends.append({
                "source": src.strip().upper(),
                "period_start": p_start,
                "period_end": p_end,
                "amount": prorated_amt,
            })
            
    manual_df = pd.DataFrame(manual_spends) if manual_spends else pd.DataFrame(columns=["source", "period_start", "period_end", "amount"])

    if mode == "actual":
        # Group manual by source
        if manual_df.empty: return pd.DataFrame(columns=["source", "spend"])
        res = manual_df.groupby("source", as_index=False)["amount"].sum().rename(columns={"amount": "spend"})
        return res

    # 2) Get imported spends
    imported_rows = db.execute(text("SELECT source_normalized AS source, date, spend FROM campaign_spends WHERE spend > 0")).fetchall()
    
    imported_df = pd.DataFrame(imported_rows, columns=["source", "date", "spend"]) if imported_rows else pd.DataFrame(columns=["source", "date", "spend"])
    if not imported_df.empty:
        imported_df["date"] = pd.to_datetime(imported_df["date"]).dt.date
        imported_df = imported_df[(imported_df["date"] >= sd) & (imported_df["date"] <= ed)]
    
    if mode == "imported":
        if imported_df.empty: return pd.DataFrame(columns=["source", "spend"])
        res = imported_df.groupby("source", as_index=False)["spend"].sum()
        return res

    # 3) Both -> Priority (Manual overrides imported)
    # Strategy: For each source, keep all imported spends whose `date` DOES NOT fall inside any manual `period` for that source.
    combined_spends = []
    
    # Add all manual
    if not manual_df.empty:
        grouped_manual = manual_df.groupby("source")["amount"].sum()
        for src, amt in grouped_manual.items():
            combined_spends.append({"source": src, "spend": amt})
            
    # Add filtered imported
    if not imported_df.empty:
        # dict of source -> list of (start, end)
        manual_periods = {}
        if not manual_df.empty:
            for _, row in manual_df.iterrows():
                manual_periods.setdefault(row["source"], []).append((row["period_start"], row["period_end"]))
                
        for _, row in imported_df.iterrows():
            src = row["source"]
            d = row["date"]
            val = row["spend"]
            
            # Check if d is inside any manual period for src
            is_overridden = False
            for (ps, pe) in manual_periods.get(src, []):
                if ps <= d <= pe:
                    is_overridden = True
                    break
            
            if not is_overridden:
                combined_spends.append({"source": src, "spend": val})
                
    comb_df = pd.DataFrame(combined_spends) if combined_spends else pd.DataFrame(columns=["source", "spend"])
    if not comb_df.empty:
        comb_df = comb_df.groupby("source", as_index=False)["spend"].sum()
        
    return comb_df

def get_granular_spend_df(db: Session, start_date: date | None, end_date: date | None, mode: str = "both") -> pd.DataFrame:
    """
    Returns a unified dataframe of spend with columns [source, date_start, date_end, spend, campaign].
    For imported spends, date_start == date_end == date.
    For actual spends, date_start and date_end span the period.
    """
    mode = _normalize_mode(mode)
    sd = start_date or date(2000, 1, 1)
    ed = end_date or date(2099, 12, 31)

    manual_rows = db.execute(text("SELECT source, period_type, period_value, amount FROM actual_spends")).fetchall()
    manual_spends = []
    for row in manual_rows:
        src, ptype, pval, amt = row
        p_start, p_end = parse_period(ptype, pval)
        overlap_start = max(p_start, sd)
        overlap_end = min(p_end, ed)
        if overlap_start <= overlap_end:
            prorated_amt = prorate_amount(amt, p_start, p_end, overlap_start, overlap_end)
            manual_spends.append({
                "source": src.strip().upper(),
                "date_start": overlap_start,
                "date_end": overlap_end,
                "spend": prorated_amt,
                "campaign": ""
            })
            
    manual_df = pd.DataFrame(manual_spends) if manual_spends else pd.DataFrame(columns=["source", "date_start", "date_end", "spend", "campaign"])

    if mode == "actual":
        return manual_df

    imported_rows = db.execute(text("SELECT source_normalized AS source, date, campaign, spend FROM campaign_spends WHERE spend > 0")).fetchall()
    
    imported_df = pd.DataFrame(imported_rows, columns=["source", "date", "campaign", "spend"]) if imported_rows else pd.DataFrame(columns=["source", "date", "campaign", "spend"])
    if not imported_df.empty:
        imported_df["date"] = pd.to_datetime(imported_df["date"]).dt.date
        imported_df = imported_df[(imported_df["date"] >= sd) & (imported_df["date"] <= ed)]
        imported_df["date_start"] = imported_df["date"]
        imported_df["date_end"] = imported_df["date"]
        imported_df["campaign"] = imported_df["campaign"].fillna("")
        imported_df = imported_df.drop(columns=["date"])
    else:
        imported_df = pd.DataFrame(columns=["source", "date_start", "date_end", "spend", "campaign"])

    if mode == "imported":
        return imported_df

    combined_spends = []
    if not manual_df.empty:
        combined_spends.extend(manual_df.to_dict(orient="records"))
            
    if not imported_df.empty:
        manual_periods = {}
        if not manual_df.empty:
            for _, row in manual_df.iterrows():
                manual_periods.setdefault(row["source"], []).append((row["date_start"], row["date_end"]))
                
        for _, row in imported_df.iterrows():
            src = row["source"]
            d = row["date_start"]
            
            is_overridden = False
            for (ps, pe) in manual_periods.get(src, []):
                if ps <= d <= pe:
                    is_overridden = True
                    break
            
            if not is_overridden:
                combined_spends.append(row.to_dict())
                
    return pd.DataFrame(combined_spends) if combined_spends else pd.DataFrame(columns=["source", "date_start", "date_end", "spend", "campaign"])
