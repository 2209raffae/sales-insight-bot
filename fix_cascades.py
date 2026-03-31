import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def fix_cascades():
    if not DATABASE_URL.startswith("postgresql"):
        print("Not using Postgres, skipping CASCADE fix. (In SQLite, CASCADE is handled differently or not enforced by default).")
        return

    # List of tables and their foreign key columns that need ON DELETE CASCADE
    targets = [
        ("user_permissions", "user_id", "user_profiles", "id"),
        ("task_force_projects", "created_by", "user_profiles", "id"),
        ("task_force_updates", "author_id", "user_profiles", "id")
    ]

    with engine.begin() as conn:
        for table, col, ref_table, ref_col in targets:
            print(f"Fixing {table}.{col} -> {ref_table}.{ref_col}...")
            
            # 1. Find the constraint name
            find_q = text(f"""
                SELECT constraint_name 
                FROM information_schema.key_column_usage 
                   WHERE table_name = :table 
                   AND column_name = :col 
                   AND table_schema = 'public'
            """)
            result = conn.execute(find_q, {"table": table, "col": col}).fetchone()
            
            if result:
                constraint_name = result[0]
                print(f"  Found constraint: {constraint_name}. Updating to CASCADE...")
                
                # 2. Drop the existing constraint
                conn.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT \"{constraint_name}\""))
                
                # 3. Add it back with ON DELETE CASCADE
                conn.execute(text(f"""
                    ALTER TABLE {table} 
                    ADD CONSTRAINT \"{constraint_name}\" 
                    FOREIGN KEY ({col}) REFERENCES {ref_table}({ref_col}) 
                    ON DELETE CASCADE
                """))
                print(f"  Successfully updated {table} with ON DELETE CASCADE.")
            else:
                print(f"  No constraint found for {table}.{col}. Skipping.")

if __name__ == "__main__":
    try:
        fix_cascades()
        print("\nAll CASCADE constraints updated successfully.")
    except Exception as e:
        print(f"\nError during migration: {e}")
