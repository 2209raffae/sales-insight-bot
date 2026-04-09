from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict
from pydantic import BaseModel

from database import get_db
from models import CRMCustomer, CRMAutomation
from ai_layer import generate_crm_email

router = APIRouter(prefix="/api/crm", tags=["crm"])

class AutomationReq(BaseModel):
    campaign_name: str
    prompt: str

@router.get("/customers", response_model=List[Dict])
def get_customers(db: Session = Depends(get_db)):
    customers = db.query(CRMCustomer).order_by(CRMCustomer.last_purchase_date.desc().nulls_last(), CRMCustomer.total_spent.desc()).all()
    
    return [
        {
            "id": c.id,
            "phone_number": c.phone_number,
            "name": c.name,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "email": c.email,
            "address": c.address,
            "street": c.street,
            "city": c.city,
            "zip_code": c.zip_code,
            "province": c.province,
            "country": c.country,
            "total_spent": c.total_spent,
            "orders_count": c.orders_count,
            "last_purchase_date": c.last_purchase_date.isoformat() if c.last_purchase_date else None,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in customers
    ]

@router.get("/automations", response_model=List[Dict])
def get_automations(db: Session = Depends(get_db)):
    automations = db.query(CRMAutomation).order_by(CRMAutomation.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "campaign_name": a.campaign_name,
            "prompt_used": a.prompt_used,
            "email_content": a.email_content,
            "sent_count": a.sent_count,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in automations
    ]

@router.post("/automations")
def run_automation(req: AutomationReq, db: Session = Depends(get_db)):
    # 1. Genera l'email basata sul prompt dell'utente
    customers_count = db.query(CRMCustomer).count()
    
    email_html = generate_crm_email(
        prompt=req.prompt,
        target_audience=f"Clienti B2C e B2B ({customers_count} contatti attivi)",
        context="Azienda di e-commerce tech. I clienti hanno già fatto acquisti in passato."
    )

    # 2. Registra la campagna
    automation = CRMAutomation(
        campaign_name=req.campaign_name,
        prompt_used=req.prompt,
        email_content=email_html,
        sent_count=customers_count,
        status="Completato"  # Simulazione di invio immediato completato
    )
    
    db.add(automation)
    db.commit()
    db.refresh(automation)
    
    return {
        "message": "Automazione generata e inviata con successo.",
        "campaign_id": automation.id,
        "sent_count": customers_count
    }
