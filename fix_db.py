from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Checking taskforce_updates table...")
        # Check for attachment_path
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'taskforce_updates' AND column_name = 'attachment_path'"))
        if not res.fetchone():
            print("Adding attachment_path column...")
            conn.execute(text("ALTER TABLE taskforce_updates ADD COLUMN attachment_path TEXT"))
            conn.commit()
        else:
            print("attachment_path already exists.")

        # Check for attachment_type
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'taskforce_updates' AND column_name = 'attachment_type'"))
        if not res.fetchone():
            print("Adding attachment_type column...")
            conn.execute(text("ALTER TABLE taskforce_updates ADD COLUMN attachment_type TEXT"))
            conn.commit()
        else:
            print("attachment_type already exists.")

if __name__ == "__main__":
    try:
        migrate()
        print("Migration completed successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")
