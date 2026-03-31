import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL non trovata nel .env. Uso SQLite per default?")
    DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(DATABASE_URL)

def run_migration():
    commands = [
        "ALTER TABLE task_force_updates ADD COLUMN IF NOT EXISTS attachment_path TEXT;",
        "ALTER TABLE task_force_updates ADD COLUMN IF NOT EXISTS attachment_type TEXT;"
    ]
    
    with engine.connect() as connection:
        for cmd in commands:
            try:
                print(f"Eseguendo: {cmd}")
                connection.execute(text(cmd))
                connection.commit()
            except Exception as e:
                print(f"Errore nell'esecuzione del comando: {e}")

if __name__ == "__main__":
    run_migration()
    print("Migrazione completata.")
