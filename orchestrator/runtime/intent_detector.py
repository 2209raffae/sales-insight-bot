import json
import os
from typing import Dict, Any, List, Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def _get_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("GROQ_API_KEY", ""),
        base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
    )

class IntentDetectionResult:
    def __init__(self, intents: List[str], confidence: float, entities: List[str]):
        self.intents = intents
        self.confidence = confidence
        self.entities = entities

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intents": self.intents,
            "confidence": self.confidence,
            "entities": self.entities
        }

# Rule-based fallback keywords
FALLBACK_RULES = {
    "sales_analysis": ["vendite", "fatturato", "sales", "revenue", "roi", "leads", "lead"],
    "inventory_check": ["magazzino", "giacenza", "stock", "inventario", "prodotto", "prodotti", "riordino"],
    "hr_query": ["hr", "personale", "dipendenti", "cv", "stipendi", "performance", "assunzione"],
    "competitor_analysis": ["competitor", "concorrenti", "concorrenza", "prezzi", "mercato"],
    "automation_request": ["automazione", "email", "automatizza", "invio", "crm"],
    "task_force": ["task", "progetto", "sitrep", "aggiornamento", "progetti"]
}

async def detect_intent(query: str) -> IntentDetectionResult:
    """
    Hybrid Intent Detection: Rules + LLM Fallback.
    """
    query_lower = query.lower()
    
    # 1. Quick Rule-based Check
    rule_intents = []
    for intent, keywords in FALLBACK_RULES.items():
        if any(kw in query_lower for kw in keywords):
            rule_intents.append(intent)
    
    # If exactly one rule matches, we might skip LLM or use it to confirm
    # For now, we always let LLM refine if query is complex, but use rules as hints
    
    # 2. LLM Detection
    client = _get_client()
    model = "llama-3.1-8b-instant"
    
    prompt = f"""
Analizza la richiesta dell'utente e identifica l'intento principale tra i seguenti:
- sales_analysis (domande su vendite, lead, ROI)
- inventory_check (domande su magazzino, stock, prodotti)
- hr_query (domande su personale, performance, CV)
- competitor_analysis (domande sulla concorrenza)
- automation_request (richieste di automazione CRM o email)
- task_force (gestione progetti e task)
- general_business (domande generiche o quando incerto)

REQ: "{query}"

Restituisci JSON: {{ "intent": string, "confidence": float, "entities": string[] }}
"""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"User Query: {query}"}
            ],
            response_format={"type": "json_object"}
        )
        data = json.loads(completion.choices[0].message.content)
        
        # 3. Confidence handling
        confidence = data.get("confidence", 0.0)
        intents = data.get("intents", ["general_business"])
        
        # Policy Task 2: Se confidence < 0.6, fallback a general_business
        if confidence < 0.6:
            intents = ["general_business"]
            
        return IntentDetectionResult(intents, confidence, data.get("entities", []))

    except Exception:
        # Final fallback to general_business if LLM fails
        return IntentDetectionResult(["general_business"], 0.0, [])
