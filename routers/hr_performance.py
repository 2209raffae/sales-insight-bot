from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from pydantic import BaseModel
from typing import List

from database import get_db
from models import LeadRecord
from hr_ai_layer import analyze_performance

router = APIRouter(prefix="/api/hr", tags=["HR Performance"])

class EmployeeStats(BaseModel):
    id: int
    name: str
    department: str
    productivity_score: int
    goals_met_percent: int
    peer_feedback_score: float

@router.get("/performance/employees", response_model=List[EmployeeStats])
def get_employees(db: Session = Depends(get_db)):
    """
    Ritorna la lista base dei dipendenti dedotta dai Leads (assignee o operator).
    Fingiamo che l'id sia un int hash per compatibilità col front.
    """
    # Preferiamo 'assignee', fallback su 'operator' se vuoto (spesso i CRM li distinguono variabilmente)
    query = db.query(
        func.coalesce(LeadRecord.assignee, LeadRecord.operator).label('user_name'),
        func.count(LeadRecord.id).label('total_leads'),
        func.sum(
            case(
                (LeadRecord.status.in_(["Vinto", "Chiuso Vinto", "Acquisito"]), 1),
                else_=0
            )
        ).label('won_leads')
    ).filter(
        func.coalesce(LeadRecord.assignee, LeadRecord.operator).isnot(None),
        func.coalesce(LeadRecord.assignee, LeadRecord.operator) != ""
    ).group_by('user_name').all()

    employees = []
    for idx, row in enumerate(query):
        name = row.user_name or "Sconosciuto"
        total = row.total_leads or 0
        won = row.won_leads or 0
        
        # Simuliamo le HR metrics partendo dai dati di vendita reali (Lead)
        # Produttività: base su total_leads (normalizzati a spanne per non sballare UI 0-100)
        prod_score = min(100, max(20, int((total / 50) * 100))) if total else 0
        
        # Goals met: Win Rate
        win_rate = int((won / total) * 100) if total > 0 else 0
        
        # Peer Feedback: Mock (perché non abbiamo recensioni a db, ma scaliamo sul win rate)
        peer_score = round(3.0 + (win_rate / 50), 1)
        peer_score = min(5.0, max(1.0, peer_score))

        employees.append({
            "id": hash(name) % 100000, # Mock ID ma univoco per char string
            "name": name,
            "department": "Vendite / Assegnatari Leads",
            "productivity_score": prod_score,
            "goals_met_percent": win_rate,
            "peer_feedback_score": peer_score
        })

    # Se non c'è NESSUN dato a DB, restituiamo un utente fittizio per non rompere la UI
    if not employees:
         employees.append({
            "id": 999,
            "name": "Nessun Assegnatario (DB Vuoto)",
            "department": "Sistema",
            "productivity_score": 0,
            "goals_met_percent": 0,
            "peer_feedback_score": 0.0
         })

    # Ordiniamo per nome
    employees.sort(key=lambda x: x["name"])
    return employees


@router.get("/performance/radar/{employee_id}")
def get_performance_radar(employee_id: int, db: Session = Depends(get_db)):
    """
    Restituisce i dati del dipendente, calcola trend mensile sui lead, e l'analisi AI.
    """
    emps = get_employees(db)
    emp = next((e for e in emps if e["id"] == employee_id), None)
    
    if not emp:
        return {"error": "Dipendente non trovato"}
        
    if emp["id"] == 999:
        # Fallback early return for empty DB
         return {
            "employee": emp,
            "ai_feedback": "Nessun dato reale su cui basare l'analisi. Importa dei leads nel database per alimentare il radar HR.",
            "monthly_trend": [
                {"month": "Mese -1", "productivity": 0},
                {"month": "Attuale", "productivity": 0}
            ]
        }
    
    # Calcolo Trend: Raggruppiamo i lead vinti per mese per questo utente
    monthly_query = db.query(
        func.strftime('%Y-%m', LeadRecord.opened_at).label('month'),
        func.count(LeadRecord.id).label('total_month')
    ).filter(
        (LeadRecord.assignee == emp["name"]) | (LeadRecord.operator == emp["name"]),
        LeadRecord.opened_at.isnot(None)
    ).group_by(
        'month'
    ).order_by(
        'month'
    ).all()
    
    # Trasformiamo la query in dati per il grafico trend (ultimi 4 mesi trovati)
    monthly_trend = []
    for row in monthly_query[-4:]:
        val = row.total_month
        # Ri-normallizziamo per chart (max ~100)
        normalized_val = min(100, (val / 10) * 100) if val else 0
        monthly_trend.append({
            "month": row.month,
            "productivity": int(normalized_val)
        })
        
    # Se non c'è storico mesi, mock fallback
    if len(monthly_trend) < 2:
        monthly_trend = [
            {"month": "Prec.", "productivity": max(0, emp["productivity_score"] - 15)},
            {"month": "Attuale", "productivity": emp["productivity_score"]},
        ]
        
    ai_feedback = analyze_performance(emp)
    
    return {
        "employee": emp,
        "ai_feedback": ai_feedback,
        "monthly_trend": monthly_trend
    }
