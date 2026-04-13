from database import SessionLocal
from models import UserProfile, UserPermission
import bcrypt
import os

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def create_admin(email, password, first_name, last_name):
    db = SessionLocal()
    try:
        # Check if user exists
        existing = db.query(UserProfile).filter(UserProfile.email == email).first()
        if existing:
            print(f"L'utente {email} esiste già. Lo promuovo ad Admin e aggiorno i permessi...")
            user = existing
            user.is_admin = 1
            user.role = "Admin"
            user.hashed_pw = hash_password(password)
        else:
            user = UserProfile(
                email=email,
                hashed_pw=hash_password(password),
                first_name=first_name,
                last_name=last_name,
                role='Admin',
                is_admin=1
            )
            db.add(user)
        
        db.commit()
        db.refresh(user)
        
        # Reset and add all permissions
        db.query(UserPermission).filter(UserPermission.user_id == user.id).delete()
        
        agents = ['sales-insight', 'hr-copilot', 'competitor-radar', 'task-force', 'warehouse-intelligence', 'crm-agent']
        for agent in agents:
            db.add(UserPermission(user_id=user.id, agent_slug=agent, module_slug=None))
        
        db.commit()
        print(f"✅ Account ADMIN creato/aggiornato con successo!")
        print(f"📧 Email: {email}")
        print(f"🔑 Password: {password}")
    except Exception as e:
        print(f"❌ Errore: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    # Defaults
    email = "admin@nexus.ai"
    password = "AdminPassword2026!"
    first_name = "Nexus"
    last_name = "Admin"
    
    if len(sys.argv) > 1:
        email = sys.argv[1]
    if len(sys.argv) > 2:
        password = sys.argv[2]
        
    create_admin(email, password, first_name, last_name)
