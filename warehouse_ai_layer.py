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

# ── Shared store config (can be overridden per-call) ─────────────────────────
DEFAULT_TARGET_MARGIN = 0.25  # 25% target margin


async def generate_product_description(name: str, category: str, metadata: dict) -> str:
    """Generates a professional, SEO-optimized product description based on metadata."""
    metadata_str = ", ".join([f"{k}: {v}" for k, v in metadata.items()])

    prompt = f"""Sei un esperto di E-commerce Copywriting.
Genera una descrizione professionale, accattivante e ottimizzata SEO per il seguente prodotto:
Nome: {name}
Categoria: {category}
Dettagli Tecnici: {metadata_str}

La descrizione deve essere scritta in italiano, deve evidenziare i punti di forza e terminare con una call to action.
Usa un tono professionale ma coinvolgente. Max 200 parole."""

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL, temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Prodotto: {name}. Categoria: {category}. Dettagli: {metadata_str}"


async def analyze_inventory_strategy(inventory_stats: List[Dict], leads_summary: str) -> str:
    """Cross-references current stock vs lead demand to provide strategic advice."""

    # Calculate extra context
    total_value = sum(p.get("quantity", 0) * p.get("selling_price", 0) for p in inventory_stats)
    low_stock = [p for p in inventory_stats if p.get("quantity", 0) < 3]
    aging = [p for p in inventory_stats if p.get("days_in_stock", 0) > 60]
    zero_stock = [p for p in inventory_stats if p.get("quantity", 0) == 0]

    prompt = f"""Sei un Analista Strategico di Business Intelligence per un negozio retail/e-commerce.

DATI MAGAZZINO COMPLETI:
{json.dumps(inventory_stats, indent=2, ensure_ascii=False)}

METRICHE CHIAVE:
- Valore totale stock (prezzo vendita × qty): €{total_value:,.2f}
- Prodotti sottoscorta (<3 unità): {len(low_stock)} → {[p['name'] for p in low_stock[:5]]}
- Prodotti in giacenza da >60 giorni: {len(aging)} → {[p['name'] for p in aging[:5]]}
- Prodotti esauriti: {len(zero_stock)}

DOMANDA DAI LEAD CRM:
{leads_summary}

Fornisci un'analisi strategica strutturata in italiano con queste sezioni:

## 🔴 Azioni Urgenti
(max 3 bullet: prodotti da riordinare o scontare immediatamente)

## 💰 Opportunità di Fatturato
(prodotti con alto stock e matching domanda leads, pronti per promozioni)

## 📦 Ottimizzazione Stock
(consigli per ridurre giacenze vecchie e migliorare rotazione)

## 📈 Previsione
(breve previsione del potenziale di fatturato e raccomandazione strategica)

Rispondi con un tono da consulente senior, concreto e orientato all'azione. Max 350 parole."""

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL, temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return "Al momento non è possibile elaborare un'analisi strategica."


