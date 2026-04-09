import traceback
from database import engine, SessionLocal
from models import Base, WarehouseProduct, WarehouseOrder, OrderItem

def seed_data_fresh():
    print("Re-creating tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Adding fresh data...")
        # PACKAGING
        pkgs = [
            WarehouseProduct(sku="BOX-S", name="Box Small", width=20, height=20, depth=15, is_packaging=1, quantity=100, category="Imballaggi", is_visible=0),
            WarehouseProduct(sku="BOX-M", name="Box Medium", width=40, height=30, depth=20, is_packaging=1, quantity=100, category="Imballaggi", is_visible=0),
            WarehouseProduct(sku="ENV-B", name="Busta Imbottita", width=22, height=34, depth=2, is_packaging=1, quantity=100, category="Imballaggi", is_visible=0),
        ]
        db.add_all(pkgs)

        # PRODUCTS
        p1 = WarehouseProduct(sku="PHONE", name="Smartphone", width=16, height=8, depth=1, location="A-01", selling_price=999, quantity=50, category="Electronics")
        p2 = WarehouseProduct(sku="HDMI", name="Cavo HDMI", width=10, height=10, depth=2, location="C-01", selling_price=19, quantity=50, category="Accessories")
        db.add_all([p1, p2])

        # Flush to get IDs for products
        db.flush()

        # ORDERS
        o1 = WarehouseOrder(customer_name="Mario Rossi", status="Da Preparare", total_amount=1018, ai_analyzed=0, order_channel="Online")
        
        # Add items using the Relationship backref
        i1 = OrderItem(product_id=p1.id, quantity=1, unit_price=999)
        i2 = OrderItem(product_id=p2.id, quantity=1, unit_price=19)
        o1.items = [i1, i2]
        
        db.add(o1)
        db.commit()
        print("Seeding successful!")

    except Exception as e:
        print("ERROR:")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data_fresh()
