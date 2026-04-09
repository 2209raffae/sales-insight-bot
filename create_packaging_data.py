from sqlalchemy.orm import Session
from database import SessionLocal
from models import WarehouseProduct
import random

def create_packaging():
    db = SessionLocal()
    print("Creating Packaging materials in Warehouse...")
    
    packaging_items = [
        {"sku": "PKG-BOX-S", "name": "Scatola Cartone Small (20x20x15)", "category": "Imballaggi", "qty": 100},
        {"sku": "PKG-BOX-M", "name": "Scatola Cartone Medium (40x30x30)", "category": "Imballaggi", "qty": 50},
        {"sku": "PKG-BOX-L", "name": "Scatola Cartone Large (60x50x40)", "category": "Imballaggi", "qty": 20},
        {"sku": "PKG-ENV-B", "name": "Busta Imbottita Bolle A4", "category": "Imballaggi", "qty": 200},
        {"sku": "PKG-ENV-S", "name": "Busta Plastica Small", "category": "Imballaggi", "qty": 150},
    ]

    for item in packaging_items:
        existing = db.query(WarehouseProduct).filter(WarehouseProduct.sku == item["sku"]).first()
        if not existing:
            new_p = WarehouseProduct(
                sku=item["sku"],
                name=item["name"],
                category=item["category"],
                purchase_price=0.0,
                selling_price=0.0,
                quantity=item["qty"],
                status="Disponibile",
                is_visible=0 # Packaging is not for sale online
            )
            db.add(new_p)
            print(f"Created: {item['name']}")
        else:
            existing.quantity = item["qty"]
            print(f"Updated: {item['name']} (qty: {item['qty']})")

    db.commit()
    db.close()
    print("Packaging setup complete.")

if __name__ == "__main__":
    create_packaging()
