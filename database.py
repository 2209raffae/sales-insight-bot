"""
Database setup — SQLite via SQLAlchemy.
Provides run_migrations() for safe, idempotent column/table additions on existing DBs.
"""
import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, DeclarativeBase
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
        
    engine = create_engine(DATABASE_URL)

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
        # Usa inspect sulla connessione corrente per evitare deadlock pg
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
        ]
    }

    try:
        with engine.begin() as conn:
            # Note: SQLite doesn't support 'IF NOT EXISTS' in ALTER TABLE ADD COLUMN.
            # But the user is using Postgres (Supabase).
            # For robustness, we wrap each execution.
            is_sqlite = engine.url.drivername.startswith("sqlite")
            
            for table, cmds in commands.items():
                for cmd in cmds:
                    try:
                        # If SQLite, we remove IF NOT EXISTS or handle differently
                        # Actually, keeping it as is for Postgres and wrapping in try/except for SQLite
                        if is_sqlite:
                            # SQLite doesn't like IF NOT EXISTS
                            raw_cmd = cmd.replace(" IF NOT EXISTS", "")
                            conn.execute(text(raw_cmd))
                        else:
                            conn.execute(text(cmd))
                    except Exception:
                        # Column might already exist
                        pass
    except Exception as e:
        print(f"Migration error: {e}")
        pass
