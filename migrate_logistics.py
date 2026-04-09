from database import engine
from sqlalchemy import text, inspect
import sys

def migrate_logistics():
    print("Migrating Logistics & Order Hub tables...")
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        # Check WarehouseOrders
        if not inspector.has_table("warehouse_orders"):
            print("Creating 'warehouse_orders' table...")
            conn.execute(text("""
                CREATE TABLE warehouse_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lead_id INTEGER REFERENCES lead_records(id) ON DELETE SET NULL,
                    customer_name VARCHAR NOT NULL,
                    total_amount FLOAT DEFAULT 0.0,
                    status VARCHAR DEFAULT 'Da Preparare',
                    order_channel VARCHAR DEFAULT 'Online',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            print("Table 'warehouse_orders' created.")

        # Check OrderItems
        if not inspector.has_table("order_items"):
            print("Creating 'order_items' table...")
            conn.execute(text("""
                CREATE TABLE order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL REFERENCES warehouse_orders(id) ON DELETE CASCADE,
                    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE RESTRICT,
                    quantity INTEGER DEFAULT 1,
                    unit_price FLOAT NOT NULL
                )
            """))
            print("Table 'order_items' created.")

        # Check Shipments
        if not inspector.has_table("shipments"):
            print("Creating 'shipments' table...")
            conn.execute(text("""
                CREATE TABLE shipments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER UNIQUE REFERENCES warehouse_orders(id) ON DELETE CASCADE,
                    courier_name VARCHAR,
                    tracking_code VARCHAR,
                    shipment_status VARCHAR DEFAULT 'In elaborazione',
                    label_url VARCHAR,
                    estimated_delivery TIMESTAMP,
                    shipped_at TIMESTAMP
                )
            """))
            print("Table 'shipments' created.")

        conn.commit()
    print("Logistics migration completed successfully.")

if __name__ == "__main__":
    try:
        migrate_logistics()
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)
