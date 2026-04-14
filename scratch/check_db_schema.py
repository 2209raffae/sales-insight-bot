import os
from sqlalchemy import text
from database import engine

def check_db():
    try:
        with engine.connect() as conn:
            # Check tables
            print("Checking tables...")
            res = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
            tables = [r[0] for r in res]
            print(f"Tables found: {tables}")
            
            if 'user_profiles' in tables:
                print("\nColumns in user_profiles:")
                res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles'"))
                for r in res:
                    print(f" - {r[0]}: {r[1]}")
            else:
                print("\nTable user_profiles NOT FOUND!")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
