"""
Chat router - classifies intent -> computes KPIs (leads or spend) -> Groq explanation.
Sales dataset removed. Only leads and spend are supported.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import LeadRecord, CampaignSpend
from leads_kpi_engine import compute_leads_kpi_for_question, LEADS_KEYWORDS
from spend_kpi_engine import compute_spend_kpi_for_question, SPEND_KEYWORDS
from ai_layer import explain_kpis

router = APIRouter(prefix="/api", tags=["chat"])

LEADS_TRIGGER = {
    kw for kws in LEADS_KEYWORDS.values() for kw in kws
} | {
    "lead", "leads", "prospect", "pipeline", "lavorare", "assegnato",
    "operatore", "sorgente", "ticket", "pratica", "aging", "stato",
}

SPEND_TRIGGER = {
    kw for kws in SPEND_KEYWORDS.values() for kw in kws
} | {
    "spend", "spesa", "budget", "cpl", "cost", "costo", "campaign",
    "campagna", "roi", "overspend", "winning", "vinta", "chiusa", "converted",
}


def _detect_dataset(question: str, has_leads: bool, has_spend: bool) -> str:
    """Return 'leads' or 'spend' based on question + available data."""
    q = question.lower()
    spend_score = sum(1 for w in SPEND_TRIGGER if w in q)
    leads_score = sum(1 for w in LEADS_TRIGGER if w in q)

    if spend_score > leads_score and has_spend:
        return "spend"
    if has_leads:
        return "leads"
    if has_spend:
        return "spend"
    return "leads"


class ChatRequest(BaseModel):
    question: str
    dataset: str = "auto"  # auto | leads | spend


class ChatResponse(BaseModel):
    question: str
    dataset: str
    intent: str
    kpi_data: dict
    answer: str


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="La domanda non puo essere vuota.")

    has_leads = db.query(LeadRecord).count() > 0
    has_spend = db.query(CampaignSpend).count() > 0

    if req.dataset == "spend":
        use = "spend"
    elif req.dataset == "leads":
        use = "leads"
    else:
        use = _detect_dataset(req.question, has_leads, has_spend)

    if use == "leads":
        if not has_leads:
            raise HTTPException(
                status_code=400,
                detail="Nessun dato leads caricato. Carica prima un CSV leads.",
            )
        intent, kpi_data = compute_leads_kpi_for_question(req.question, db)
    else:
        if not has_spend:
            raise HTTPException(
                status_code=400,
                detail="Nessun dato spese caricato. Carica prima un CSV spese.",
            )
        intent, kpi_data = compute_spend_kpi_for_question(req.question, db)

    try:
        answer = explain_kpis(user_question=req.question, intent=intent, kpi_data=kpi_data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Errore servizio AI: {str(e)}")

    return ChatResponse(
        question=req.question,
        dataset=use,
        intent=intent,
        kpi_data=kpi_data,
        answer=answer,
    )
