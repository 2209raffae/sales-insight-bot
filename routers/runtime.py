from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from orchestrator.runtime.service import process_runtime_request

router = APIRouter(prefix="/api/runtime", tags=["runtime"])

class QueryRequest(BaseModel):
    company_id: int
    query: str
    session_id: str = None

@router.post("/query")
async def execute_query(req: QueryRequest, db: Session = Depends(get_db)):
    """
    Endpoint per eseguire una richiesta utente attraverso l'Orchestratore di Runtime.
    """
    try:
        result = await process_runtime_request(
            company_id=req.company_id,
            query=req.query,
            db=db,
            session_id=req.session_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
