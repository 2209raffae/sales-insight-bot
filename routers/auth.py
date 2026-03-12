"""
Auth router — Registration, Login, JWT, current user info.
"""
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError

from database import get_db
from models import UserProfile, UserPermission

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ── Security config ────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "nexus-hub-super-secret-change-me-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str = "Utente"

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    is_admin: int
    permissions: list


# ── Helpers ────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user_permissions(db: Session, user_id: int) -> list:
    perms = db.query(UserPermission).filter(UserPermission.user_id == user_id).all()
    return [{"agent_slug": p.agent_slug, "module_slug": p.module_slug} for p in perms]

def serialize_user(user: UserProfile, permissions: list) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_admin": user.is_admin,
        "permissions": permissions,
    }


# ── JWT Dependency (use in protected routes) ───────────────────────────────────

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> UserProfile:
    """Extract and validate JWT → return UserProfile or raise 401."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token mancante")
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token scaduto o invalido")
    
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utente non trovato")
    return user


def require_admin(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Ensures the current user is an admin."""
    if user.is_admin != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accesso riservato agli admin")
    return user


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate email
    existing = db.query(UserProfile).filter(UserProfile.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")

    # Count existing users — first user becomes admin automatically
    user_count = db.query(UserProfile).count()

    user = UserProfile(
        email=req.email.lower().strip(),
        hashed_pw=hash_password(req.password),
        first_name=req.first_name.strip(),
        last_name=req.last_name.strip(),
        role=req.role.strip(),
        is_admin=1 if user_count == 0 else 0,  # First user = admin
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # If first user (admin), grant all permissions
    if user.is_admin == 1:
        for agent in ["sales-insight", "hr-copilot", "competitor-radar", "task-force"]:
            db.add(UserPermission(user_id=user.id, agent_slug=agent, module_slug=None))
        db.commit()

    permissions = get_user_permissions(db, user.id)
    token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=token,
        user=serialize_user(user, permissions),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserProfile).filter(UserProfile.email == req.email.lower().strip()).first()
    
    if not user or not verify_password(req.password, user.hashed_pw):
        raise HTTPException(status_code=401, detail="Email o password errati")
    
    permissions = get_user_permissions(db, user.id)
    token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=token,
        user=serialize_user(user, permissions),
    )


@router.get("/me")
def get_me(
    user: UserProfile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    permissions = get_user_permissions(db, user.id)
    return serialize_user(user, permissions)
