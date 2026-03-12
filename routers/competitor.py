from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup
from openai import AsyncOpenAI
from routers.auth import get_current_user
from models import UserProfile

router = APIRouter(prefix="/api/competitor", tags=["Competitor Radar"])

# Initialize Groq client
client = AsyncOpenAI(
    api_key=None, # Will use GROQ_API_KEY env var automatically, or passed via depends if needed. For now assuming env var is set
    base_url="https://api.groq.com/openai/v1"
)

class AnalyzeRequest(BaseModel):
    url: HttpUrl

class AnalyzeResponse(BaseModel):
    url: str
    company_name: str
    summary: str
    pricing_strategy: str
    usp: list[str]
    weaknesses: list[str]
    target_audience: str
    pitch_advice: str

async def fetch_website_text(url: str) -> str:
    """Fetches and extracts text from a website."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as http_client:
            response = await http_client.get(url)
            response.raise_for_status()
            
            # Use BeautifulSoup to extract text
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
                
            text = soup.get_text(separator=' ', strip=True)
            # Limit to first 6000 chars to avoid token limits
            return text[:6000]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore durante l'accesso al sito URL: {str(e)}")

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_competitor(req: AnalyzeRequest, user: UserProfile = Depends(get_current_user)):
    """Analyzes a competitor's website URL and generates a battle card using Groq AI."""
    
    url_str = str(req.url)
    
    # 1. Scrape the website
    website_text = await fetch_website_text(url_str)
    
    if not website_text or len(website_text) < 100:
        raise HTTPException(status_code=400, detail="Impossibile estrarre contenuto sufficiente dal sito web.")
    
    # 2. Analyze with Groq AI
    system_prompt = """
    Sei un analista di mercato esperto in Competitive Intelligence per un'azienda B2B/SaaS italiana. 
    Il tuo compito è analizzare il testo estratto dal sito web di un potenziale concorrente e generare una "Battle Card" dettagliata in ITALIANO.
    
    RISPONDI ESATTAMENTE IN QUESTO FORMATO JSON VALIDO E NULL'ALTRO:
    {
        "company_name": "Nome Azienda (se si capisce, altrimenti il dominio)",
        "summary": "Breve riassunto di 2-3 frasi su cosa fa l'azienda e il suo posizionamento.",
        "pricing_strategy": "Descrizione di come prezzano (es. Premium, freemium, preventivo custom, costo basso, ecc). Se non esplicito, fai una deduzione motivata.",
        "usp": ["Punto di forza 1", "Punto di forza 2", "Punto di forza 3"],
        "weaknesses": ["Possibile debolezza 1", "Possibile debolezza 2"],
        "target_audience": "Chi è il loro cliente ideale (es: PMI, Enterprise, B2C).",
        "pitch_advice": "Un paragrafo di consiglio per i nostri commerciali su come vendere CONTRO questo concorrente. Quale leva usare?"
    }
    """
    
    user_prompt = f"URL Concorrente: {url_str}\n\nTesto estratto dal sito:\n---\n{website_text}\n---\nGenera l'analisi JSON."
    
    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        result_str = response.choices[0].message.content
        import json
        result = json.loads(result_str)
        
        return AnalyzeResponse(
            url=url_str,
            company_name=result.get("company_name", "Sconosciuto"),
            summary=result.get("summary", "N/A"),
            pricing_strategy=result.get("pricing_strategy", "N/A"),
            usp=result.get("usp", []),
            weaknesses=result.get("weaknesses", []),
            target_audience=result.get("target_audience", "N/A"),
            pitch_advice=result.get("pitch_advice", "N/A")
        )
        
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Errore di rete durante la chiamata a Groq API.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nell'analisi AI: {str(e)}")
