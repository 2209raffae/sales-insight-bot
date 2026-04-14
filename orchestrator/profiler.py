import json
import os
from typing import Dict, Any, List
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def _get_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("GROQ_API_KEY", ""),
        base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
    )

async def profile_company(name: str, description: str, metadata: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Analyzes company description using Groq LLM to produce a structured profile.
    """
    client = _get_client()
    model = "llama-3.1-8b-instant"

    prompt = f"""
Sei un Business Profiler AI. Il tuo compito è analizzare la descrizione di un'azienda e restituire un profilo strutturato in formato JSON.

AZIENDA: {name}
DESCRIZIONE: {description}
METADATA: {json.dumps(metadata)}

REGOLE DI OUTPUT:
Restituisci esclusivamente un oggetto JSON con questa struttura:
{{
  "industry": "Settore macro (es. Retail, SaaS, Manufacturing, Services)",
  "company_size": "SME, Mid-Market, o Enterprise",
  "channels": ["Lista canali di vendita/operativi"],
  "needs": ["Lista bisogni identificati"],
  "complexity_level": "Low, Medium, o High",
  "suggested_agents": ["Lista slug agenti consigliati (es. sales-insight, warehouse-intelligence, hr-copilot, etc.)"]
}}

SLUG AGENTI DISPONIBILI:
sales-insight, warehouse-intelligence, logistic-efficiency, hr-copilot, competitor-radar, crm-automation, task-force, finance-advisor, legal-compliance, social-media-manager, customer-support-ai, it-infrastructure.

JSON:
"""

    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Sei un analista aziendale esperto. Rispondi SOLO in JSON."},
                {"role": "user", "content": prompt}
            ],
            model=model,
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error profiling company: {e}")
        # Default fallback
        return {
            "industry": "Unknown",
            "company_size": "SME",
            "channels": [],
            "needs": [],
            "complexity_level": "Low",
            "suggested_agents": ["sales-insight", "crm-automation"]
        }
