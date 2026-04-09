"""
seed_warehouse.py - Popola il magazzino con prodotti demo realistici.
Aggiornato per includere: is_visible, reorder_point, ecommerce_url.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine
from models import Base, WarehouseProduct
import json
from datetime import datetime, timedelta
import random

# Ensure tables exist
Base.metadata.create_all(bind=engine)

DEMO_PRODUCTS = [
    {
        "sku": "ELT-001", "name": "MacBook Pro 14\" M3 Pro", "category": "Laptop",
        "purchase_price": 1850.00, "selling_price": 2299.00, "quantity": 8, "status": "Disponibile",
        "days_ago": 12, "is_visible": 1, "reorder_point": 3,
        "metadata": {"brand": "Apple", "ram": "18GB", "storage": "512GB SSD"}
    },
    {
        "sku": "ELT-002", "name": "Dell XPS 15 OLED", "category": "Laptop",
        "purchase_price": 1200.00, "selling_price": 1599.00, "quantity": 3, "status": "Disponibile",
        "days_ago": 45, "is_visible": 1, "reorder_point": 2,
        "metadata": {"brand": "Dell", "ram": "32GB", "storage": "1TB SSD"}
    },
    {
        "sku": "ELT-003", "name": "Sony WH-1000XM5", "category": "Audio",
        "purchase_price": 220.00, "selling_price": 349.00, "quantity": 15, "status": "Disponibile",
        "days_ago": 30, "is_visible": 0, "reorder_point": 5,
        "metadata": {"brand": "Sony", "ANC": True}
    },
    {
        "sku": "ELT-004", "name": "iPad Air M2", "category": "Tablet",
        "purchase_price": 680.00, "selling_price": 899.00, "quantity": 1, "status": "Sottoscorta",
        "days_ago": 90, "is_visible": 1, "reorder_point": 3,
        "metadata": {"brand": "Apple", "chip": "M2"}
    },
    {
        "sku": "ACC-001", "name": "Logitech MX Master 3S", "category": "Accessori",
        "purchase_price": 60.00, "selling_price": 99.00, "quantity": 22, "status": "Disponibile",
        "days_ago": 10, "is_visible": 1, "reorder_point": 10,
        "metadata": {"brand": "Logitech", "buttons": 7}
    }
]

def seed():
    db = SessionLocal()
    for item in DEMO_PRODUCTS:
        existing = db.query(WarehouseProduct).filter(WarehouseProduct.sku == item["sku"]).first()
        days_ago = item.pop("days_ago", 0)
        metadata = item.pop("metadata", {})
        
        if existing:
            # Update existing for testing new fields
            existing.is_visible = item["is_visible"]
            existing.reorder_point = item["reorder_point"]
            existing.purchase_price = item["purchase_price"]
            existing.selling_price = item["selling_price"]
            print(f"  🔄 Aggiornato: {existing.name}")
        else:
            product = WarehouseProduct(
                **item,
                metadata_json=json.dumps(metadata),
                created_at=datetime.utcnow() - timedelta(days=days_ago)
            )
            db.add(product)
            print(f"  ✅ Inserito: {product.name}")
    db.commit()
    db.close()

if __name__ == "__main__":
    seed()
