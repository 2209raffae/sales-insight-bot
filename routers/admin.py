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


@router.get("/companies/{company_id}")
def get_company(
    company_id: int,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get a single company with its profile details (admin only)."""
    from models import Company, CompanyProfile
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Azienda non trovata")
    
    profile = db.query(CompanyProfile).filter(CompanyProfile.company_id == company_id).first()
    
    return {
        "id": company.id,
        "name": company.name,
        "description": company.description,
        "industry": profile.industry if profile else None,
        "company_size": profile.company_size if profile else None,
        "channels": profile.channels if profile else [],
        "needs": profile.needs if profile else [],
        "complexity_level": profile.complexity_level if profile else None,
        "suggested_agents": profile.suggested_agents if profile else [],
    }

# ── Active Agents CRUD ─────────────────────────────────────────────────────────

# Canonical list of valid slugs (must match NEXUS_AGENTS on the frontend)
VALID_AGENT_SLUGS = {
    "sales-insight",
    "hr-copilot",
    "competitor-radar",
    "task-force",
    "warehouse-intelligence",
    "logistics-hub",
    "crm",
}

class ActiveAgentIn(BaseModel):
    agent_slug: str
    activation_source: str = "manual"  # "manual" | "ai_suggested"


@router.get("/companies/{company_id}/active-agents")
def list_active_agents(
    company_id: int,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return all active agents for a company from the DB."""
    from models import Company, ActiveAgent
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Azienda non trovata")

    agents = db.query(ActiveAgent).filter(
        ActiveAgent.company_id == company_id,
        ActiveAgent.is_enabled == 1
    ).all()

    return [
        {
            "agent_slug": a.agent_slug,
            "activation_reason": a.activation_reason,
            "activated_at": a.activated_at.isoformat() if a.activated_at else None,
        }
        for a in agents
    ]


@router.post("/companies/{company_id}/active-agents", status_code=201)
def activate_agent(
    company_id: int,
    body: ActiveAgentIn,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Activate an agent for a company (insert or re-enable)."""
    from models import Company, ActiveAgent

    # ── Slug validation
    if body.agent_slug not in VALID_AGENT_SLUGS:
        raise HTTPException(
            status_code=422,
            detail=f"agent_slug '{body.agent_slug}' non è un agente valido. Valori ammessi: {sorted(VALID_AGENT_SLUGS)}"
        )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Azienda non trovata")

    existing = db.query(ActiveAgent).filter(
        ActiveAgent.company_id == company_id,
        ActiveAgent.agent_slug == body.agent_slug,
    ).first()

    if existing:
        existing.is_enabled = 1
        if body.activation_source == "ai_suggested":
            existing.activation_reason = "Attivato su suggerimento Nexus AI"
        else:
            existing.activation_reason = "Attivato manualmente dall'amministratore"
    else:
        reason = (
            "Attivato su suggerimento Nexus AI"
            if body.activation_source == "ai_suggested"
            else "Attivato manualmente dall'amministratore"
        )
        new_agent = ActiveAgent(
            company_id=company_id,
            agent_slug=body.agent_slug,
            is_enabled=1,
            activation_reason=reason,
        )
        db.add(new_agent)

    db.commit()
    return {"agent_slug": body.agent_slug, "is_enabled": 1, "activation_source": body.activation_source}


@router.delete("/companies/{company_id}/active-agents/{agent_slug}", status_code=200)
def deactivate_agent(
    company_id: int,
    agent_slug: str,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deactivate an agent for a company (sets is_enabled=0)."""
    from models import Company, ActiveAgent

    # ── Slug validation
    if agent_slug not in VALID_AGENT_SLUGS:
        raise HTTPException(
            status_code=422,
            detail=f"agent_slug '{agent_slug}' non è un agente valido."
        )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Azienda non trovata")

    existing = db.query(ActiveAgent).filter(
        ActiveAgent.company_id == company_id,
        ActiveAgent.agent_slug == agent_slug,
    ).first()

    if not existing:
        # Tolerate missing record — treat it as already disabled
        return {"agent_slug": agent_slug, "is_enabled": 0}

    existing.is_enabled = 0
    db.commit()
    return {"agent_slug": agent_slug, "is_enabled": 0}


# ── Agent Configuration CRUD ───────────────────────────────────────────────────

# Default configs and schemas per agent slug
AGENT_SCHEMAS: dict = {
    "sales-insight": {
        "defaults": {
            "forecast_horizon_days": 30,
            "confidence_threshold": 0.75,
            "enable_alerts": True,
            "alert_channel": "email",
            "include_seasonality": True,
        },
        "schema": {"fields": [
            {"key": "forecast_horizon_days", "type": "slider",  "label": "Orizzonte previsioni (giorni)", "description": "Quanti giorni in avanti proiettare le previsioni di vendita", "impact_hint": "Valori più alti aumentano il rischio di imprecisione ma offrono visibilità strategica più ampia", "min": 7, "max": 90, "step": 7},
            {"key": "confidence_threshold",  "type": "slider",  "label": "Soglia di confidenza",          "description": "Valore minimo di affidabilità per includere una previsione (0–1)", "impact_hint": "Abbassare la soglia mostra più previsioni ma con maggiore incertezza", "min": 0.5, "max": 1.0, "step": 0.05},
            {"key": "enable_alerts",         "type": "toggle",  "label": "Alerting vendite",              "description": "Attiva notifiche automatiche su anomalie commerciali", "impact_hint": "Disattivarlo sopprime tutte le notifiche di vendita, anche le critiche"},
            {"key": "alert_channel",         "type": "select",  "label": "Canale alert",                  "description": "Dove inviare le notifiche", "impact_hint": "Scegli il canale che il team monitora più attivamente", "options": [{"value": "email", "label": "Email"}, {"value": "slack", "label": "Slack"}, {"value": "none", "label": "Nessuno"}]},
            {"key": "include_seasonality",   "type": "toggle",  "label": "Analisi stagionalità",          "description": "Considera fattori stagionali nel modello predittivo", "impact_hint": "Consigliato per retail e food — migliora l’accuratezza nelle festività"},
        ]},
    },
    "warehouse-intelligence": {
        "defaults": {
            "reorder_threshold": 20,
            "enable_bundles": False,
            "alerts_enabled": True,
            "low_stock_days": 7,
            "sync_ecommerce": True,
        },
        "schema": {"fields": [
            {"key": "reorder_threshold", "type": "slider",  "label": "Soglia riordino (%)",         "description": "Percentuale di stock minima prima di suggerire il riordino", "impact_hint": "Valori più alti anticipano i riordini: riduce stockout ma aumenta il capitale immobilizzato", "min": 5, "max": 50, "step": 5},
            {"key": "low_stock_days",    "type": "slider",  "label": "Giorni scorta critica",       "description": "Giorni di copertura sotto cui scatta l'allerta", "impact_hint": "Alzarlo dà più preavviso ma può generare falsi positivi in periodi lenti", "min": 1, "max": 30, "step": 1},
            {"key": "alerts_enabled",    "type": "toggle",  "label": "Avvisi stock basso",          "description": "Notifica automatica quando un prodotto è sotto soglia", "impact_hint": "Disattivarlo blocca tutti gli avvisi di scorta: usa solo in ambienti test"},
            {"key": "enable_bundles",    "type": "toggle",  "label": "Bundle intelligenti",         "description": "Suggerisce combinazioni di prodotto per ottimizzare i livelli stock", "impact_hint": "Utile per ridurre l’invenduto su prodotti correlati"},
            {"key": "sync_ecommerce",    "type": "toggle",  "label": "Sync e-commerce",             "description": "Sincronizza le disponibilità con il canale e-commerce in tempo reale", "impact_hint": "Indispensabile se le vendite online sono > 20% del totale"},
        ]},
    },
    "logistics-hub": {
        "defaults": {
            "auto_assign_carrier": True,
            "priority_cutoff_hour": 14,
            "enable_delay_alerts": True,
            "tracking_refresh_minutes": 30,
            "default_carrier": "auto",
        },
        "schema": {"fields": [
            {"key": "priority_cutoff_hour",      "type": "slider",  "label": "Ora limite ordini prioritari", "description": "Ordini ricevuti dopo quest'ora sono processati il giorno successivo", "impact_hint": "Abbassarlo consente maggiore capacità di smaltimento, ma richiede un team più presente", "min": 10, "max": 18, "step": 1},
            {"key": "tracking_refresh_minutes",  "type": "slider",  "label": "Aggiornamento tracking (min)", "description": "Ogni quanti minuti aggiornare lo stato delle spedizioni", "impact_hint": "Valori più bassi offrono stato in tempo reale ma aumentano le chiamate API al corriere", "min": 5, "max": 120, "step": 5},
            {"key": "auto_assign_carrier",       "type": "toggle",  "label": "Assegnazione vettore AI",     "description": "Il sistema sceglie automaticamente il corriere ottimale", "impact_hint": "Disattivalo solo se hai accordi commerciali fissi con un singolo corriere"},
            {"key": "enable_delay_alerts",       "type": "toggle",  "label": "Alert ritardi spedizione",    "description": "Notifica quando una spedizione supera i tempi previsti", "impact_hint": "Essenziale per la customer satisfaction: consente di avvisare proattivamente il cliente"},
            {"key": "default_carrier",           "type": "select",  "label": "Vettore predefinito",         "description": "Corriere da usare quando auto-assign è disattivato", "impact_hint": "Ignorato se l'assegnazione automatica è attiva", "options": [{"value": "auto", "label": "Auto"}, {"value": "gls", "label": "GLS"}, {"value": "brt", "label": "BRT"}, {"value": "dhl", "label": "DHL"}]},
        ]},
    },
    "crm": {
        "defaults": {
            "lead_score_threshold": 60,
            "auto_followup": True,
            "followup_delay_days": 3,
            "enable_segmentation": True,
            "email_signature": "",
        },
        "schema": {"fields": [
            {"key": "lead_score_threshold", "type": "slider",   "label": "Soglia lead qualificato",   "description": "Punteggio minimo per considerare un lead qualificato (0–100)", "impact_hint": "Alzare la soglia filtra meglio ma esclude lead borderline che potrebbero convertire con nurturing", "min": 0, "max": 100, "step": 5},
            {"key": "followup_delay_days",  "type": "slider",   "label": "Giorni prima del follow-up","description": "Numero di giorni dopo cui inviare automaticamente un follow-up", "impact_hint": "3 giorni è ottimale per B2B; per e-commerce considera 1–2 giorni per ridurre l'abbandono", "min": 1, "max": 30, "step": 1},
            {"key": "auto_followup",        "type": "toggle",   "label": "Follow-up automatico",      "description": "Invia automaticamente email di follow-up ai lead non attivi", "impact_hint": "Disattivarlo richiede follow-up manuali: consigliato solo con un team sales dedicato"},
            {"key": "enable_segmentation",  "type": "toggle",   "label": "Segmentazione AI",          "description": "Classifica automaticamente i clienti per segmento comportamentale", "impact_hint": "Abilita campagne mirate per segmento — aumenta significativamente il tasso di conversione"},
            {"key": "email_signature",      "type": "text",     "label": "Firma email",               "description": "Testo da aggiungere in calce alle email automatiche", "impact_hint": "Lasciarlo vuoto usa la firma di default del sistema; personalizza per ogni azienda", "placeholder": "Cordiali saluti, il Team Sales"},
        ]},
    },
    "competitor-radar": {
        "defaults": {
            "scan_frequency_hours": 24,
            "alert_on_price_change": True,
            "price_change_threshold": 5,
            "include_social": False,
            "competitors": [],
        },
        "schema": {"fields": [
            {"key": "scan_frequency_hours",  "type": "slider", "label": "Frequenza scansione (ore)",    "description": "Ogni quante ore aggiornare i dati dei competitor", "impact_hint": "Frequenze basse = dati freschi ma più consumo API; 24h è il giusto equilibrio per la maggior parte delle aziende", "min": 6, "max": 168, "step": 6},
            {"key": "price_change_threshold","type": "slider", "label": "Soglia variazione prezzo (%)", "description": "Percentuale di variazione prezzo che attiva un alert", "impact_hint": "Valori troppo bassi generano rumore; 5% è il minimo significativo per la maggior parte dei settori", "min": 1, "max": 30, "step": 1},
            {"key": "alert_on_price_change", "type": "toggle", "label": "Alert variazioni prezzo",      "description": "Invia una notifica quando un competitor cambia i prezzi", "impact_hint": "Disattivarlo in periodi di alta volatilità (es. Black Friday) per evitare sovraccarico notifiche"},
            {"key": "include_social",        "type": "toggle", "label": "Monitoraggio social",          "description": "Include post e menzioni sui social nel Competitor Radar", "impact_hint": "Utile per brand awareness, ma può introdurre dati rumorosi in mercati B2B"},
        ]},
    },
    "hr-copilot": {
        "defaults": {
            "cv_screening_enabled": True,
            "min_match_score": 70,
            "auto_rank_candidates": True,
            "interview_reminder_days": 2,
            "language": "it",
        },
        "schema": {"fields": [
            {"key": "min_match_score",         "type": "slider", "label": "Score minimo candidati (%)",    "description": "Punteggio di compatibilità minimo per mostrare un candidato", "impact_hint": "Abbassarlo mostra più candidati ma riduce la qualità media del pool; alzarlo filtra maggiormente", "min": 0, "max": 100, "step": 5},
            {"key": "interview_reminder_days", "type": "slider", "label": "Promemoria colloquio (giorni)", "description": "Giorni prima del colloquio per inviare il promemoria automatico", "impact_hint": "1 giorno è ottimale per colloqui brevi; 3+ giorni consigliati per panel o assessment complessi", "min": 1, "max": 7, "step": 1},
            {"key": "cv_screening_enabled",    "type": "toggle", "label": "Screening CV automatico",       "description": "Analizza i CV ricevuti e li classifica per ruolo", "impact_hint": "Disattivarlo richiede revisione manuale di tutti i CV ricevuti"},
            {"key": "auto_rank_candidates",    "type": "toggle", "label": "Classifica automatica",         "description": "Ordina automaticamente i candidati per punteggio di match", "impact_hint": "Richiede screening CV attivo per funzionare correttamente"},
            {"key": "language",                "type": "select", "label": "Lingua interfaccia HR",         "description": "Lingua usata per report e comunicazioni HR", "impact_hint": "Cambiare la lingua modifica report, email e notifiche generate dall'agente", "options": [{"value": "it", "label": "Italiano"}, {"value": "en", "label": "English"}, {"value": "fr", "label": "Français"}]},
        ]},
    },
    "task-force": {
        "defaults": {
            "deadline_alert_days": 3,
            "auto_email_updates": True,
            "update_frequency": "weekly",
            "priority_auto_sort": True,
            "max_open_tasks": 50,
        },
        "schema": {"fields": [
            {"key": "deadline_alert_days", "type": "slider", "label": "Preavviso scadenza (giorni)",    "description": "Giorni prima della scadenza per inviare un alert", "impact_hint": "Valore basso = avvisi di emergenza; valore alto = pianificazione anticipata. Dipende dai cicli del tuo team", "min": 1, "max": 14, "step": 1},
            {"key": "max_open_tasks",      "type": "slider", "label": "Task aperti simultanei",         "description": "Numero massimo di task aperti contemporaneamente per team", "impact_hint": "Limitare i task attivi migliora il focus del team e riduce il context-switching", "min": 5, "max": 200, "step": 5},
            {"key": "auto_email_updates",  "type": "toggle", "label": "Aggiornamenti email automatici", "description": "Invia email di aggiornamento progetto automaticamente", "impact_hint": "Tenerlo attivo garantisce trasparenza verso i responsabili senza riunioni di aggiornamento"},
            {"key": "priority_auto_sort",  "type": "toggle", "label": "Ordinamento per priorità AI",   "description": "Ordina automaticamente i task per urgenza e impatto", "impact_hint": "Disattivarlo se il team preferisce un ordinamento manuale per progetto o cliente"},
            {"key": "update_frequency",    "type": "select", "label": "Frequenza aggiornamenti",       "description": "Con che frequenza generare il report di aggiornamento", "impact_hint": "Frequenza giornaliera è ideale per sprint veloci; settimanale per progetti a lungo termine", "options": [{"value": "daily", "label": "Giornaliero"}, {"value": "weekly", "label": "Settimanale"}, {"value": "biweekly", "label": "Bisettimanale"}]},
        ]},
    },
}


class AgentConfigIn(BaseModel):
    config: dict


@router.get("/companies/{company_id}/config/{agent_slug}")
def get_agent_config(
    company_id: int,
    agent_slug: str,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return current config, defaults, and UI schema for an agent."""
    from models import Company, ActiveAgent, AgentConfiguration

    if agent_slug not in VALID_AGENT_SLUGS:
        raise HTTPException(status_code=422, detail=f"agent_slug '{agent_slug}' non valido")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Azienda non trovata")

    schema_entry = AGENT_SCHEMAS.get(agent_slug, {"defaults": {}, "schema": {"fields": []}})
    defaults = schema_entry["defaults"]
    schema = schema_entry["schema"]

    # Find the agent row
    active_agent = db.query(ActiveAgent).filter(
        ActiveAgent.company_id == company_id,
        ActiveAgent.agent_slug == agent_slug,
    ).first()

    saved_config = {}
    audit: dict = {}
    if active_agent and active_agent.config:
        raw = active_agent.config.config_json or {}
        # Separate __audit__ envelope from real config values
        audit = raw.pop("__audit__", {})
        saved_config = raw

    # Merge: defaults ← saved overrides (excluding audit)
    merged = {**defaults, **saved_config}

    return {
        "agent_slug": agent_slug,
        "config": merged,
        "defaults": defaults,
        "schema": schema,
        "has_overrides": bool(saved_config),
        "audit": {
            "updated_at": (
                active_agent.config.updated_at.isoformat()
                if active_agent and active_agent.config and active_agent.config.updated_at
                else None
            ),
            "updated_by": audit.get("updated_by"),
        },
    }


@router.post("/companies/{company_id}/config/{agent_slug}")
def save_agent_config(
    company_id: int,
    agent_slug: str,
    body: AgentConfigIn,
    admin: UserProfile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Save (merge) agent config. Creates ActiveAgent and AgentConfiguration rows if missing."""
    from models import Company, ActiveAgent, AgentConfiguration

    if agent_slug not in VALID_AGENT_SLUGS:
        raise HTTPException(status_code=422, detail=f"agent_slug '{agent_slug}' non valido")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Azienda non trovata")

    # Ensure ActiveAgent exists (even if not yet activated)
    active_agent = db.query(ActiveAgent).filter(
        ActiveAgent.company_id == company_id,
        ActiveAgent.agent_slug == agent_slug,
    ).first()

    if not active_agent:
        active_agent = ActiveAgent(
            company_id=company_id,
            agent_slug=agent_slug,
            is_enabled=0,
            activation_reason="Configurato prima dell'attivazione",
        )
        db.add(active_agent)
        db.commit()
        db.refresh(active_agent)

    # Load or create AgentConfiguration
    agent_config = db.query(AgentConfiguration).filter(
        AgentConfiguration.active_agent_id == active_agent.id
    ).first()

    if agent_config:
        # Merge: keep existing fields, apply new overrides
        existing = agent_config.config_json or {}
        # Preserve audit envelope if already present
        audit_meta = existing.pop("__audit__", {})
        existing.update(body.config)
        # Write updated audit metadata back
        existing["__audit__"] = {
            **audit_meta,
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": admin.email if hasattr(admin, 'email') else admin.username,
        }
        agent_config.config_json = existing
        agent_config.updated_at = datetime.utcnow()
    else:
        config_with_audit = {
            **body.config,
            "__audit__": {
                "updated_at": datetime.utcnow().isoformat(),
                "updated_by": admin.email if hasattr(admin, 'email') else admin.username,
            }
        }
        agent_config = AgentConfiguration(
            active_agent_id=active_agent.id,
            config_json=config_with_audit,
        )
        db.add(agent_config)

    db.commit()
    # Return config without audit envelope
    saved = {k: v for k, v in agent_config.config_json.items() if k != "__audit__"}
    return {"agent_slug": agent_slug, "saved": True, "config": saved}


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
