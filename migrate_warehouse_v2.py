import sqlite3
import os

db_path = "app.db"

def migrate():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Adding columns to warehouse_products...")
        cursor.execute("ALTER TABLE warehouse_products ADD COLUMN location TEXT")
    except sqlite3.OperationalError as e:
        print(f"Column 'location' might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE warehouse_products ADD COLUMN width REAL DEFAULT 0.0")
    except sqlite3.OperationalError as e:
        print(f"Column 'width' might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE warehouse_products ADD COLUMN height REAL DEFAULT 0.0")
    except sqlite3.OperationalError as e:
        print(f"Column 'height' might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE warehouse_products ADD COLUMN depth REAL DEFAULT 0.0")
    except sqlite3.OperationalError as e:
        print(f"Column 'depth' might already exist: {e}")

    try:
        cursor.execute("ALTER TABLE warehouse_products ADD COLUMN is_packaging INTEGER DEFAULT 0")
    except sqlite3.OperationalError as e:
        print(f"Column 'is_packaging' might already exist: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
