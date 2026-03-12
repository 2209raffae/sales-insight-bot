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
    user         = Column(String, nullable=True)
    mapping_used = Column(String, nullable=True) # JSON
    reject_reasons = Column(String, nullable=True) # JSON


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


# ── Campaign Spend (Imported) ──────────────────────────────────────────────────

class CampaignSpend(Base):
    """One row per imported campaign spend entry (imported via CSV)."""
    __tablename__ = "campaign_spends"

    id                = Column(Integer, primary_key=True, index=True)
    upload_id         = Column(String, ForeignKey("upload_batches.upload_id"), nullable=True, index=True)
    date              = Column(DateTime, index=True)
    source_normalized = Column(String, index=True)   # UPPER-stripped, matches leads.source
    campaign          = Column(String)
    spend             = Column(Float, nullable=False)
    entry_type        = Column(String, default="csv")   # "csv" keeps backward compat
    note              = Column(String, nullable=True)


# ── Actual Spend (Manual) ──────────────────────────────────────────────────────

class ActualSpend(Base):
    """Manually entered actual spend per period."""
    __tablename__ = "actual_spends"

    id           = Column(Integer, primary_key=True, index=True)
    source       = Column(String, nullable=False, index=True)  # Normalized UPPER
    period_type  = Column(String, nullable=False)              # "week" | "month" | "quarter"
    period_value = Column(String, nullable=False)              # e.g. "2023-W01", "2023-01", "2023-Q1"
    amount       = Column(Float, nullable=False)
    note         = Column(String, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("source", "period_type", "period_value", name="uq_actual_spend"),
    )


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


# ── Auth: User Profiles ────────────────────────────────────────────────────────

class UserProfile(Base):
    """Platform user with login credentials and role."""
    __tablename__ = "user_profiles"

    id         = Column(Integer, primary_key=True, index=True)
    email      = Column(String, unique=True, nullable=False, index=True)
    hashed_pw  = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name  = Column(String, nullable=False)
    role       = Column(String, nullable=False, default="Utente")   # es: "Direttore", "Commerciale"
    is_admin   = Column(Integer, default=0)   # 1 = admin, 0 = normal (Integer per compat SQLite/PG)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Auth: Granular Permissions ─────────────────────────────────────────────────

class UserPermission(Base):
    """
    Defines which agent/module a user can access.
    agent_slug examples: 'sales-insight', 'hr-copilot', 'competitor-radar', 'task-force'
    module_slug examples: 'leads', 'upload', 'chat', 'screening', 'performance' (NULL = all modules)
    """
    __tablename__ = "user_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "agent_slug", "module_slug", name="uq_user_permission"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("user_profiles.id"), nullable=False, index=True)
    agent_slug  = Column(String, nullable=False)
    module_slug = Column(String, nullable=True)   # NULL = access to entire agent


# ── Task Force Manager ─────────────────────────────────────────────────────────

class TaskForceProject(Base):
    """A project inside the Task Force Manager."""
    __tablename__ = "task_force_projects"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status      = Column(String, default="attivo") # "attivo", "completato", "sospeso"
    created_at  = Column(DateTime, default=datetime.utcnow)
    created_by  = Column(Integer, ForeignKey("user_profiles.id"), nullable=False)


class TaskForceMember(Base):
    """Membri assegnati a un progetto della Task Force."""
    __tablename__ = "task_force_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("task_force_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    role       = Column(String, default="Membro") # Es. "Leader", "Membro"


class TaskForceUpdate(Base):
    """Aggiornamenti/comunicazioni per un progetto."""
    __tablename__ = "task_force_updates"

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("task_force_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id  = Column(Integer, ForeignKey("user_profiles.id"), nullable=False)
    content    = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
