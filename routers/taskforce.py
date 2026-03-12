import os
import resend
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import TaskForceProject, TaskForceMember, TaskForceUpdate, UserProfile
from routers.auth import get_current_user

router = APIRouter(prefix="/api/taskforce", tags=["Task Force Manager"])

# Confing Resend
resend.api_key = os.getenv("RESEND_API_KEY")

# ── Schemas ────────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: str
    created_at: datetime
    created_by: int

class MemberAdd(BaseModel):
    user_id: int
    role: str = "Membro"

class MemberOut(BaseModel):
    id: int
    user_id: int
    role: str
    first_name: str
    last_name: str
    email: str

class UpdateCreate(BaseModel):
    content: str

class ProjectStatusUpdate(BaseModel):
    status: str # "attivo", "completato", "sospeso"

class UpdateOut(BaseModel):
    id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime

class ProjectDetailOut(ProjectOut):
    members: List[MemberOut]
    updates: List[UpdateOut]


# ── Helpers ────────────────────────────────────────────────────────────────────

def send_update_email(project_name: str, update_content: str, author_name: str, recipients: List[str]):
    """Send an email notification via Resend to all project members."""
    if not resend.api_key or not recipients:
        return # Skip if no API key or no recipients

    try:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #10b981; padding: 20px; text-align: center; color: white;">
                <h2 style="margin: 0;">Task Force Update</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Project: <strong>{project_name}</strong></p>
            </div>
            <div style="padding: 30px; background-color: #ffffff;">
                <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                    <strong>{author_name}</strong> ha pubblicato un nuovo aggiornamento:
                </p>
                <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; border-radius: 4px; color: #334155; white-space: pre-wrap;">
{update_content}
                </div>
                <div style="margin-top: 30px; text-align: center;">
                    <a href="https://sales-insight-bot.onrender.com/task-force" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold;">Vai alla Dashboard</a>
                </div>
            </div>
            <div style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
                Nexus Hub &bull; Notifica Automatica
            </div>
        </div>
        """
        
        # Invia l'email batch o singola. Per test usiamo uno per uno, oppure bcc se Resend lo supporta facilmente.
        # Resend permette di inviare a un array di To, ma i destinatari vedranno gli altri.
        # È meglio inviare individualmente o usare BCC. Usiamo To per il primo e Bcc per gli altri.
        
        # NOTA: Per un account free di Resend potrebbero esserci restrizioni sui domini verificati. 
        # Assicurati di usare l'email verificata sul tuo account come "From".
        # Es: "onboarding@resend.dev" se non hai un dominio personalizzato configurato regolarmente.
        
        params = {
            "from": "Nexus Hub <onboarding@resend.dev>", # Adjust this depending on your Resend setup
            "to": recipients,
            "subject": f"[{project_name}] Nuovo Aggiornamento Task Force",
            "html": html_content
        }
        resend.Emails.send(params)
    except Exception as e:
        print(f"Errore invio email Resend: {e}")


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=List[ProjectOut])
def get_projects(user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ritorna i progetti a cui l'utente partecipa, o tutti se è admin."""
    if user.is_admin == 1:
        projects = db.query(TaskForceProject).order_by(TaskForceProject.created_at.desc()).all()
    else:
        # Seleziona i progetti dove l'utente è membro
        member_project_ids = db.query(TaskForceMember.project_id).filter(TaskForceMember.user_id == user.id).subquery()
        projects = db.query(TaskForceProject).filter(TaskForceProject.id.in_(member_project_ids)).order_by(TaskForceProject.created_at.desc()).all()
    return projects


