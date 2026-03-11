from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from hr_ai_layer import analyze_cv

router = APIRouter(prefix="/api/hr", tags=["HR Screening"])

class CVRequest(BaseModel):
    cv_text: str
    job_description: Optional[str] = None

@router.post("/screening")
def screen_cv(req: CVRequest):
    """
    Estrae le feature dal testo del CV e (opzionalmente) fa un match testuale con la JD.
    """
    if not req.cv_text or len(req.cv_text) < 20:
        raise HTTPException(status_code=400, detail="Testo CV troppo corto o mancante.")
    
    result = analyze_cv(req.cv_text, req.job_description)
    return {"result": result}
