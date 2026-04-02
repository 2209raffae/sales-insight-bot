import os
import json
from openai import AsyncOpenAI
from typing import List, Dict

# Initialize Groq client (reusing same config as competitor radar)
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
)

async def generate_product_description(name: str, category: str, metadata: dict) -> str:
    """
    Generates a professional, SEO-optimized product description based on metadata.
    """
    metadata_str = ", ".join([f"{k}: {v}" for k, v in metadata.items()])
    
    prompt = f"""
    Sei un esperto di E-commerce Copywriting. 
    Genera una descrizione professionale, accattivante e ottimizzata SEO per il seguente prodotto:
    Nome: {name}
    Categoria: {category}
    Dettagli Tecnici: {metadata_str}
    
    La descrizione deve essere scritta in italiano, deve evidenziare i punti di forza e deve terminare con una call to action.
    Usa un tono professionale ma coinvolgente.
    """
    
    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error in AI Description Gen: {e}")
        return f"Prodotto: {name}. Categoria: {category}. Dettagli: {metadata_str}"

async def analyze_inventory_strategy(inventory_stats: List[Dict], leads_summary: str) -> str:
    """
    Cross-references current stock vs lead demand to provide strategic advice.
    """
    prompt = f"""
    Sei un Analista Strategico di Business. 
    Analizza i seguenti dati di magazzino e confrontali con le richieste attuali dei clienti (Leads).
    
    STATISTICHE MAGAZZINO:
    {json.dumps(inventory_stats, indent=2)}
    
    SINTESI DOMANDA CLIENTI (LEADS):
    {leads_summary}
    
    Fornisci 3 consigli strategici chiari per l'azienda.
    1. Cosa acquistare subito (bassa giacenza, alta domanda).
    2. Cosa scontare o promuovere (alta giacenza, bassa domanda).
    3. Una previsione sul potenziale di fatturato basata sul match stock/leads.
    
    Rispondi in italiano con un tono esecutivo, breve e diretto.
    """
    
    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error in AI Strategy Analysis: {e}")
        return "Al momento non è possibile elaborare un'analisi strategica."

async def suggest_price_optimization(product: Dict, current_price: float, days_in_stock: int) -> Dict:
    """
    Suggests price adjustments based on stock aging.
    """
    prompt = f"""
    Sei un esperto di Dynamic Pricing. 
    Analizza questo prodotto in magazzino:
    Nome: {product.get('name')}
    Giorni in giacenza: {days_in_stock}
    Prezzo attuale: {current_price} €
    
    Suggerisci se il prezzo deve essere mantenuto o modificato (Sconto/Aumento) per massimizzare la rotazione dello stock.
    Fornisci il nuovo prezzo suggerito e una breve motivazione strategica.
    
    Rispondi SOLO in formato JSON valido:
    {{
        "suggested_price": float,
        "action": "maintain" | "discount" | "increase",
        "reason": "string"
    }}
    """
    
    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error in AI Pricing: {e}")
        return {"suggested_price": current_price, "action": "maintain", "reason": "Errore analisi AI."}
