import os
import resend
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import shutil
import uuid

from database import get_db
from models import (
    TaskForceProject, TaskForceMember, TaskForceUpdate, UserProfile,
    ExpertiseCategory, UserExpertise, TaskForceTodo
)
from routers.auth import get_current_user, require_admin
from ai_layer import match_problem_to_expertise, generate_sitrep

router = APIRouter(prefix="/api/taskforce", tags=["Task Force Manager"])

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
    briefing_md: Optional[str] = None

class BriefingUpdate(BaseModel):
    briefing_md: str

class SITREPResponse(BaseModel):
    sitrep: str

class SuggestMembersRequest(BaseModel):
    description: str

class SuggestResult(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: str
    matched_categories: List[str]

class TodoCreate(BaseModel):
    content: str
    assigned_to: Optional[int] = None

class TodoOut(BaseModel):
    id: int
    project_id: int
    content: str
    assigned_to: Optional[int]
    is_done: int
    created_at: datetime


# ── Helpers ────────────────────────────────────────────────────────────────────

def send_update_email(project_name: str, update_content: str, author_name: str, recipients: List[str]):
    resend.api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL", "Nexus Hub <onboarding@resend.dev>")
    if not resend.api_key or not recipients: return 
    
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
            <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; border-radius: 4px; color: #334155; white-space: pre-wrap;">{update_content}</div>
        </div>
    </div>
    """
    is_testing_domain = "onboarding@resend.dev" in from_email
    for email in recipients:
        try:
            if is_testing_domain and email != "2209raffae@gmail.com": continue
            resend.Emails.send({"from": from_email, "to": [email], "subject": f"[{project_name}] Aggiornamento", "html": html_content})
        except: pass

def send_creation_email(project_name: str, creator_name: str, recipients: List[str]):
    resend.api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL", "Nexus Hub <onboarding@resend.dev>")
    if not resend.api_key or not recipients: return
    html_content = f"<div style='color:white; background:#0f172a; padding:20px;'><h1>Missione Inizializzata: {project_name}</h1><p>Ciao {creator_name}, la missione è ora operativa.</p></div>"
    is_testing_domain = "onboarding@resend.dev" in from_email
    for email in recipients:
        try:
            if is_testing_domain and email != "2209raffae@gmail.com": continue
            resend.Emails.send({"from": from_email, "to": [email], "subject": f"🚀 Task Force: {project_name}", "html": html_content})
        except: pass

def send_status_email(project_name: str, new_status: str, recipients: List[str]):
    resend.api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL", "Nexus Hub <onboarding@resend.dev>")
    if not resend.api_key or not recipients: return
    color = "#10b981" if new_status=="attivo" else "#3b82f6"
    html_content = f"<div style='text-align:center;'><h2>Stato Aggiornato: {new_status}</h2><p>Progetto: {project_name}</p></div>"
    is_testing_domain = "onboarding@resend.dev" in from_email
    for email in recipients:
        try:
            if is_testing_domain and email != "2209raffae@gmail.com": continue
            resend.Emails.send({"from": from_email, "to": [email], "subject": f"[{project_name}] Stato: {new_status.upper()}", "html": html_content})
        except: pass

# ── WebSocket Manager ───────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, List[WebSocket]] = {}
    async def connect(self, websocket: WebSocket, project_id: int):
        await websocket.accept()
        if project_id not in self.active_connections: self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
    def disconnect(self, websocket: WebSocket, project_id: int):
        if project_id in self.active_connections:
            if websocket in self.active_connections[project_id]:
                self.active_connections[project_id].remove(websocket)
            if not self.active_connections[project_id]: del self.active_connections[project_id]
    async def broadcast(self, message: dict, project_id: int):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                try: await connection.send_json(message)
                except: pass

manager = ConnectionManager()

@router.websocket("/ws/{project_id}")
async def taskforce_websocket_endpoint(websocket: WebSocket, project_id: int):
    await manager.connect(websocket, project_id)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect: manager.disconnect(websocket, project_id)

# ── Project Routes ─────────────────────────────────────────────────────────────

@router.get("/projects", response_model=List[ProjectOut])
def get_projects(user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.is_admin == 1:
        return db.query(TaskForceProject).order_by(TaskForceProject.created_at.desc()).all()
    member_project_ids = db.query(TaskForceMember.project_id).filter(TaskForceMember.user_id == user.id).subquery()
    return db.query(TaskForceProject).filter(TaskForceProject.id.in_(member_project_ids)).order_by(TaskForceProject.created_at.desc()).all()

@router.get("/operators", response_model=List[dict])
def list_available_operators(user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(UserProfile).all()
    return [{"id": u.id, "first_name": u.first_name, "last_name": u.last_name, "email": u.email} for u in users]

@router.post("/projects", response_model=ProjectOut)
def create_project(req: ProjectCreate, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    proj = TaskForceProject(name=req.name, description=req.description, created_by=user.id)
    db.add(proj)
    db.commit()
    db.refresh(proj)
    db.add(TaskForceMember(project_id=proj.id, user_id=user.id, role="Leader"))
    db.commit()
    if user.email: send_creation_email(proj.name, user.first_name or user.email, [user.email])
    return proj

@router.get("/projects/{project_id}", response_model=ProjectDetailOut)
def get_project_detail(project_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Progetto non trovato")
    if user.is_admin != 1:
        if not db.query(TaskForceMember).filter(TaskForceMember.project_id == project_id, TaskForceMember.user_id == user.id).first():
            raise HTTPException(status_code=403, detail="Accesso negato")
    
    members = db.query(TaskForceMember, UserProfile).join(UserProfile, TaskForceMember.user_id == UserProfile.id).filter(TaskForceMember.project_id == project_id).all()
    updates = db.query(TaskForceUpdate, UserProfile).join(UserProfile, TaskForceUpdate.author_id == UserProfile.id).filter(TaskForceUpdate.project_id == project_id).order_by(TaskForceUpdate.created_at.asc()).all()
    
    return ProjectDetailOut(
        **proj.__dict__,
        members=[MemberOut(id=m.id, user_id=p.id, role=m.role, first_name=p.first_name, last_name=p.last_name, email=p.email) for m, p in members],
        updates=[UpdateOut(id=u.id, author_id=p.id, author_name=f"{p.first_name} {p.last_name}", content=u.content, attachment_path=u.attachment_path, attachment_type=u.attachment_type, created_at=u.created_at) for u, p in updates]
    )

@router.put("/projects/{project_id}/status", response_model=ProjectOut)
def update_project_status(project_id: int, req: ProjectStatusUpdate, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if not proj: raise HTTPException(status_code=404, detail="Progetto non trovato")
    if user.is_admin != 1 and user.id != proj.created_by:
        if not db.query(TaskForceMember).filter(TaskForceMember.project_id==project_id, TaskForceMember.user_id==user.id, TaskForceMember.role=="Leader").first():
            raise HTTPException(status_code=403, detail="Permessi insufficienti")
    proj.status = req.status
    db.commit()
    if req.status in ["completato", "sospeso"]:
        emails = [r[0] for r in db.query(UserProfile.email).join(TaskForceMember).filter(TaskForceMember.project_id == project_id).all() if r[0]]
        if emails: send_status_email(proj.name, req.status, emails)
    return proj

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, user: UserProfile = Depends(require_admin), db: Session = Depends(get_db)):
    proj = db.query(TaskForceProject).filter(TaskForceProject.id == project_id).first()
    if proj:
        db.delete(proj)
        db.commit()
    return {"detail": "Progetto eliminato"}

# ── Member Routes ─────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/members", response_model=MemberOut)
def add_member(project_id: int, req: MemberAdd, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.is_admin != 1:
        if not db.query(TaskForceMember).filter(TaskForceMember.project_id==project_id, TaskForceMember.user_id==user.id, TaskForceMember.role=="Leader").first():
            raise HTTPException(status_code=403, detail="Solo Leader o Admin")
    target = db.query(UserProfile).filter(UserProfile.id == req.user_id).first()
    if not target: raise HTTPException(status_code=404, detail="Utente non trovato")
    if db.query(TaskForceMember).filter(TaskForceMember.project_id == project_id, TaskForceMember.user_id == req.user_id).first():
        raise HTTPException(status_code=400, detail="Gia membro")
    mem = TaskForceMember(project_id=project_id, user_id=req.user_id, role=req.role)
    db.add(mem); db.commit(); db.refresh(mem)
    if target.email: send_creation_email(db.query(TaskForceProject).get(project_id).name, target.first_name, [target.email])
    return MemberOut(id=mem.id, user_id=target.id, role=mem.role, first_name=target.first_name, last_name=target.last_name, email=target.email)

@router.delete("/projects/{project_id}/members/{user_id}")
def remove_member(project_id: int, user_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    mem = db.query(TaskForceMember).filter(TaskForceMember.project_id == project_id, TaskForceMember.user_id == user_id).first()
    if mem: db.delete(mem); db.commit()
    return {"detail": "Membro rimosso"}

@router.post("/suggest-members", response_model=List[SuggestResult])
def suggest_members(req: SuggestMembersRequest, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    cat_list = [{"id": c.id, "name": c.name} for c in db.query(ExpertiseCategory).all()]
    matched_ids = match_problem_to_expertise(req.description, cat_list)
    if not matched_ids: return []
    from models import UserPermission
    query = db.query(UserProfile, ExpertiseCategory.name).join(UserExpertise).join(ExpertiseCategory).outerjoin(UserPermission).filter(
        ExpertiseCategory.id.in_(matched_ids), ((UserPermission.agent_slug == 'task-force') | (UserProfile.is_admin == 1))
    ).all()
    user_map = {}
    for u, cat in query:
        if u.id not in user_map: user_map[u.id] = {"user_id": u.id, "first_name": u.first_name, "last_name": u.last_name, "email": u.email, "matched_categories": []}
        if cat not in user_map[u.id]["matched_categories"]: user_map[u.id]["matched_categories"].append(cat)
    return list(user_map.values())

# ── Update & Todo Routes ──────────────────────────────────────────────────────

@router.post("/projects/{project_id}/updates", response_model=UpdateOut)
async def post_update(project_id: int, content: str = Form(""), file: Optional[UploadFile] = File(None), user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    proj = db.query(TaskForceProject).get(project_id)
    if not proj: raise HTTPException(status_code=404)
    path, mtype = None, None
    if file:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in {'.png', '.jpg', '.jpeg', '.pdf', '.docx', '.xlsx', '.txt', '.zip'}: raise HTTPException(status_code=400, detail="File non supportato")
        os.makedirs("static/uploads/taskforce", exist_ok=True)
        fname = f"{uuid.uuid4()}{ext}"
        path = f"/static/uploads/taskforce/{fname}"
        with open(f"static/uploads/taskforce/{fname}", "wb") as b: shutil.copyfileobj(file.file, b)
        mtype = file.content_type
    upd = TaskForceUpdate(project_id=project_id, author_id=user.id, content=content, attachment_path=path, attachment_type=mtype)
    db.add(upd); db.commit(); db.refresh(upd)
    data = {"id": upd.id, "author_id": user.id, "author_name": f"{user.first_name} {user.last_name}", "content": upd.content, "attachment_path": upd.attachment_path, "attachment_type": upd.attachment_type, "created_at": upd.created_at.isoformat()}
    await manager.broadcast(data, project_id)
    return data

@router.get("/projects/{project_id}/tasks", response_model=List[TodoOut])
def get_tasks(project_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(TaskForceTodo).filter(TaskForceTodo.project_id == project_id).order_by(TaskForceTodo.created_at.asc()).all()

@router.post("/projects/{project_id}/tasks", response_model=TodoOut)
async def create_task(project_id: int, req: TodoCreate, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    todo = TaskForceTodo(project_id=project_id, content=req.content, assigned_to=req.assigned_to)
    db.add(todo); db.commit(); db.refresh(todo)
    await manager.broadcast({"type": "todo_new", "data": {**todo.__dict__, "created_at": todo.created_at.isoformat()}}, project_id)
    return todo

@router.patch("/tasks/{task_id}/toggle", response_model=TodoOut)
async def toggle_task(task_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    todo = db.query(TaskForceTodo).get(task_id)
    if not todo: raise HTTPException(404)
    todo.is_done = 1 if todo.is_done == 0 else 0
    db.commit()
    await manager.broadcast({"type": "todo_update", "data": {"id": todo.id, "is_done": todo.is_done}}, todo.project_id)
    return todo

@router.put("/projects/{project_id}/briefing", response_model=ProjectOut)
def update_briefing(project_id: int, req: BriefingUpdate, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    proj = db.query(TaskForceProject).get(project_id)
    if not proj: raise HTTPException(404)
    proj.briefing_md = req.briefing_md
    db.commit(); db.refresh(proj)
    return proj

@router.post("/projects/{project_id}/sitrep", response_model=SITREPResponse)
def get_sitrep(project_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    proj = db.query(TaskForceProject).get(project_id)
    if not proj: raise HTTPException(404)
    upds = db.query(TaskForceUpdate, UserProfile).join(UserProfile, TaskForceUpdate.author_id == UserProfile.id).filter(TaskForceUpdate.project_id == project_id).order_by(TaskForceUpdate.created_at.desc()).limit(50).all()
    tasks = db.query(TaskForceTodo).filter(TaskForceTodo.project_id == project_id).all()
    
    upd_data = [{"author_name": f"{p.first_name} {p.last_name}", "content": u.content, "created_at": u.created_at.isoformat()} for u, p in upds]
    task_data = [{"content": t.content, "is_done": t.is_done == 1} for t in tasks]
    
    try:
        report = generate_sitrep(proj.name, proj.description or "", upd_data, task_data)
        return {"sitrep": report}
    except Exception as e:
        raise HTTPException(500, detail=str(e))
