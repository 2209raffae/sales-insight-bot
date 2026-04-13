import sqlite3

def run():
    print("Running migration for crm_email_rules...")
    conn = sqlite3.connect("sales_insight.db")
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS crm_email_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR NOT NULL,
            trigger_event VARCHAR NOT NULL,
            delay_hours INTEGER DEFAULT 0,
            prompt_template TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    run()
