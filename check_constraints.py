import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def check_postgres_constraints():
    if not DATABASE_URL.startswith("postgresql"):
        print("Not using Postgres, skipping constraint check.")
        return

    query = """
    SELECT 
        tc.table_name, 
        kcu.column_name, 
        tc.constraint_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('user_permissions', 'task_force_projects', 'task_force_updates');
    """
    
    with engine.connect() as conn:
        result = conn.execute(text(query))
        for row in result:
            print(f"Table: {row[0]}, Column: {row[1]}, Name: {row[2]} -> {row[3]}({row[4]})")

if __name__ == "__main__":
    check_postgres_constraints()
