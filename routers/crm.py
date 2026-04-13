import os
import resend
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict
from pydantic import BaseModel

from database import get_db
from models import CRMCustomer, CRMAutomation, CRMEmailRule
from ai_layer import generate_crm_email

# Initialize Resend
resend.api_key = os.getenv("RESEND_API_KEY")

router = APIRouter(prefix="/api/crm", tags=["crm"])

class AutomationReq(BaseModel):
    campaign_name: str
    prompt: str

class RuleReq(BaseModel):
    name: str
    subject: str = ""
    trigger_event: str
    delay_hours: int = 0
    prompt_template: str = ""
    resend_template_id: str | None = None

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

@router.get("/rules", response_model=List[Dict])
def get_rules(db: Session = Depends(get_db)):
    rules = db.query(CRMEmailRule).order_by(CRMEmailRule.created_at.desc()).all()
    return [{
        "id": r.id,
        "name": r.name,
        "subject": r.subject or "",
        "trigger_event": r.trigger_event,
        "delay_hours": r.delay_hours,
        "prompt_template": r.prompt_template,
        "resend_template_id": r.resend_template_id,
        "is_active": bool(r.is_active),
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in rules]

@router.post("/rules")
def create_rule(req: RuleReq, db: Session = Depends(get_db)):
    rule = CRMEmailRule(
        name=req.name,
        subject=req.subject,
        trigger_event=req.trigger_event,
        delay_hours=req.delay_hours,
        prompt_template=req.prompt_template or "",
        resend_template_id=req.resend_template_id,
        is_active=1
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"message": "Regola creata con successo", "id": rule.id}

@router.put("/rules/{rule_id}/toggle")
def toggle_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(CRMEmailRule).filter(CRMEmailRule.id == rule_id).first()
    if not rule:
        return {"error": "Rule not found"}
    rule.is_active = 0 if rule.is_active == 1 else 1
    db.commit()
    return {"message": "Stato regola aggiornato", "is_active": bool(rule.is_active)}

@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(CRMEmailRule).filter(CRMEmailRule.id == rule_id).first()
    if rule:
        db.delete(rule)
        db.commit()
    return {"message": "Regola cancellata"}

def process_order_automations(db: Session, order_id: int):
    """
    Hook chiamato dal modulo Logistica subito dopo la creazione di un ordine.
    Ricerca le regole CRM per l'evento ORDER_CREATED, sostituisce le variabili in Oggetto e Template, e salva nello storico.
    """
    try:
        from models import WarehouseOrder
        order = db.query(WarehouseOrder).filter(WarehouseOrder.id == order_id).first()
        if not order: return
        
        customer = db.query(CRMCustomer).filter(CRMCustomer.phone_number == order.phone_number).first()
        if not customer: return

        # Trova flussi attivi per questo evento
        rules = db.query(CRMEmailRule).filter(
            CRMEmailRule.is_active == 1,
            CRMEmailRule.trigger_event == "ORDER_CREATED"
        ).all()
        
        # Recupera l'immagine del primo prodotto per l'anteprima/variabili
        first_img_url = ""
        if order.items:
            from models import WarehouseProductImage
            p_img = db.query(WarehouseProductImage).filter(
                WarehouseProductImage.product_id == order.items[0].product_id
            ).order_by(WarehouseProductImage.is_primary.desc()).first()
            if p_img:
                first_img_url = p_img.url

        for rule in rules:
            template = rule.prompt_template or ""
            subj = rule.subject or "[Nessun Oggetto]"
            
            # Helper testuale interno per fare REPLACE unificato
            def _inject(text: str) -> str:
                t = text.replace('{{cliente.nome_cognome}}', customer.name)
                t = t.replace('{{cliente.email}}', customer.email or '')
                t = t.replace('{{ordine.totale}}', f"€{order.total_amount:.2f}")
                t = t.replace('{{ordine.id}}', str(order.id))
                t = t.replace('{{ordine.immagine_url}}', first_img_url)
                return t
                
            # Sostituzione Variabili Dinamiche
            template = _inject(template)
            subj = _inject(subj)
            
            # Impacchetta Oggetto e Testo per la visualizzazione CRM
            final_html = f"<div class='mb-4 pb-4 border-b border-slate-700/50'><p class='text-xs text-slate-400 font-bold uppercase'>Oggetto Email</p><p class='text-white font-semibold text-lg'>{subj}</p></div>{template}"

            # Real Email Send via Resend
            status_text = "Inviato (Resend API)"
            if customer.email:
                try:
                    payload = {
                        "from": os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
                        "to": [customer.email],
                        "subject": subj,
                    }
                    
                    # Se abbiamo un Template ID nativo di Resend, usiamolo
                    if rule.resend_template_id:
                        payload["template"] = {
                            "id": rule.resend_template_id,
                            "variables": {
                                "cliente_nome": customer.name,
                                "cliente_email": customer.email,
                                "ordine_id": str(order.id),
                                "ordine_totale": f"€{order.total_amount:.2f}",
                                "ordine_immagine_url": first_img_url,
                                "data_ordine": order.created_at.strftime("%d/%m/%Y %H:%M") if order.created_at else "Oggi"
                            }
                        }
                        status_text = "Inviato (Resend Template)"
                    else:
                        # Altrimenti usa l'HTML dell'editor visuale interno
                        payload["html"] = template
                    
                    resend.Emails.send(payload)
                except Exception as e:
                    status_text = f"Errore Invio: {str(e)}"
            else:
                status_text = "Errore: Email Cliente mancante"

            # Registra l'invio nello storico campagne CRM
            auto = CRMAutomation(
                campaign_name=f"[FLOW] {rule.name}",
                prompt_used=f"Automazione Evento: ORDER_CREATED (ID Ordine: {order.id})",
                email_content=final_html,
                sent_count=1,
                status=status_text
            )
            db.add(auto)
        
        db.commit()
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
