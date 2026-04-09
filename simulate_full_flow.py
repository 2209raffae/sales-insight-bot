import requests
from database import SessionLocal
from models import WarehouseOrder, OrderItem, CRMCustomer, LeadRecord, WarehouseProduct, UserProfile

def reset_db_and_simulate():
    db = SessionLocal()
    
    print("1. Azzeramento Database (Ordini, CRM, Leads derivati dal sito)...")
    db.query(OrderItem).delete()
    db.query(WarehouseOrder).delete()
    db.query(CRMCustomer).delete()
    db.query(LeadRecord).filter(LeadRecord.source == "SITO WEB").delete()
    
    # Prepariamo un prodotto di test
    prod = db.query(WarehouseProduct).first()
    if not prod:
        prod = WarehouseProduct(name="Prodotto Test Workflow", sku="TEST-1", quantity=50, price=100)
        db.add(prod)
    
    initial_qty = prod.quantity
    print(f"   -> Prodotto scelto per il test: {prod.name} (Quantità Iniziale: {initial_qty})")
    db.commit()

    # Get a token to make API calls using the admin user usually present
    user = db.query(UserProfile).first()
    if not user:
        print("Errore: Nessun utente nel DB per fare il login.")
        return
    db.close()
    
    # We don't know the plain password, but we can issue a direct logic call 
    # instead of full HTTP to avoid password issues, OR just use the internal router function!
    import asyncio
    from routers.logistics import create_order, OrderCreate, OrderItemSchema
    
    async def run_simulation():
        db = SessionLocal()
        order_req = OrderCreate(
            customer_name="Mario Rossi Workflow",
            phone_number="3331234567",
            shipping_address="Via Test 12, Roma",
            order_channel="Online",
            items=[OrderItemSchema(product_id=prod.id, quantity=2, unit_price=150.0)]
        )
        
        # We need mock background tasks, but we can pass a dummy
        from fastapi import BackgroundTasks
        bg_tasks = BackgroundTasks()
        
        print("\n2. Creazione dell'Ordine (Online) in corso...")
        # create_order checks auth. Let's patch auth or call logic.
        # Wait, create_order expects a user parameter! We can just pass the user object.
        res = await create_order(
            order_data=order_req,
            background_tasks=bg_tasks,
            db=db,
            user=user
        )
        print(f"   -> Ordine Creato! ID: {res['id']}")
        
        print("\n3. Verifica Escalation in corso...")
        
        # Verifica 1: Il prodotto è stato scalato?
        # ATTENZIONE: per gli ordini ONLINE il prodotto NON viene scalato finche non entra nello step manuale 
        # oppure viene scalato subito? 
        # Controllo il router: "if order_data.order_channel == 'Fisico': product.quantity -= item.quantity"
        # Quindi se è Online, la qta cala fisicamente solo quando viene spedito?
        # L'utente ha chiesto: "si scala la quantita del prodotto ordinato nel magazzino".
        # Ma nel router logistics.py c'è un if:
        # if order_data.order_channel == "Fisico": product.quantity -= item.quantity
        print("   --- Verifica Magazzino ---")
        p_check = db.query(WarehouseProduct).filter(WarehouseProduct.id == prod.id).first()
        print(f"   -> Magazzino (QTA dopo ordine Online): {p_check.quantity} (se non è scesa, significa che cala solo in Fisico o allo Spedito!)")

        print("   --- Verifica CRM ---")
        crm_check = db.query(CRMCustomer).all()
        for c in crm_check:
            print(f"   -> Cliente Trovato in CRM: {c.name} | Tel: {c.phone_number} | LTV: {c.total_spent}€ | Multi-Ordini: {c.orders_count}")

        print("   --- Verifica Sales Insight ---")
        lead_check = db.query(LeadRecord).filter(LeadRecord.source == "SITO WEB").all()
        for l in lead_check:
            print(f"   -> Lead Generata in Sales Insight: [Fonte: {l.source}] - [Stato: {l.status}] - [Oggetto: {l.subject}]")
            
        # Proviamo a creare un ordine "Fisico" per vedere lo scalo quantità
        print("\n4. Creazione dell'Ordine (Fisico) per test dello scalaggio QTA magazzino...")
        order_req_fisico = OrderCreate(
            customer_name="Mario Rossi Workflow",
            phone_number="3331234567", # Stesso telefono per simulare multi ordine
            shipping_address="Ritiro in negozio",
            order_channel="Fisico",
            items=[OrderItemSchema(product_id=prod.id, quantity=3, unit_price=10.0)]
        )
        await create_order(order_data=order_req_fisico, background_tasks=bg_tasks, db=db, user=user)
        
        # Re-check magazzino e CRM
        db.commit()
        db.close()
        
        db2 = SessionLocal()
        p2 = db2.query(WarehouseProduct).filter(WarehouseProduct.id == prod.id).first()
        print(f"   -> Magazzino (QTA dopo ordine Fisico): {p2.quantity} (Iniziale: {initial_qty}, dovrebbe essere -3 --> {initial_qty-3})")
        
        crm_2 = db2.query(CRMCustomer).first()
        print(f"   -> CRM Aggiornato in tempo reale: LTV={crm_2.total_spent}€ | Multi-Ordini: {crm_2.orders_count} (Deve essere 2)")
        
        db2.close()

    asyncio.run(run_simulation())

if __name__ == "__main__":
    reset_db_and_simulate()
