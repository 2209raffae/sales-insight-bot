"""
Database setup — SQLite via SQLAlchemy.
Provides run_migrations() for safe, idempotent column/table additions on existing DBs.
"""
import os
from sqlalchemy import create_engine, text
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
    # Se il `.env` ha un url postgresql:// non serve il connect_args sqlite:
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
    """Return set of column names currently in `table` (SQLite safe)."""
    try:
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        return {row[1] for row in result}
    except Exception:
        return set()


def run_migrations():
    """
    Idempotent migrations — adds missing columns to existing tables.
    Safe to run every startup. SQLite does not support DROP COLUMN, so
    removed columns are simply ignored.
    """
    with engine.connect() as conn:
        # lead_records: add upload_id if missing
        cols = _existing_columns(conn, "lead_records")
        if "upload_id" not in cols:
            try:
                conn.execute(text("ALTER TABLE lead_records ADD COLUMN upload_id VARCHAR"))
                conn.commit()
            except Exception:
                pass

        # lead_records: add closed_at if missing
        cols = _existing_columns(conn, "lead_records")
        if "closed_at" not in cols:
            try:
                conn.execute(text("ALTER TABLE lead_records ADD COLUMN closed_at DATETIME"))
                conn.commit()
            except Exception:
                pass

        # campaign_spends: add entry_type if missing
        cols = _existing_columns(conn, "campaign_spends")
        if "entry_type" not in cols:
            try:
                conn.execute(text("ALTER TABLE campaign_spends ADD COLUMN entry_type VARCHAR DEFAULT 'csv'"))
                conn.commit()
            except Exception:
                pass

        # campaign_spends: add note if missing
        cols = _existing_columns(conn, "campaign_spends")
        if "note" not in cols:
            try:
                conn.execute(text("ALTER TABLE campaign_spends ADD COLUMN note VARCHAR"))
                conn.commit()
            except Exception:
                pass

        # upload_batches: add user, mapping_used, reject_reasons if missing
        cols = _existing_columns(conn, "upload_batches")
        if "user" not in cols:
            try:
                conn.execute(text("ALTER TABLE upload_batches ADD COLUMN user VARCHAR"))
                conn.commit()
            except Exception:
                pass
        
        if "mapping_used" not in cols:
            try:
                conn.execute(text("ALTER TABLE upload_batches ADD COLUMN mapping_used VARCHAR"))
                conn.commit()
            except Exception:
                pass
                
        if "reject_reasons" not in cols:
            try:
                conn.execute(text("ALTER TABLE upload_batches ADD COLUMN reject_reasons VARCHAR"))
                conn.commit()
            except Exception:
                pass
