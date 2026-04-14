import os
import sys
import bcrypt
from jose import jwt
from sqlalchemy.orm import Session
from database import SessionLocal
from models import UserProfile
from routers.auth import verify_password, serialize_user, create_access_token, get_user_permissions

def debug_login_logic():
    email = "admin@example.com"
    password = "AdminPassword2026!"
    
    db = SessionLocal()
    try:
        print(f"Searching for user: {email}")
        user = db.query(UserProfile).filter(UserProfile.email == email).first()
        if not user:
            print("User not found in DB.")
            return
            
        print(f"User found: {user.id}, {user.email}")
        
        print("Verifying password...")
        is_valid = verify_password(password, user.hashed_pw)
        print(f"Password valid: {is_valid}")
        
        if not is_valid:
            print("Invalid password logic.")
            return
            
        print("Getting permissions...")
        permissions = get_user_permissions(db, user.id)
        print(f"Permissions: {permissions}")
        
        print("Creating token...")
        token = create_access_token(data={"sub": str(user.id)})
        print(f"Token created: {token[:20]}...")
        
        print("Serializing user...")
        user_data = serialize_user(user, permissions)
        print(f"Serialized user: {user_data}")
        
        print("Success!")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error caught: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_login_logic()