async def suggest_price_optimization(
    product: Dict,
    current_price: float,
    days_in_stock: int,
    purchase_price: float = 0.0,
    quantity: int = 0,
    target_margin: float = DEFAULT_TARGET_MARGIN,
    category_avg_margin: Optional[float] = None,
) -> Dict:
    """
    Suggests intelligent price adjustments considering:
    - Days in stock (aging)
    - Remaining quantity
    - Purchase price & minimum margin
    - Store target margin
    - Category average margin
    """
    current_margin = ((current_price - purchase_price) / current_price * 100) if current_price > 0 and purchase_price > 0 else None
    min_acceptable_price = purchase_price * 1.05 if purchase_price > 0 else current_price * 0.85  # min 5% above cost
    target_price = purchase_price / (1 - target_margin) if purchase_price > 0 else current_price

    # Urgency classification
    if days_in_stock > 120 or quantity == 0:
        urgency = "CRITICA"
    elif days_in_stock > 60 or quantity <= 2:
        urgency = "ALTA"
    elif days_in_stock > 30 or quantity <= 5:
        urgency = "MEDIA"
    else:
        urgency = "BASSA"

    prompt = f"""Sei un esperto di Dynamic Pricing e Revenue Management per retail.

DATI PRODOTTO:
- Nome: {product.get('name')}
- Categoria: {product.get('category')}
- Prezzo di acquisto (costo): €{purchase_price:.2f}
- Prezzo di vendita attuale: €{current_price:.2f}
- Margine attuale: {f"{current_margin:.1f}%" if current_margin is not None else "N/D"}
- Quantità rimasta in magazzino: {quantity} unità
- Giorni in giacenza: {days_in_stock} giorni
- Urgenza di rotazione: {urgency}

PARAMETRI NEGOZIO:
- Margine target del negozio: {target_margin * 100:.0f}%
- Prezzo target per raggiungere il margine: €{target_price:.2f}
- Prezzo minimo accettabile (costo +5%): €{min_acceptable_price:.2f}
{f"- Margine medio di categoria: {category_avg_margin:.1f}%" if category_avg_margin else ""}

REGOLE OBBLIGATORIE:
1. Il prezzo suggerito NON può mai essere inferiore al prezzo di acquisto (€{purchase_price:.2f})
2. Se il margine attuale è già sotto il target, considera un aumento prima di uno sconto
3. Prodotti con urgenza CRITICA o ALTA possono giustificare uno sconto, ma MAI sotto costo
4. Considera sia la giacenza (giorni) che la quantità rimasta come fattori di rischio

Analizza e suggerisci la strategia ottimale per massimizzare il fatturato proteggendo il margine.

Rispondi SOLO con un JSON valido:
{{
    "suggested_price": float,
    "action": "maintain" | "discount" | "increase" | "liquidate",
    "discount_pct": float,
    "new_margin_pct": float,
    "reason": "string (max 150 char)",
    "urgency": "{urgency}"
}}"""

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL, temperature=0.1,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        # Safety: never below purchase price
        if purchase_price > 0 and result.get("suggested_price", current_price) < purchase_price:
            result["suggested_price"] = round(min_acceptable_price, 2)
            result["action"] = "maintain"
            result["reason"] = f"Prezzo minimo applicato (costo: €{purchase_price:.2f}). " + result.get("reason", "")
        return result
    except Exception as e:
        return {
            "suggested_price": current_price,
            "action": "maintain",
            "discount_pct": 0,
            "new_margin_pct": current_margin or 0,
            "reason": "Errore nell'analisi AI. Mantieni il prezzo attuale.",
            "urgency": urgency
        }


async def generate_reorder_suggestion(low_stock_products: List[Dict], sales_velocity: Dict) -> str:
    """Generates a prioritized reorder list with suggested quantities."""
    prompt = f"""Sei un Supply Chain Manager esperto.

Prodotti sotto soglia di riordino:
{json.dumps(low_stock_products, indent=2, ensure_ascii=False)}

Genera una lista di riordino prioritizzata in italiano con:
1. **Priorità di riordino** (Critica/Alta/Media)
2. **Quantità suggerita da ordinare** per ciascun prodotto
3. **Motivazione breve** (max 1 riga per prodotto)

Formato: tabella markdown. Max 200 parole."""

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL, temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return "Impossibile generare suggerimenti di riordino."


async def suggest_product_bundles(inventory: List[Dict]) -> str:
    """Analyzes inventory to suggest smart product bundles (e.g., slow-moving + best-seller)."""
    # Filter for high stock or older stock
    candidates = [p for p in inventory if p.get("quantity", 0) > 10 or p.get("days_in_stock", 0) > 60]
    
    if not candidates:
        return "Nessun bundle suggerito al momento. Lo stock è ben bilanciato."

    prompt = f"""Sei un esperto di Merchandising e Retail Strategy.

DATI INVENTARIO (CANDIDATI PER BUNDLE):
{json.dumps(candidates[:15], indent=2, ensure_ascii=False)}

Obiettivo: Creare dei "Bundle" (pacchetti) di prodotti per aumentare il valore medio dell'ordine e smaltire lo stock a bassa rotazione.

Fornisci 2-3 suggerimenti di bundle in italiano con:
1. **Nome del Bundle** (accattivante)
2. **Prodotti inclusi**
3. **Sconto suggerito per il pacchetto**
4. **Motivazione strategica**

Sii creativo e concreto. Rispondi in formato markdown."""

    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL, temperature=0.6,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return "Errore nella generazione dei bundle AI."
