"""
Admin router — CRUD for users and permissions (admin-only).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from models import UserProfile, UserPermission
from routers.auth import require_admin, get_user_permissions, hash_password

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class PermissionIn(BaseModel):
    agent_slug: str
    module_slug: Optional[str] = None

class SetPermissionsRequest(BaseModel):
    permissions: List[PermissionIn]

class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_admin: Optional[int] = None
    password: Optional[str] = None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with their permissions."""
    users = db.query(UserProfile).order_by(UserProfile.created_at.desc()).all()
    result = []
    for u in users:
        perms = get_user_permissions(db, u.id)
        result.append({
            "id": u.id,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role,
            "is_admin": u.is_admin,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "permissions": perms,
        })
    return result


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    req: UpdateUserRequest,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user profile fields (admin only)."""
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    if req.first_name is not None:
        user.first_name = req.first_name.strip()
    if req.last_name is not None:
        user.last_name = req.last_name.strip()
    if req.role is not None:
        user.role = req.role.strip()
    if req.is_admin is not None:
        user.is_admin = req.is_admin
    if req.password is not None and req.password.strip():
        user.hashed_pw = hash_password(req.password)

    db.commit()
    db.refresh(user)
    perms = get_user_permissions(db, user.id)
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_admin": user.is_admin,
        "permissions": perms,
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a user and all their permissions."""
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Can't delete yourself
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Non puoi eliminare te stesso")

    db.query(UserPermission).filter(UserPermission.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"detail": "Utente eliminato"}


@router.put("/users/{user_id}/permissions")
def set_permissions(
    user_id: int,
    req: SetPermissionsRequest,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Replace all permissions for a user (full overwrite)."""
    user = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    # Delete existing permissions
    db.query(UserPermission).filter(UserPermission.user_id == user_id).delete()

    # Insert new ones
    for p in req.permissions:
        db.add(UserPermission(
            user_id=user_id,
            agent_slug=p.agent_slug,
            module_slug=p.module_slug,
        ))

    db.commit()
    return get_user_permissions(db, user_id)
