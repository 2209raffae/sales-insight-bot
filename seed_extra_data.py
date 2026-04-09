from database import SessionLocal
from models import WarehouseProduct, WarehouseOrder, OrderItem
import random

def seed_extra():
    db = SessionLocal()
    print("Adding extra products and orders...")

    # 1. ADDITIONAL PRODUCTS
    extra_prods = [
        {"sku": "PROD-MBP", "name": "MacBook Pro 14\"", "cat": "Elettronica", "w": 31, "h": 22, "d": 2, "loc": "A-01-05", "price": 1999.0},
        {"sku": "PROD-COFFEE", "name": "Macchina Caffè Espresso", "cat": "Casa", "w": 25, "h": 35, "d": 30, "loc": "E-10-01", "price": 149.0},
        {"sku": "PROD-CHAIR", "name": "Sedia Gaming Ergon", "cat": "Ufficio", "w": 70, "h": 60, "d": 130, "loc": "PAL-01", "price": 349.0},
        {"sku": "PROD-LAMP", "name": "Lampada Desk LED", "cat": "Ufficio", "w": 15, "h": 15, "d": 40, "loc": "C-05-02", "price": 45.0},
        {"sku": "PROD-MOUSE", "name": "Mouse Wireless Pro", "cat": "Accessori", "w": 12, "h": 7, "d": 4, "loc": "A-02-10", "price": 59.0},
        {"sku": "PROD-STAND", "name": "Supporto Laptop Allum.", "cat": "Accessori", "w": 25, "h": 25, "d": 5, "loc": "A-02-11", "price": 35.0},
    ]

    product_objs = {}
    for p in extra_prods:
        new_p = WarehouseProduct(
            sku=p["sku"],
            name=p["name"],
            category=p["cat"],
            width=p["w"],
            height=p["h"],
            depth=p["d"],
            location=p["loc"],
            is_packaging=0,
            quantity=20,
            purchase_price=p["price"] * 0.5,
            selling_price=p["price"],
            is_visible=1
        )
        db.add(new_p)
        db.flush()
        product_objs[p["sku"]] = new_p

    # 2. ADDITIONAL ORDERS
    orders_to_create = [
        {
            "name": "Paolo Rossi", "addr": "Via Milano 12, Torino",
            "items": [("PROD-MBP", 1), ("PROD-STAND", 1), ("PROD-MOUSE", 1)]
        },
        {
            "name": "Elena Neri", "addr": "Piazza Navona 1, Roma",
            "items": [("PROD-COFFEE", 1), ("PROD-MOUSE", 2)]
        },
        {
            "name": "Roberto Gialli", "addr": "Via Emilia 5, Bologna",
            "items": [("PROD-CHAIR", 1)]
        },
        {
            "name": "Sara Marrone", "addr": "Corso Umberto 30, Napoli",
            "items": [("PROD-MOUSE", 5)]
        }
    ]

    for o_info in orders_to_create:
        total = sum(product_objs[sku].selling_price * qty for sku, qty in o_info["items"])
        o = WarehouseOrder(
            customer_name=o_info["name"],
            shipping_address=o_info["addr"],
            status="Da Preparare",
            order_channel="Online",
            total_amount=total,
            ai_analyzed=0
        )
        db.add(o)
        db.flush()
        
        for sku, qty in o_info["items"]:
            db.add(OrderItem(
                order_id=o.id,
                product_id=product_objs[sku].id,
                quantity=qty,
                unit_price=product_objs[sku].selling_price
            ))

    db.commit()
    db.close()
    print("Extra seeding complete!")

if __name__ == "__main__":
    seed_extra()
