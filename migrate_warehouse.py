from database import engine
from sqlalchemy import text
import sys

def migrate():
    with engine.connect() as conn:
        print("Checking warehouse_products table...")
        
        # Check for is_visible
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouse_products' AND column_name = 'is_visible'"))
        if not res.fetchone():
            print("Adding is_visible column...")
            conn.execute(text("ALTER TABLE warehouse_products ADD COLUMN is_visible INTEGER DEFAULT 1"))
            conn.commit()
        else:
            print("is_visible already exists.")

        # Check for ecommerce_url
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouse_products' AND column_name = 'ecommerce_url'"))
        if not res.fetchone():
            print("Adding ecommerce_url column...")
            conn.execute(text("ALTER TABLE warehouse_products ADD COLUMN ecommerce_url TEXT"))
            conn.commit()
        else:
            print("ecommerce_url already exists.")

        # Check for reorder_point
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouse_products' AND column_name = 'reorder_point'"))
        if not res.fetchone():
            print("Adding reorder_point column...")
            conn.execute(text("ALTER TABLE warehouse_products ADD COLUMN reorder_point INTEGER DEFAULT 3"))
            conn.commit()
        else:
            print("reorder_point already exists.")

if __name__ == "__main__":
    try:
        migrate()
        print("Migration completed successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)
