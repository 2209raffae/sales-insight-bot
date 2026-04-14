"""
Admin router — CRUD for users and permissions (admin-only).
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
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

class CompanyOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None


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


@router.get("/companies", response_model=List[CompanyOut])
def list_companies(
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all companies (admin only)."""
    from models import Company
    return db.query(Company).order_by(Company.name.asc()).all()


@router.post("/setup-demo", response_model=CompanyOut)
def create_demo_company(
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a fully functional demo company with profile, agents and configs."""
    from models import Company, CompanyProfile, ActiveAgent, AgentConfiguration
    
    # 1. Create Company
    demo_name = f"Nexus Demo {datetime.now().strftime('%H%M%S')}"
    company = Company(
        name=demo_name,
        description="Azienda dimostrativa per il testing dell'Orchestratore Nexus.",
        metadata_json={
            "industry": "Retail",
            "market": "Italy",
            "type": "Demo"
        }
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    
    # 2. Create Profile
    profile = CompanyProfile(
        company_id=company.id,
        industry="Retail & Distribution",
        company_size="Medium",
        channels=["E-commerce", "Retail Store"],
        needs=["Inventory optimization", "Sales forecasting"],
        complexity_level="Medium",
        suggested_agents=["warehouse-intelligence", "sales-insight"]
    )
    db.add(profile)
    
    # 3. Create Agents
    agents = [
        ("warehouse-intelligence", "Stock monitoring and shelf life analysis"),
        ("sales-insight", "Revenue trends and customer behavior")
    ]
    
    for slug, reason in agents:
        agent = ActiveAgent(
            company_id=company.id,
            agent_slug=slug,
            is_enabled=1,
            activation_reason=reason
        )
        db.add(agent)
        db.commit()
        db.refresh(agent)
        
        # 4. Create Config
        config = AgentConfiguration(
            active_agent_id=agent.id,
            config_json={
                "temperature": 0.2,
                "max_tokens": 1000,
                "model": "llama3-70b-8192",
                "features": ["auto_summary", "data_extraction"]
            },
            use_vector_memory=0,
            retrieval_mode="none"
        )
        db.add(config)
    
    db.commit()
    db.refresh(company)
    return company
