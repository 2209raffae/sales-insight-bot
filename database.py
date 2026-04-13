"""
Database setup — SQLite via SQLAlchemy.
Provides run_migrations() for safe, idempotent column/table additions on existing DBs.
"""
import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    # Supabase (e PaaS vari) forniscono stringhe postgres:// che non sono più supportate da SQLAlchemy 1.4+
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _existing_columns(conn, table: str) -> set[str]:
    """Return set of column names currently in `table` (engine agnostic)."""
    try:
        inspector = inspect(conn)
        columns = inspector.get_columns(table)
        return {col['name'] for col in columns}
    except Exception:
        return set()


def run_migrations():
    """
    Idempotent migrations using natively supported IF NOT EXISTS where possible,
    or simple try/except blocks for older SQLite versions.
    """
    commands = {
        "lead_records": [
            "ALTER TABLE lead_records ADD COLUMN IF NOT EXISTS upload_id VARCHAR",
            "ALTER TABLE lead_records ADD COLUMN IF NOT EXISTS closed_at DATETIME"
        ],
        "campaign_spends": [
            "ALTER TABLE campaign_spends ADD COLUMN IF NOT EXISTS entry_type VARCHAR DEFAULT 'csv'",
            "ALTER TABLE campaign_spends ADD COLUMN IF NOT EXISTS note VARCHAR"
        ],
        "upload_batches": [
            "ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS \"user\" VARCHAR",
            "ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS mapping_used VARCHAR",
            "ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS reject_reasons VARCHAR"
        ],
        "task_force_projects": [
            "ALTER TABLE task_force_projects ADD COLUMN IF NOT EXISTS briefing_md TEXT"
        ],
        "task_force_updates": [
            "ALTER TABLE task_force_updates ADD COLUMN IF NOT EXISTS attachment_path TEXT",
            "ALTER TABLE task_force_updates ADD COLUMN IF NOT EXISTS attachment_type TEXT"
        ],
        "user_profiles": [
            "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin INTEGER DEFAULT 0"
        ],
        "warehouse_orders": [
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"shipping_address\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"phone_number\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"ai_packaging\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"ai_reason\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"ai_analyzed\" INTEGER DEFAULT 0",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"customer_first_name\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"customer_last_name\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"customer_email\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"shipping_fee\" FLOAT DEFAULT 0.0",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"shipping_street\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"shipping_city\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"shipping_zip\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"shipping_province\" VARCHAR",
            "ALTER TABLE warehouse_orders ADD COLUMN IF NOT EXISTS \"shipping_country\" VARCHAR"
        ],
        "crm_customers": [
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"first_name\" VARCHAR",
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"last_name\" VARCHAR",
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"email\" VARCHAR",
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"street\" VARCHAR",
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"city\" VARCHAR",
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"zip_code\" VARCHAR",
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"province\" VARCHAR",
            "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS \"country\" VARCHAR"
        ],
        "warehouse_products": [
            "ALTER TABLE warehouse_products ADD COLUMN IF NOT EXISTS location VARCHAR",
            "ALTER TABLE warehouse_products ADD COLUMN IF NOT EXISTS width FLOAT DEFAULT 0.0",
            "ALTER TABLE warehouse_products ADD COLUMN IF NOT EXISTS height FLOAT DEFAULT 0.0",
            "ALTER TABLE warehouse_products ADD COLUMN IF NOT EXISTS depth FLOAT DEFAULT 0.0",
            "ALTER TABLE warehouse_products ADD COLUMN IF NOT EXISTS is_packaging INTEGER DEFAULT 0"
        ],
        "warehouse_product_images": [
            "CREATE TABLE IF NOT EXISTS warehouse_product_images (id INTEGER PRIMARY KEY, product_id INTEGER, url VARCHAR, is_primary INTEGER, created_at DATETIME)"
        ],
        "crm_email_rules": [
            "ALTER TABLE crm_email_rules ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT ''",
            "ALTER TABLE crm_email_rules ADD COLUMN IF NOT EXISTS resend_template_id VARCHAR"
        ]
    }

    try:
        is_sqlite = engine.url.drivername.startswith("sqlite")
        for table, cmds in commands.items():
            for cmd in cmds:
                try:
                    with engine.begin() as conn:
                        if is_sqlite:
                            raw_cmd = cmd.replace(" IF NOT EXISTS", "")
                            conn.execute(text(raw_cmd))
                        else:
                            conn.execute(text(cmd))
                except Exception:
                    pass
    except Exception as e:
        print(f"Migration error: {e}")
        pass
