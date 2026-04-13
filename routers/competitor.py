from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
import os
import json
from openai import AsyncOpenAI
from routers.auth import get_current_user
from models import UserProfile, CompetitorSettings, CompetitorBattleCard
from database import SessionLocal
from sqlalchemy.orm import Session
from datetime import datetime

router = APIRouter(prefix="/api/competitor", tags=["Competitor Radar"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize Groq client
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
)

class AnalyzeRequest(BaseModel):
    url: str

class SettingsRequest(BaseModel):
    own_website_url: str

class BattleCardResponse(BaseModel):
    id: int
    url: str
    company_name: str
    summary: str
    pricing_strategy: str
    usp: list[str]
    weaknesses: list[str]
    target_audience: str
    pitch_advice: str
    comparison_analysis: str | None
    created_at: datetime

    class Config:
        from_attributes = True

async def fetch_website_text(url: str) -> str:
    """Fetches and extracts text from a website."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
        }
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=headers) as http_client:
            response = await http_client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
                
            text = soup.get_text(separator=' ', strip=True)
            return text[:6000]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore durante l'accesso al sito URL: {str(e)}")

@router.get("/settings")
async def get_settings(db: Session = Depends(get_db)):
    settings = db.query(CompetitorSettings).first()
    return {"own_website_url": settings.own_website_url if settings else ""}

@router.post("/settings")
async def update_settings(req: SettingsRequest, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono modificare il sito aziendale.")
    
    settings = db.query(CompetitorSettings).first()
    if not settings:
        settings = CompetitorSettings(own_website_url=req.own_website_url)
        db.add(settings)
    else:
        settings.own_website_url = req.own_website_url
    
    db.commit()
    return {"status": "success", "own_website_url": settings.own_website_url}

@router.get("/history", response_model=list[BattleCardResponse])
async def get_history(db: Session = Depends(get_db)):
    cards = db.query(CompetitorBattleCard).order_by(CompetitorBattleCard.created_at.desc()).all()
    # Ensure lists are actually lists (since stored as Text/JSON in DB)
    for card in cards:
        if isinstance(card.usp, str): card.usp = json.loads(card.usp)
        if isinstance(card.weaknesses, str): card.weaknesses = json.loads(card.weaknesses)
    return cards

@router.delete("/{card_id}")
async def delete_card(card_id: int, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    card = db.query(CompetitorBattleCard).filter(CompetitorBattleCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Analisi non trovata.")
    db.delete(card)
    db.commit()
    return {"status": "success"}

@router.post("/analyze", response_model=BattleCardResponse)
async def analyze_competitor(req: AnalyzeRequest, user: UserProfile = Depends(get_current_user), db: Session = Depends(get_db)):
    """Analyzes a competitor vs own website and saves the Battle Card."""
    
    comp_url = req.url.strip()
    if not comp_url.startswith(("http://", "https://")):
        comp_url = "https://" + comp_url
    
    # 1. Get Own Website Text
    settings = db.query(CompetitorSettings).first()
    own_url = settings.own_website_url if settings else None
    own_text = ""
    if own_url:
        try:
            own_text = await fetch_website_text(own_url)
        except:
            own_text = "[Impossibile caricare il proprio sito per il benchmark]"

    # 2. Scrape Competitor Website
    website_text = await fetch_website_text(comp_url)
    
    if not website_text or len(website_text) < 100:
        raise HTTPException(status_code=400, detail="Impossibile estrarre contenuto dal sito concorrente.")
    
    # 3. AI Comparison Analysis
    system_prompt = """
    Sei un analista di mercato esperto in Competitive Intelligence. 
    Analizza il sito del CONCORRENTE rispetto al NOSTRO SITO (se fornito).
    Genera una "Battle Card" strategica e un "Piano di Miglioramento" per noi.
    
    RISPONDI ESATTAMENTE IN QUESTO FORMATO JSON:
    {
        "company_name": "Nome Azienda",
        "summary": "Cosa fanno e posizionamento.",
        "pricing_strategy": "Come prezzano.",
        "usp": ["Punto forza 1", "Punto forza 2"],
        "weaknesses": ["Debolezza 1", "Debolezza 2"],
        "target_audience": "Cliente ideale.",
        "pitch_advice": "Come vendere contro di loro.",
        "comparison_analysis": "Benchmark: dove siamo meglio noi e cosa dobbiamo cambiare sul NOSTRO sito per batterli (3 consigli pratici)."
    }
    """
    
    user_prompt = f"NOSTRO SITO:\n{own_text}\n\nSITO CONCORRENTE:\n{website_text}\n\nGenera l'analisi comparativa JSON."
    
    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # 4. Save to Database
        new_card = CompetitorBattleCard(
            url=comp_url,
            company_name=result.get("company_name", "Sconosciuto"),
            summary=result.get("summary", ""),
            pricing_strategy=result.get("pricing_strategy", ""),
            usp=json.dumps(result.get("usp", [])),
            weaknesses=json.dumps(result.get("weaknesses", [])),
            target_audience=result.get("target_audience", ""),
            pitch_advice=result.get("pitch_advice", ""),
            comparison_analysis=result.get("comparison_analysis", ""),
            created_at=datetime.utcnow()
        )
        db.add(new_card)
        db.commit()
        db.refresh(new_card)
        
        # Prepare response safely from result and new_card
        return BattleCardResponse(
            id=new_card.id,
            url=new_card.url,
            company_name=result.get("company_name", ""),
            summary=result.get("summary", ""),
            pricing_strategy=result.get("pricing_strategy", ""),
            usp=result.get("usp", []),
            weaknesses=result.get("weaknesses", []),
            target_audience=result.get("target_audience", ""),
            pitch_advice=result.get("pitch_advice", ""),
            comparison_analysis=result.get("comparison_analysis", ""),
            created_at=new_card.created_at
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc() # Still logging for safety
        raise HTTPException(status_code=500, detail=f"Errore analisi AI: {str(e)}")
