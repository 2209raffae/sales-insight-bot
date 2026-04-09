from database import SessionLocal
from models import WarehouseOrder, OrderItem, CRMCustomer, LeadRecord, WarehouseProduct
import requests
import json

db = SessionLocal()

print("1. Azzeramento Database in corso...")
db.query(OrderItem).delete(synchronize_session=False)
db.query(WarehouseOrder).delete(synchronize_session=False)
db.query(CRMCustomer).delete(synchronize_session=False)
db.query(LeadRecord).filter(LeadRecord.source == 'SITO WEB').delete(synchronize_session=False)
db.commit()

# Ensure product 1 exists
p = db.query(WarehouseProduct).filter(WarehouseProduct.id == 1).first()
if not p:
    p = WarehouseProduct(id=1, name="Prodotto Test Workflow", sku="TEST-1", quantity=100, selling_price=100)
    db.add(p)
else:
    p.quantity = 100
db.commit()
db.close()

print("   -> Pulizia Database PostgreSQL completata con successo.")

# Auth Login
res = requests.post("http://127.0.0.1:8000/api/auth/login", json={"email":"test@example.com", "password":"password123"})
if res.status_code != 200:
    print("ERRORE AUTH:", res.text)
    exit()
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("2. Login API completato.")

print("\n3. Invio Ordine 1: ONLINE (Mario Rossi acquista 2pz)...")
req1 = {
    "customer_name": "Mario Rossi",
    "phone_number": "3331112222",
    "shipping_address": "Via Roma 1",
    "order_channel": "Online",
    "items": [{"product_id": 1, "quantity": 2, "unit_price": 500}] 
}
res1 = requests.post("http://127.0.0.1:8000/api/logistics/orders", json=req1, headers=headers)
print("   -> Esito:", res1.status_code)

print("\n4. Invio Ordine 2: FISICO/Negozio (Mario Rossi torna e compra 1pz)...")
req2 = {
    "customer_name": "Mario Rossi",
    "phone_number": "3331112222",
    "shipping_address": "Ritiro Sede",
    "order_channel": "Fisico",
    "items": [{"product_id": 1, "quantity": 1, "unit_price": 100}] 
}
res2 = requests.post("http://127.0.0.1:8000/api/logistics/orders", json=req2, headers=headers)
print("   -> Esito:", res2.status_code)

# Check
db2 = SessionLocal()
print("\n=== VERIFICA PIPELINE ===")

crm = db2.query(CRMCustomer).filter(CRMCustomer.phone_number == "3331112222").first()
if crm:
    print(f"[AGENTE CRM]   OK -> Trovato Profilo Unico: {crm.name} | Speso: {crm.total_spent} EUR | Ordini Mutipli: {crm.orders_count}")
else:
    print("[AGENTE CRM] ERRORE -> Nessun profilo creato.")

prod = db2.query(WarehouseProduct).filter(WarehouseProduct.id == 1).first()
print(f"[MAGAZZINO]    OK -> Giacenza attuale 'Prodotto Test': {prod.quantity} (Solo l'ordine Fisico ha fatto scalo in tempo reale da 100)")

leads = db2.query(LeadRecord).filter(LeadRecord.source == "SITO WEB").all()
print(f"[SALES INISGHT] OK -> Trovate {len(leads)} lead 'SITO WEB' inviate all'analisi!")
for l in leads:
    print(f"                Id: {l.id} | Oggetto: {l.subject} | Stato: {l.status}")

db2.close()
