from database import SessionLocal, engine, run_migrations
from models import UserProfile, UserPermission, Base
import bcrypt

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def create_admin():
    db = SessionLocal()
    # Check if user exists
    existing = db.query(UserProfile).filter(UserProfile.email == 'test@example.com').first()
    if existing:
        print("User exists, updating permissions...")
        user = existing
    else:
        user = UserProfile(
            email='test@example.com',
            hashed_pw=hash_password('password123'),
            first_name='Test',
            last_name='User',
            role='Admin',
            is_admin=1
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Delete old permissions to avoid duplicates
    db.query(UserPermission).filter(UserPermission.user_id == user.id).delete()
    
    for agent in ['sales-insight', 'hr-copilot', 'competitor-radar', 'task-force', 'warehouse-intelligence']:
        db.add(UserPermission(user_id=user.id, agent_slug=agent, module_slug=None))
    db.commit()
    print("Test admin user created: test@example.com / password123")
    db.close()

if __name__ == "__main__":
    create_admin()
