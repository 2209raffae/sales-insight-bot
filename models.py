"""
SQLAlchemy ORM models.
Datasets: Leads + Spend + Monthly Budgets.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, UniqueConstraint, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
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
    user_id     = Column(Integer, ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_slug  = Column(String, nullable=False)
    module_slug = Column(String, nullable=True)   # NULL = access to entire agent


# ── Auth: User Expertise / Skills ─────────────────────────────────────────────

class ExpertiseCategory(Base):
    """Categories of expertise (e.g. 'Frontend', 'Backend', 'Marketing')."""
    __tablename__ = "expertise_categories"

    id   = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)


class UserExpertise(Base):
    """Mapping between users and their areas of expertise."""
    __tablename__ = "user_expertise"
    __table_args__ = (
        UniqueConstraint("user_id", "category_id", name="uq_user_expertise"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("expertise_categories.id", ondelete="CASCADE"), nullable=False, index=True)


# ── Task Force Manager ─────────────────────────────────────────────────────────

class TaskForceProject(Base):
    """A project inside the Task Force Manager."""
    __tablename__ = "task_force_projects"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status      = Column(String, default="attivo") # "attivo", "completato", "sospeso"
    created_at  = Column(DateTime, default=datetime.utcnow)
    created_by  = Column(Integer, ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False)
    briefing_md = Column(Text, nullable=True) # Nucleo della missione / Knowledge base


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

    id              = Column(Integer, primary_key=True, index=True)
    project_id      = Column(Integer, ForeignKey("task_force_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id       = Column(Integer, ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False)
    content         = Column(Text, nullable=False)
    attachment_path = Column(String, nullable=True) # URL o path del file
    attachment_type = Column(String, nullable=True) # image/png, application/pdf, etc.
    created_at      = Column(DateTime, default=datetime.utcnow)


class TaskForceTodo(Base):
    """Specific tasks assigned within a Task Force."""
    __tablename__ = "task_force_todos"

    id          = Column(Integer, primary_key=True, index=True)
    project_id  = Column(Integer, ForeignKey("task_force_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    content     = Column(String, nullable=False)
    assigned_to = Column(Integer, ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=True)
    is_done     = Column(Integer, default=0) # 0=pending, 1=done
    created_at  = Column(DateTime, default=datetime.utcnow)


# ── Competitor Radar Pro ──────────────────────────────────────────────────────

class CompetitorSettings(Base):
    """Global settings for Competitor Radar (e.g. Own Website URL)."""
    __tablename__ = "competitor_settings"
    
    id              = Column(Integer, primary_key=True, index=True)
    own_website_url = Column(String, nullable=True)


class CompetitorBattleCard(Base):
    """Saved analysis of a competitor website with historical comparison."""
    __tablename__ = "competitor_battle_cards"

    id               = Column(Integer, primary_key=True, index=True)
    url              = Column(String, nullable=False, index=True)
    company_name     = Column(String)
    summary          = Column(Text)
    pricing_strategy = Column(Text)
    usp             = Column(Text) # JSON string array
    weaknesses       = Column(Text) # JSON string array
    target_audience  = Column(Text)
    pitch_advice     = Column(Text)
    comparison_analysis = Column(Text) # AI-generated tips on how to improve vs this competitor
    created_at       = Column(DateTime, default=datetime.utcnow)


# ── Warehouse Intelligence Agent (Universal Stock) ──────────────────────────

class WarehouseProduct(Base):
    """Universal inventory item with dynamic metadata and e-commerce sync support."""
    __tablename__ = "warehouse_products"

    id             = Column(Integer, primary_key=True, index=True)
    sku            = Column(String, unique=True, nullable=False, index=True) # Source of Truth for sync
    name           = Column(String, nullable=False, index=True)
    category       = Column(String, index=True)
    purchase_price = Column(Float, default=0.0)
    selling_price  = Column(Float, default=0.0) # Suggested or actual selling price
    quantity       = Column(Integer, default=0)
    status         = Column(String, default="Disponibile", index=True) # "Disponibile", "Prenotato", "Venduto", "Esaurito"
    metadata_json  = Column(Text, nullable=True) # JSON flexible storage for category-specific fields
    sync_status    = Column(Integer, default=0) # 0=PendingSync, 1=Synced, 2=Error
    last_sync      = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # ── E-commerce fields ───────────────────────────────────────────────────────
    is_visible     = Column(Integer, default=1)  # 1=visible on e-commerce, 0=hidden
    ecommerce_url  = Column(String, nullable=True)  # External product URL for reference
    reorder_point  = Column(Integer, default=3)  # Threshold for low-stock alert
    # ── New Logistic fields ──────────────────────────────────────────────────
    location       = Column(String, nullable=True) # e.g. "A-12-3"
    width          = Column(Float, default=0.0)
    height         = Column(Float, default=0.0)
    depth          = Column(Float, default=0.0)
    is_packaging   = Column(Integer, default=0) # 1 if this IS a box/packaging, 0 otherwise

class WarehouseMovement(Base):
    """Tracks every stock change (Carico, Scarico, Vendita, Rettifica)."""
    __tablename__ = "warehouse_movements"

    id           = Column(Integer, primary_key=True, index=True)
    product_id   = Column(Integer, ForeignKey("warehouse_products.id", ondelete="CASCADE"))
    movement_type = Column(String, nullable=False) # "Carico", "Vendita", "Reso", "Rettifica", "Prezzo"
    quantity_delta = Column(Integer, default=0) # + for In, - for Out
    old_value    = Column(Float, nullable=True) # Old price or quantity if relevant
    new_value    = Column(Float, nullable=True) # New price or quantity
    notes        = Column(Text, nullable=True)
    performed_by = Column(String, nullable=True) # User email or name
    created_at   = Column(DateTime, default=datetime.utcnow)

    product = relationship("WarehouseProduct", backref="movements")

class WarehouseProductImage(Base):
    """Gallery images for warehouse products."""
    __tablename__ = "warehouse_product_images"

    id         = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("warehouse_products.id", ondelete="CASCADE"), nullable=False, index=True)
    url        = Column(String, nullable=False)
    is_primary = Column(Integer, default=0) # 1=primary, 0=others
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("WarehouseProduct", backref="images")

class WarehouseOrder(Base):
    """
    Manages both Online (from Leads) and Physical In-Store orders.
    """
    __tablename__ = "warehouse_orders"

    id           = Column(Integer, primary_key=True, index=True)
    lead_id      = Column(Integer, ForeignKey("lead_records.id", ondelete="SET NULL"), nullable=True) # Linked CRM lead
    customer_name = Column(String, nullable=False) # Keep for legacy/combined
    customer_first_name = Column(String, nullable=True)
    customer_last_name = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    shipping_address = Column(String, nullable=True) # Summary
    shipping_street  = Column(String, nullable=True)
    shipping_city    = Column(String, nullable=True)
    shipping_zip     = Column(String, nullable=True)
    shipping_province = Column(String, nullable=True)
    shipping_country  = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    shipping_fee = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status       = Column(String, default="Da Preparare", index=True) # "Bozza", "Da Preparare", "In Preparazione", "Pronto", "Spedito", "Annullato"
    order_channel = Column(String, default="Online", index=True) # "Online", "Fisico"
    notes        = Column(Text, nullable=True)
    # AI-generated fields (persisted once, never re-computed)
    ai_packaging  = Column(String, nullable=True)   # e.g. "Scatola M"
    ai_reason     = Column(String, nullable=True)   # picking position rationale
    ai_analyzed   = Column(Integer, default=0)      # 0=pending, 1=done
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    shipment = relationship("Shipment", back_populates="order", uselist=False)

class OrderItem(Base):
    """Junction for multiple products per order."""
    __tablename__ = "order_items"

    id          = Column(Integer, primary_key=True, index=True)
    order_id    = Column(Integer, ForeignKey("warehouse_orders.id", ondelete="CASCADE"), nullable=False)
    product_id  = Column(Integer, ForeignKey("warehouse_products.id", ondelete="RESTRICT"), nullable=False)
    quantity    = Column(Integer, default=1)
    unit_price  = Column(Float, nullable=False)

    order = relationship("WarehouseOrder", back_populates="items")
    product = relationship("WarehouseProduct")

class Shipment(Base):
    """Logistics and tracking details for an order."""
    __tablename__ = "shipments"

    id             = Column(Integer, primary_key=True, index=True)
    order_id       = Column(Integer, ForeignKey("warehouse_orders.id", ondelete="CASCADE"), unique=True)
    courier_name   = Column(String, nullable=True) # DHL, GLS, UPS, etc.
    tracking_code  = Column(String, nullable=True)
    shipment_status = Column(String, default="In elaborazione", index=True) # "In elaborazione", "In transito", "Consegnato"
    label_url      = Column(String, nullable=True)
    estimated_delivery = Column(DateTime, nullable=True)
    shipped_at     = Column(DateTime, nullable=True)

    order = relationship("WarehouseOrder", back_populates="shipment")

# ── CRM Agent ────────────────────────────────────────────────────────────────

class CRMCustomer(Base):
    """Unified customer profiles for the CRM Agent."""
    __tablename__ = "crm_customers"

    id                 = Column(Integer, primary_key=True, index=True)
    phone_number       = Column(String, unique=True, nullable=False, index=True)
    name               = Column(String, nullable=False)
    first_name         = Column(String, nullable=True)
    last_name          = Column(String, nullable=True)
    email              = Column(String, nullable=True)
    address            = Column(String, nullable=True)
    street             = Column(String, nullable=True)
    city               = Column(String, nullable=True)
    zip_code           = Column(String, nullable=True)
    province           = Column(String, nullable=True)
    country            = Column(String, nullable=True)
    total_spent        = Column(Float, default=0.0)
    orders_count       = Column(Integer, default=0)
    last_purchase_date = Column(DateTime, nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CRMAutomation(Base):
    """Logs of automated marketing campaigns initiated from the CRM."""
    __tablename__ = "crm_automations"

    id            = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String, nullable=False)
    prompt_used   = Column(Text, nullable=False)
    email_content = Column(Text, nullable=False)
    sent_count    = Column(Integer, default=0)
    status        = Column(String, default="Completato")
    created_at    = Column(DateTime, default=datetime.utcnow)

class CRMEmailRule(Base):
    """Event-driven automation rules for marketing emails."""
    __tablename__ = "crm_email_rules"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String, nullable=False)
    subject         = Column(String, nullable=True, default="")
    trigger_event   = Column(String, nullable=False) # e.g., "ORDER_CREATED", "IDLE_1_MONTH"
    delay_hours     = Column(Integer, default=0)
    prompt_template     = Column(Text, nullable=False, default="")
    resend_template_id  = Column(String, nullable=True) # Optional: Resend native Template ID
    is_active           = Column(Integer, default=1) # 1=active, 0=inactive (sqlite boolean)
    created_at          = Column(DateTime, default=datetime.utcnow)

# ── Orchestrator: Multi-Tenancy & Platform Configuration ──────────────────────

class Company(Base):
    """Base entity for a tenant/organization."""
    __tablename__ = "companies"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False, index=True)
    description  = Column(Text, nullable=True) # Textual description for AI profiling
    metadata_json = Column(JSON, nullable=True) # Extra info (website, domain, etc.)
    created_at   = Column(DateTime, default=datetime.utcnow)

    profile = relationship("CompanyProfile", back_populates="company", uselist=False)
    agents  = relationship("ActiveAgent", back_populates="company")

class CompanyProfile(Base):
    """AI-generated insights about the company to drive agent configuration."""
    __tablename__ = "company_profiles"

    id               = Column(Integer, primary_key=True, index=True)
    company_id       = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), unique=True)
    industry        = Column(String)
    company_size    = Column(String)
    channels        = Column(JSON) # e.g. ["Retail", "E-commerce"]
    needs           = Column(JSON) # e.g. ["Inventory optimization", "Lead tracking"]
    complexity_level = Column(String)
    suggested_agents = Column(JSON) # e.g. ["sales", "warehouse"]
    created_at      = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="profile")

class ActiveAgent(Base):
    """Registry of activated agents for a specific company."""
    __tablename__ = "active_agents"
    __table_args__ = (
        UniqueConstraint("company_id", "agent_slug", name="uq_company_agent"),
    )

    id                = Column(Integer, primary_key=True, index=True)
    company_id        = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    agent_slug        = Column(String, nullable=False) # e.g. "sales-insight"
    is_enabled        = Column(Integer, default=1) # Boolean logic
    activation_reason = Column(Text, nullable=True)
    activated_at      = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="agents")
    config  = relationship("AgentConfiguration", back_populates="active_agent", uselist=False)

class AgentConfiguration(Base):
    """Config-driven parameters for a specific agent instance."""
    __tablename__ = "agent_configurations"

    id              = Column(Integer, primary_key=True, index=True)
    active_agent_id = Column(Integer, ForeignKey("active_agents.id", ondelete="CASCADE"), unique=True)
    config_json     = Column(JSON, nullable=False) # The actual config object
    
    # RAG Readiness
    use_vector_memory = Column(Integer, default=0)
    knowledge_domains = Column(JSON, nullable=True)
    retrieval_mode    = Column(String, default="none") 

    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    active_agent = relationship("ActiveAgent", back_populates="config")
