import asyncio
import json
from warehouse_ai_layer import suggest_product_bundles, client, MODEL
from models import WarehouseProduct
from database import SessionLocal
from routers.warehouse import _serialize_product

async def run_test():
    db = SessionLocal()
    products = db.query(WarehouseProduct).all()
    inventory = [_serialize_product(p) for p in products]
    
    candidates = [p for p in inventory if p.get("quantity", 0) > 10 or p.get("days_in_stock", 0) > 60]
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

    print("Sending prompt...")
    response = await client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model=MODEL, temperature=0.6,
    )
    print(response.choices[0].message.content.strip())

asyncio.run(run_test())