@router.get("/operators", response_model=List[dict])
def list_available_operators(user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ritorna una lista base di utenti che possono essere aggiunti a una task force."""
    # Qualunque utente autenticato può vedere la lista basi degli altri utenti per invitarli
    users = db.query(UserProfile).all()
    return [{"id": u.id, "first_name": u.first_name, "last_name": u.last_name, "email": u.email} for u in users]


@router.post("/projects", response_model=ProjectOut)
def create_project(req: ProjectCreate, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Crea un nuovo progetto e aggiunge il creatore come Leader."""
    proj = TaskForceProject(
        name=req.name,
        description=req.description,
        created_by=user.id
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)

    # Aggiungi creatore come Leader
    member = TaskForceMember(
        project_id=proj.id,
        user_id=user.id,
        role="Leader"
    )
    db.add(member)
    db.commit()

    return proj


@router.get("/projects/{project_id}", response_model=ProjectDetailOut)
def get_project_detail(project_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ritorna i dettagli, i membri e gli updates del progetto."""
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Progetto non trovato")

    # Verifica accesso
    if user.is_admin != 1:
        is_member = db.query(TaskForceMember).filter(TaskForceMember.project_id == project_id, TaskForceMember.user_id == user.id).first()
        if not is_member:
            raise HTTPException(status_code=403, detail="Non fai parte di questo progetto")

    # Estrai membri joinando UserProfile
    members = db.query(TaskForceMember, UserProfile).join(UserProfile, TaskForceMember.user_id == UserProfile.id).filter(TaskForceMember.project_id == project_id).all()
    member_list = [
        MemberOut(
            id=m.id,
            user_id=p.id,
            role=m.role,
            first_name=p.first_name,
            last_name=p.last_name,
            email=p.email
        )
        for m, p in members
    ]

    # Estrai updates joinando UserProfile
    updates = db.query(TaskForceUpdate, UserProfile).join(UserProfile, TaskForceUpdate.author_id == UserProfile.id).filter(TaskForceUpdate.project_id == project_id).order_by(TaskForceUpdate.created_at.desc()).all()
    update_list = [
        UpdateOut(
            id=u.id,
            author_id=p.id,
            author_name=f"{p.first_name} {p.last_name}",
            content=u.content,
            created_at=u.created_at
        )
        for u, p in updates
    ]

    return ProjectDetailOut(
        id=proj.id,
        name=proj.name,
        description=proj.description,
        status=proj.status,
        created_at=proj.created_at,
        created_by=proj.created_by,
        members=member_list,
        updates=update_list
    )


@router.put("/projects/{project_id}/status", response_model=ProjectOut)
def update_project_status(project_id: int, req: ProjectStatusUpdate, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Aggiorna lo stato del progetto (solo Admin o Leader)."""
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Progetto non trovato")

    # Verifica permessi
    if user.is_admin != 1:
        is_leader = db.query(TaskForceMember).filter(
            TaskForceMember.project_id == project_id,
            TaskForceMember.user_id == user.id,
            TaskForceMember.role == "Leader"
        ).first()
        if not is_leader:
            raise HTTPException(status_code=403, detail="Non hai i permessi per modificare lo stato di questo progetto")

    if req.status not in ["attivo", "completato", "sospeso"]:
        raise HTTPException(status_code=400, detail="Stato non valido")

    proj.status = req.status
    db.commit()
    db.refresh(proj)
    return proj


@router.post("/projects/{project_id}/members", response_model=MemberOut)
def add_member(project_id: int, req: MemberAdd, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Aggiunge un membro al progetto (solo admin o chi e' gia membro puo invitare)."""
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Progetto non trovato")

    # Verifica se l'utente che invita e' Admin o Leader del progetto
    if user.is_admin != 1:
        is_leader = db.query(TaskForceMember).filter(
            TaskForceMember.project_id == project_id, 
            TaskForceMember.user_id == user.id,
            TaskForceMember.role == "Leader"
        ).first()
        if not is_leader:
            raise HTTPException(status_code=403, detail="Solo l'Admin o il Leader del progetto possono aggiungere membri")

    # Controllo esistenza user da invitare
    target_user = db.query(UserProfile).filter(UserProfile.id == req.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utente da invitare non trovato")

    # Duplicate check
    existing = db.query(TaskForceMember).filter(TaskForceMember.project_id == project_id, TaskForceMember.user_id == req.user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="L'utente è già membro del progetto")

    member = TaskForceMember(
        project_id=project_id,
        user_id=req.user_id,
        role=req.role
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return MemberOut(
        id=member.id,
        user_id=target_user.id,
        role=member.role,
        first_name=target_user.first_name,
        last_name=target_user.last_name,
        email=target_user.email
    )

@router.delete("/projects/{project_id}/members/{user_id}")
def remove_member(project_id: int, user_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Rimuove un membro."""
    member = db.query(TaskForceMember).filter(TaskForceMember.project_id == project_id, TaskForceMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato in questo progetto")
    db.delete(member)
    db.commit()
    return {"detail": "Membro rimosso"}


@router.post("/projects/{project_id}/updates", response_model=UpdateOut)
def post_update(project_id: int, req: UpdateCreate, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Pubblica un aggiornamento e notifica via email tutti i membri."""
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Progetto non trovato")

    # Aggiungi update
    update = TaskForceUpdate(
        project_id=project_id,
        author_id=user.id,
        content=req.content
    )
    db.add(update)
    db.commit()
    db.refresh(update)

    # Invia email a tutti i membri tranne l'autore
    members = db.query(TaskForceMember, UserProfile).join(UserProfile, TaskForceMember.user_id == UserProfile.id).filter(TaskForceMember.project_id == project_id).all()
    recipients = [p.email for m, p in members if p.id != user.id]

    if recipients:
        author_name = f"{user.first_name} {user.last_name}"
        send_update_email(proj.name, req.content, author_name, recipients)

    return UpdateOut(
        id=update.id,
        author_id=user.id,
        author_name=f"{user.first_name} {user.last_name}",
        content=update.content,
        created_at=update.created_at
    )
