from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import json
from datetime import datetime

from database import get_db
from models import WarehouseProduct, LeadRecord, UserProfile
from routers.auth import get_current_user
from pydantic import BaseModel
import warehouse_ai_layer

router = APIRouter(prefix="/api/warehouse", tags=["Warehouse Intelligence"])

# ── SCHEMAS ───────────────────────────────────────────────────────────

class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    purchase_price: float = 0.0
    selling_price: float = 0.0
    quantity: int = 0
    status: str = "Disponibile"
    metadata_json: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    quantity: Optional[int] = None
    status: Optional[str] = None
    metadata_json: Optional[str] = None
    sync_status: Optional[int] = None

# ── ROUTES ────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[Dict])
async def list_products(db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)):
    products = db.query(WarehouseProduct).all()
    result = []
    for p in products:
        # Calculate days in stock
        days = (datetime.utcnow() - p.created_at).days
        result.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "purchase_price": p.purchase_price,
            "selling_price": p.selling_price,
            "quantity": p.quantity,
            "status": p.status,
            "metadata": json.loads(p.metadata_json) if p.metadata_json else {},
            "days_in_stock": days,
            "sync_status": p.sync_status,
            "created_at": p.created_at
        })
    return result

@router.post("/products")
async def create_product(product: ProductCreate, db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)):
    # Check if SKU already exists
    existing = db.query(WarehouseProduct).filter(WarehouseProduct.sku == product.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU già esistente in magazzino.")
    
    new_p = WarehouseProduct(
        sku=product.sku,
        name=product.name,
        category=product.category,
        purchase_price=product.purchase_price,
        selling_price=product.selling_price,
        quantity=product.quantity,
        status=product.status,
        metadata_json=product.metadata_json
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p

@router.patch("/products/{product_id}")
async def update_product(product_id: int, updates: ProductUpdate, db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato.")
    
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    
    # Reset sync status on change
    product.sync_status = 0 
    
    db.commit()
    db.refresh(product)
    
    # ── FUTURE SYNC TRIGGER ──
    # Here we would call the external API of the e-commerce
    # print(f"TRIGGER: Syncing SKU {product.sku} to external platform...")
    
    return product

@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato.")
    
    db.delete(product)
    db.commit()
    return {"message": "Prodotto rimosso dal magazzino."}

# ── AI STRATEGIC ROUTES ───────────────────────────────────────────────

@router.get("/ai/strategy")
async def get_ai_strategy(db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)):
    """
    Analyzes current stock vs leads demand.
    """
    # 1. Get stock stats
    products = db.query(WarehouseProduct).all()
    inventory_stats = []
    for p in products:
        inventory_stats.append({
            "category": p.category,
            "name": p.name,
            "quantity": p.quantity,
            "days_in_stock": (datetime.utcnow() - p.created_at).days
        })
    
    # 2. Get leads summary
    leads_query = db.query(LeadRecord.topic, LeadRecord.status).filter(LeadRecord.status.in_(["Aperto", "In Lavorazione", "Nuovo"])).all()
    leads_summary = "Richieste aperte per categoria: "
    topics = {}
    for l in leads_query:
        topics[l.topic] = topics.get(l.topic, 0) + 1
    
    leads_summary += ", ".join([f"{k}: {v}" for k, v in topics.items()])
    
    # 3. Call AI
    strategy = await warehouse_ai_layer.analyze_inventory_strategy(inventory_stats, leads_summary)
    return {"strategy": strategy}

@router.post("/ai/generate-description/{product_id}")
async def ai_generate_description(product_id: int, db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato.")
    
    metadata = json.loads(product.metadata_json) if product.metadata_json else {}
    description = await warehouse_ai_layer.generate_product_description(product.name, product.category, metadata)
    
    return {"description": description}

@router.get("/ai/optimize-price/{product_id}")
async def ai_optimize_price(product_id: int, db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato.")
    
    days = (datetime.utcnow() - product.created_at).days
    optimization = await warehouse_ai_layer.suggest_price_optimization(
        {"name": product.name, "category": product.category},
        product.selling_price,
        days
    )
    return optimization
