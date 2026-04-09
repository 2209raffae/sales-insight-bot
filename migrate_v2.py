from database import engine
from sqlalchemy import text, inspect
import sys

def migrate_v2():
    print("Checking for missing columns in warehouse_movements...")
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns("warehouse_movements")]
    
    with engine.connect() as conn:
        if "performed_by" not in columns:
            print("Adding 'performed_by' column to 'warehouse_movements'...")
            conn.execute(text("ALTER TABLE warehouse_movements ADD COLUMN performed_by VARCHAR"))
            conn.commit()
            print("Column 'performed_by' added.")
        else:
            print("Column 'performed_by' already exists.")

    print("Migration V2 completed.")

if __name__ == "__main__":
    try:
        migrate_v2()
    except Exception as e:
        print(f"Migration V2 failed: {e}")
        sys.exit(1)
