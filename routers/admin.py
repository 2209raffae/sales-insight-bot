"""
Admin router — CRUD for users and permissions (admin-only).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from database import get_db
from models import UserProfile, UserPermission, ExpertiseCategory, UserExpertise
from routers.auth import (
    require_admin, get_user_permissions, get_user_expertise, 
    hash_password, serialize_user
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class PermissionIn(BaseModel):
    agent_slug: str
    module_slug: Optional[str] = None

class SetPermissionsRequest(BaseModel):
    permissions: List[PermissionIn]

class ExpertiseCategoryIn(BaseModel):
    name: str

class ExpertiseCategoryOut(BaseModel):
    id: int
    name: str

class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_admin: Optional[int] = None
    password: Optional[str] = None
    expertise_ids: Optional[List[int]] = None


# ── Routes: Users ─────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with their permissions and expertise."""
    users = db.query(UserProfile).order_by(UserProfile.created_at.desc()).all()
    result = []
    for u in users:
        perms = get_user_permissions(db, u.id)
        exp = get_user_expertise(db, u.id)
        result.append(serialize_user(u, perms, exp))
    return result


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    req: UpdateUserRequest,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user profile fields and expertise (admin only)."""
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

    # Expertise update
    if req.expertise_ids is not None:
        # Delete old associations
        db.query(UserExpertise).filter(UserExpertise.user_id == user_id).delete()
        # Add new ones
        for cat_id in req.expertise_ids:
            # check if category exists
            cat = db.query(ExpertiseCategory).filter(ExpertiseCategory.id == cat_id).first()
            if cat:
                db.add(UserExpertise(user_id=user_id, category_id=cat_id))

    db.commit()
    db.refresh(user)
    
    perms = get_user_permissions(db, user.id)
    exp = get_user_expertise(db, user.id)
    return serialize_user(user, perms, exp)


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
    db.query(UserExpertise).filter(UserExpertise.user_id == user_id).delete()
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


# ── Routes: Expertise Categories ─────────────────────────────────────────────

@router.get("/categories", response_model=List[ExpertiseCategoryOut])
def list_categories(
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all expertise categories."""
    return db.query(ExpertiseCategory).order_by(ExpertiseCategory.name.asc()).all()


@router.post("/categories", response_model=ExpertiseCategoryOut)
def create_category(
    req: ExpertiseCategoryIn,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new expertise category."""
    existing = db.query(ExpertiseCategory).filter(ExpertiseCategory.name == req.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Categoria già esistente")
    
    cat = ExpertiseCategory(name=req.name.strip())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a category (associations in UserExpertise are cascaded)."""
    cat = db.query(ExpertiseCategory).filter(ExpertiseCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    
    db.delete(cat)
    db.commit()
    return {"detail": "Categoria eliminata"}
