import os
import sys
import bcrypt
from database import SessionLocal
from models import UserProfile, UserPermission

def create_admin_user():
    email = "admin@example.com"
    password = "AdminPassword2026!"
    
    db = SessionLocal()
    try:
        # Check if exists
        user = db.query(UserProfile).filter(UserProfile.email == email).first()
        if user:
            print(f"User {email} already exists.")
            return

        print(f"Creating admin user {email}...")
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        
        new_user = UserProfile(
            email=email,
            hashed_pw=hashed,
            first_name="Admin",
            last_name="Nexus",
            role="Admin",
            is_admin=1
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print(f"User created with ID: {new_user.id}")
        
        # Grant permissions
        for agent in ["sales-insight", "hr-copilot", "competitor-radar", "task-force"]:
            db.add(UserPermission(user_id=new_user.id, agent_slug=agent, module_slug=None))
        db.commit()
        print("Permissions granted.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
