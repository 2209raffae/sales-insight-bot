from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from orchestrator.service import setup_new_company, get_company_setup
from pydantic import BaseModel
from typing import Dict, Any

router = APIRouter(prefix="/api/orchestrator", tags=["Orchestrator"])

class CompanySetupRequest(BaseModel):
    name: str
    description: str
    metadata: Dict[str, Any] = {}

@router.post("/setup-company")
async def api_setup_company(req: CompanySetupRequest, db: Session = Depends(get_db)):
    """
    Analyzes and configures a new company.
    """
    try:
        company_id = await setup_new_company(db, req.name, req.description, req.metadata)
        setup = get_company_setup(db, company_id)
        return setup
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/company/{company_id}/full-setup")
async def api_get_full_setup(company_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the complete configuration of a company.
    """
    setup = get_company_setup(db, company_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Azienda non trovata.")
    return setup

@router.get("/company/{company_id}/agents")
async def api_get_company_agents(company_id: int, db: Session = Depends(get_db)):
    """
    Retrieves only the list of active agents for a company.
    """
    setup = get_company_setup(db, company_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Azienda non trovata.")
    return setup["active_agents"]
