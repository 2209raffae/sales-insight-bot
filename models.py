"""
SQLAlchemy ORM models.
Datasets: Leads + Spend + Monthly Budgets.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, UniqueConstraint, ForeignKey
)
from database import Base


# ── Upload Batch ───────────────────────────────────────────────────────────────

class UploadBatch(Base):
    """One record per CSV import (leads or spend)."""
    __tablename__ = "upload_batches"

    upload_id    = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset      = Column(String, nullable=False, index=True)   # "leads" | "spend"
    filename     = Column(String, nullable=False)
    uploaded_at  = Column(DateTime, default=datetime.utcnow, index=True)
    rows_new     = Column(Integer, default=0)
    rows_skipped = Column(Integer, default=0)
    rows_updated = Column(Integer, default=0)


# ── Lead Records ───────────────────────────────────────────────────────────────

class LeadRecord(Base):
    """One row per CRM lead."""
    __tablename__ = "lead_records"
    __table_args__ = (
        UniqueConstraint("lead_id", name="uq_lead_id"),
    )

    id         = Column(Integer, primary_key=True, index=True)
    upload_id  = Column(String, ForeignKey("upload_batches.upload_id"), nullable=True, index=True)
    lead_id    = Column(String, nullable=False, index=True)
    topic      = Column(String)
    doc_no     = Column(String, index=True)
    opened_at  = Column(DateTime, index=True)
    updated_at = Column(DateTime)
    closed_at  = Column(DateTime, nullable=True, index=True)   # Preferred date for winning lead attribution
    age_days   = Column(Float)
    operator   = Column(String, index=True)
    subject    = Column(String)
    requester  = Column(String)
    assignee   = Column(String)
    source     = Column(String, index=True)   # stored UPPER-stripped
    status     = Column(String, index=True)


# ── Campaign Spend ─────────────────────────────────────────────────────────────

class CampaignSpend(Base):
    """One row per actual campaign spend entry (imported via CSV or entered manually)."""
    __tablename__ = "campaign_spends"

    id                = Column(Integer, primary_key=True, index=True)
    upload_id         = Column(String, ForeignKey("upload_batches.upload_id"), nullable=True, index=True)
    date              = Column(DateTime, index=True)
    source_normalized = Column(String, index=True)   # UPPER-stripped, matches leads.source
    campaign          = Column(String)
    spend             = Column(Float, nullable=False)
    entry_type        = Column(String, default="csv")   # "csv" | "manual"
    note              = Column(String, nullable=True)


# ── Campaign Monthly Budget ─────────────────────────────────────────────────────

class CampaignMonthlyBudget(Base):
    """Planned monthly marketing budget per source/campaign."""
    __tablename__ = "campaign_monthly_budgets"

    id             = Column(Integer, primary_key=True, index=True)
    source         = Column(String, nullable=False, index=True)   # Normalized UPPER — must match leads/spend
    campaign_name  = Column(String, nullable=False)
    year           = Column(Integer, nullable=False, index=True)
    month          = Column(Integer, nullable=False, index=True)  # 1-12
    planned_budget = Column(Float, nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)
