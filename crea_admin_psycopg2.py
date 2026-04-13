import os
from dotenv import load_dotenv
import psycopg2
import bcrypt

load_dotenv()
url = os.getenv("DATABASE_URL")
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql://", 1)

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def run():
    print("Connecting to DB...")
    conn = psycopg2.connect(url, connect_timeout=10)
    cur = conn.cursor()
    print("Searching for user...")
    email = "admin@nexus.ai"
    password = "AdminPassword2026!"
    pw_hash = hash_password(password)
    
    cur.execute("SELECT id FROM user_profiles WHERE email = %s", (email,))
    row = cur.fetchone()
    
    if row:
        print("Updating existing user...")
        cur.execute("UPDATE user_profiles SET hashed_pw = %s, is_admin = 1, role = 'Admin' WHERE email = %s", (pw_hash, email))
        user_id = row[0]
    else:
        print("Inserting new user...")
        cur.execute("INSERT INTO user_profiles (email, hashed_pw, first_name, last_name, role, is_admin) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                    (email, pw_hash, "Nexus", "Admin", "Admin", 1))
        user_id = cur.fetchone()[0]
    
    print("Assigning permissions...")
    agents = ['sales-insight', 'hr-copilot', 'competitor-radar', 'task-force', 'warehouse-intelligence', 'crm-agent']
    cur.execute("DELETE FROM user_permissions WHERE user_id = %s", (user_id,))
    for agent in agents:
        cur.execute("INSERT INTO user_permissions (user_id, agent_slug) VALUES (%s, %s)", (user_id, agent))
    
    conn.commit()
    print(f"✅ Created/Updated Admin: {email} / {password}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    run()
