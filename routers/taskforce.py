import os
import resend
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import (
    TaskForceProject, TaskForceMember, TaskForceUpdate, UserProfile,
    ExpertiseCategory, UserExpertise
)
from routers.auth import get_current_user, require_admin
from ai_layer import match_problem_to_expertise

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
    attachment_path: Optional[str] = None
    attachment_type: Optional[str] = None
    created_at: datetime

class ProjectDetailOut(ProjectOut):
    members: List[MemberOut]
    updates: List[UpdateOut]

class SuggestMembersRequest(BaseModel):
    description: str

class SuggestResult(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: str
    matched_categories: List[str]


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
            "from": "Nexus Hub <onboarding@resend.dev>", 
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


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, user: UserProfile = Depends(require_admin), db: Session = Depends(get_db)):
    """Elimina un progetto (solo Admin)."""
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    db.delete(proj)
    db.commit()
    return {"detail": "Progetto eliminato"}


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


# ── WebSocket Manager ───────────────────────────────────────────────────────────
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        # project_id -> list of websockets
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: int):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: int):
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def broadcast(self, message: dict, project_id: int):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass # Connection might be closed, disconnect will handle it

manager = ConnectionManager()

@router.websocket("/ws/{project_id}")
async def taskforce_websocket_endpoint(websocket: WebSocket, project_id: int):
    # Simple check: project exists (optional but good)
    # Note: In production, verify token from query_params
    await manager.connect(websocket, project_id)
    try:
        while True:
            # We don't expect messages FROM the client, just keeping it alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)

@router.post("/suggest-members", response_model=List[SuggestResult])
def suggest_members(req: SuggestMembersRequest, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Suggerisce i membri basandosi sulla descrizione del problema e le competenze."""
    # 1. Recupera tutte le categorie
    categories = db.query(ExpertiseCategory).all()
    cat_list = [{"id": c.id, "name": c.name} for c in categories]
    
    if not cat_list:
        return []

    # 2. Chiama l'AI per mappare descrizione -> categorie
    matched_cat_ids = match_problem_to_expertise(req.description, cat_list)
    
    if not matched_cat_ids:
        return []

    # 3. Recupera gli utenti che hanno quelle competenze
    # Usiamo un join per trovare gli utenti e le loro categorie matchate
    query = db.query(UserProfile, ExpertiseCategory.name).join(
        UserExpertise, UserProfile.id == UserExpertise.user_id
    ).join(
        ExpertiseCategory, UserExpertise.category_id == ExpertiseCategory.id
    ).filter(
        ExpertiseCategory.id.in_(matched_cat_ids)
    ).all()

    # Raggruppa per utente (un utente potrebbe avere più categorie matchate)
    user_map = {}
    for u, cat_name in query:
        if u.id not in user_map:
            user_map[u.id] = {
                "user_id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "matched_categories": []
            }
        if cat_name not in user_map[u.id]["matched_categories"]:
            user_map[u.id]["matched_categories"].append(cat_name)

    return list(user_map.values())


from fastapi import File, UploadFile, Form
import shutil
import uuid

@router.post("/projects/{project_id}/updates", response_model=UpdateOut)
async def post_update(
    project_id: int, 
    content: str = Form(...), 
    file: Optional[UploadFile] = File(None),
    user: UserProfile = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Pubblica un aggiornamento (con eventuale file) e notifica in real-time."""
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Progetto non trovato")

    attachment_path = None
    attachment_type = None

    if file:
        # Crea directory se non esiste
        upload_dir = os.path.join("static", "uploads", "taskforce")
        os.makedirs(upload_dir, exist_ok=True)
        
        file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
        file_name = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(upload_dir, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        attachment_path = f"/static/uploads/taskforce/{file_name}"
        attachment_type = file.content_type

    # Aggiungi update
    update = TaskForceUpdate(
        project_id=project_id,
        author_id=user.id,
        content=content,
        attachment_path=attachment_path,
        attachment_type=attachment_type
    )
    db.add(update)
    db.commit()
    db.refresh(update)

    # Preparazione dati per broadcast ed email
    author_name = f"{user.first_name} {user.last_name}"
    update_data = {
        "id": update.id,
        "author_id": user.id,
        "author_name": author_name,
        "content": update.content,
        "attachment_path": update.attachment_path,
        "attachment_type": update.attachment_type,
        "created_at": update.created_at.isoformat()
    }

    # 1. Broadcast via WebSocket (Real-time)
    await manager.broadcast(update_data, project_id)

    # 2. Invia email in background (opzionale: potresti usare BackgroundTasks)
    members = db.query(TaskForceMember, UserProfile).join(UserProfile, TaskForceMember.user_id == UserProfile.id).filter(TaskForceMember.project_id == project_id).all()
    recipients = [p.email for m, p in members if p.id != user.id]

    if recipients:
        try:
            send_update_email(proj.name, content, author_name, recipients)
        except Exception:
            pass 

    return update_data
