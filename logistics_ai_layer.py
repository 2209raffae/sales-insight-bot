import os
import json
from openai import AsyncOpenAI
from typing import List, Dict, Optional

# Initialize Groq client
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
)

MODEL = "llama-3.3-70b-versatile"

async def optimize_picking_lists(pending_orders: List[Dict], packaging_stock: List[Dict] = []) -> Dict:
    """
    Analyzes pending orders to create an optimized Picking Queue.
    1. Sorts by date.
    2. Sequences orders with same products within the same day.
    3. Suggests packaging based on content.
    """
    if not pending_orders:
        return {"queue": [], "summary": "Nessun ordine da preparare."}

    prompt = f"""Sei un Supervisore di Logistica Avanzata.
Hai una lista di ordini pendenti:
{json.dumps(pending_orders, indent=2, ensure_ascii=False)}

Disponibilità Imballaggi:
{json.dumps(packaging_stock, indent=2, ensure_ascii=False)}

Il tuo compito è generare la CODA DI PRELIEVO (Picking Queue) ottimale:
1. **Ordinamento**: Prima per data (più vecchi prima).
2. **Sequenza Intelligente**: All'interno dello stesso giorno, metti uno dopo l'altro gli ordini che hanno prodotti uguali per agevolare il magazziniere.
# NOTA: La scelta del packaging NON è compito tuo, verrà gestita da un sistema deterministico.

Rispondi in italiano con un JSON strutturato così:
{{
  "queue": [
    {{
      "order_id": int,
      "customer": "string",
      "items": [{{ "sku": "string", "name": "string", "qty": int }}],
      "reason": "string (perché questo ordine è in questa posizione)"
    }}
  ],
  "summary": "Riassunto della strategia di oggi."
}}"""

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL, temperature=0.1,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"AI Logistics V2 Error: {e}")
        # Basic fallback sorting
        sorted_orders = sorted(pending_orders, key=lambda x: x['created_at'])
        return {
            "queue": [
                {
                    "order_id": o["id"], 
                    "customer": o["customer_name"], 
                    "items": o["items"],
                    "suggested_packaging": "Scatola Standard",
                    "reason": "Ordinamento di base per data."
                } for o in sorted_orders
            ],
            "summary": "Errore AI. Coda ordinata per data."
        }

async def predict_shipping_delay(courier: str, destination: str) -> str:
    """Predicts potential delays based on carrier and destination trends."""
    prompt = f"""In base al corriere '{courier}' e alla destinazione '{destination}', 
fornisci una breve previsione in italiano (max 30 parole) su eventuali ritardi logistici stagionali o operativi attuali."""

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL, temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except:
        return "Nessuna anomalia prevista."
