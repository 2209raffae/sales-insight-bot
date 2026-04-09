import sys
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import WarehouseProduct, LeadRecord, WarehouseOrder, OrderItem, Shipment

def create_demo_orders():
    db = SessionLocal()
    print("Generating Intelligent Demo Orders...")

    # 1. Get reference data
    products = db.query(WarehouseProduct).all()
    leads = db.query(LeadRecord).all()

    if not products:
        print("Error: No products found in warehouse. Run a warehouse import first.")
        return

    # 2. Create Online Orders (Linked to Leads)
    # We want some overlapping products to test AI Batch Picking
    common_product = random.choice(products)
    
    online_customers = ["Marco Rossi", "Giulia Bianchi", "Luca Verga", "Elena Neri", "Roberto Fabbri", "Sofia Conti", "Matteo Villa"]
    addresses = [
        "Via Roma 12, Milano (MI)", "Corso Vittorio Emanuele 45, Napoli (NA)", 
        "Piazza Duomo 1, Firenze (FI)", "Via Garibaldi 8, Torino (TO)", 
        "Viale Monza 102, Milano (MI)", "Via Veneto 23, Roma (RM)", "Corso Italia 15, Bari (BA)"
    ]
    phones = ["3331234567", "3479876543", "3291122334", "3385566778", "3409988776", "3456677889", "3312233445"]
    
    for i, name in enumerate(online_customers):
        lead = leads[i % len(leads)] if leads else None
        
        order = WarehouseOrder(
            lead_id=lead.id if lead else None,
            customer_name=name,
            shipping_address=addresses[i % len(addresses)],
            phone_number=phones[i % len(phones)],
            order_channel="Online",
            status="Da Preparare",
            notes=f"Ordine online prioritario per {lead.topic if lead else 'prodotto'}",
            created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 24))
        )
        db.add(order)
        db.flush()

        # Add items: 1 common product + 1 random
        items = [common_product]
        if random.random() > 0.5:
            items.append(random.choice(products))
        
        total = 0
        for p in items:
            qty = random.randint(1, 2)
            db.add(OrderItem(order_id=order.id, product_id=p.id, quantity=qty, unit_price=p.selling_price))
            total += (qty * p.selling_price)
        
        order.total_amount = total
        
        # Add a shipment placeholder
        db.add(Shipment(order_id=order.id, shipment_status="In elaborazione"))

    # 3. Create Physical In-Store Orders (No Lead)
    physical_customers = ["Cliente Occasionale", "Privato Sede", "Acquisto Banco"]
    for name in physical_customers:
        order = WarehouseOrder(
            customer_name=name,
            order_channel="Fisico",
            status="Completato",
            created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48))
        )
        db.add(order)
        db.flush()

        p = random.choice(products)
        qty = random.randint(1, 3)
        db.add(OrderItem(order_id=order.id, product_id=p.id, quantity=qty, unit_price=p.selling_price))
        order.total_amount = qty * p.selling_price

    try:
        db.commit()
        print(f"Successfully created 10 demo orders (7 Online, 3 Physical).")
        print("AI Picking should now show optimized batches for the common products.")
    except Exception as e:
        db.rollback()
        print(f"Failed to create demo orders: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_orders()
