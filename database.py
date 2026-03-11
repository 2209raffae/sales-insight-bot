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
    Idempotent migrations — adds missing columns to existing tables.
    Safe to run every startup. SQLite does not support DROP COLUMN, so
    removed columns are simply ignored.
    """
    # Usiamo begin() cosicché un'eccezione non avveleni l'intero engine
    try:
        with engine.begin() as conn:
            # check se le tabelle esistono, altrimenti skip (succede al primissimo avvio prep-create_all)
            inspector = inspect(conn)
            tables = inspector.get_table_names()
            
            if "lead_records" in tables:
                cols = _existing_columns(conn, "lead_records")
                if "upload_id" not in cols:
                    try:
                        conn.execute(text("ALTER TABLE lead_records ADD COLUMN upload_id VARCHAR"))
                    except Exception:
                        pass
                if "closed_at" not in cols:
                    try:
                        conn.execute(text("ALTER TABLE lead_records ADD COLUMN closed_at DATETIME"))
                    except Exception:
                        pass
                        
            if "campaign_spends" in tables:
                cols = _existing_columns(conn, "campaign_spends")
                if "entry_type" not in cols:
                    try:
                        conn.execute(text("ALTER TABLE campaign_spends ADD COLUMN entry_type VARCHAR DEFAULT 'csv'"))
                    except Exception:
                        pass
                if "note" not in cols:
                    try:
                        conn.execute(text("ALTER TABLE campaign_spends ADD COLUMN note VARCHAR"))
                    except Exception:
                        pass
                        
            if "upload_batches" in tables:
                cols = _existing_columns(conn, "upload_batches")
                if "user" not in cols:
                    try:
                        conn.execute(text("ALTER TABLE upload_batches ADD COLUMN \"user\" VARCHAR"))  # 'user' is reserved in pg
                    except Exception:
                        pass
                if "mapping_used" not in cols:
                    try:
                        conn.execute(text("ALTER TABLE upload_batches ADD COLUMN mapping_used VARCHAR"))
                    except Exception:
                        pass
                if "reject_reasons" not in cols:
                    try:
                        conn.execute(text("ALTER TABLE upload_batches ADD COLUMN reject_reasons VARCHAR"))
                    except Exception:
                        pass
    except Exception:
        # Se c'è un deadlock irrecuperabile a livello macro o tabelle rotte, proseguiamo (fallirà elegantemente altrove se critico)
        pass
