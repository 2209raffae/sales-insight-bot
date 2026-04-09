from database import engine
from sqlalchemy import text
from models import Base
import sys

def migrate():
    print("Ensuring all tables exist...")
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized/updated.")

if __name__ == "__main__":
    try:
        migrate()
        print("Migration for WarehouseMovements completed successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)
