from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
import os
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import json
import csv
import io
from datetime import datetime

from database import get_db
from models import WarehouseProduct, LeadRecord, UserProfile, WarehouseMovement, WarehouseProductImage
from routers.auth import get_current_user
from pydantic import BaseModel
import warehouse_ai_layer
from supabase_service import upload_product_image
import uuid

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
    reorder_point: int = 3
    ecommerce_url: Optional[str] = None
    location: Optional[str] = None
    width: float = 0.0
    height: float = 0.0
    depth: float = 0.0
    is_packaging: int = 0

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
    is_visible: Optional[int] = None
    ecommerce_url: Optional[str] = None
    reorder_point: Optional[int] = None
    location: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    is_packaging: Optional[int] = None

class BulkUpdateAction(BaseModel):
    ids: List[int]
    action: str # "show", "hide", "delete", "ai_discount"
    value: Optional[float] = None

class VisibilityToggle(BaseModel):
    is_visible: int

# ── HELPERS ───────────────────────────────────────────────────────────

def _log_movement(db: Session, product_id: int, m_type: str, delta: int = 0, old: float = None, new: float = None, notes: str = None, performed_by: str = "System"):
    move = WarehouseMovement(
        product_id=product_id,
        movement_type=m_type,
        quantity_delta=delta,
        old_value=old,
        new_value=new,
        notes=notes,
        performed_by=performed_by
    )
    db.add(move)

def _serialize_product(p: WarehouseProduct) -> dict:
    days = (datetime.utcnow() - p.created_at).days if p.created_at else 0
    purchase = p.purchase_price or 0.0
    selling = p.selling_price or 0.0
    margin_pct = round(((selling - purchase) / selling) * 100, 1) if selling > 0 and purchase > 0 else None
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "category": p.category,
        "purchase_price": purchase,
        "selling_price": selling,
        "quantity": p.quantity,
        "status": p.status,
        "metadata": json.loads(p.metadata_json) if p.metadata_json else {},
        "days_in_stock": days,
        "sync_status": p.sync_status,
        "is_visible": p.is_visible if p.is_visible is not None else 1,
        "ecommerce_url": p.ecommerce_url,
        "reorder_point": p.reorder_point or 3,
        "margin_pct": margin_pct,
        "is_low_stock": 0 < p.quantity <= (p.reorder_point or 3),
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "location": p.location,
        "depth": p.depth or 0.0,
        "is_packaging": p.is_packaging or 0,
        "gallery": [
            {"id": img.id, "url": img.url, "is_primary": bool(img.is_primary)} 
            for img in p.images
        ],
        "primary_image": next((img.url for img in p.images if img.is_primary), None)
    }

# ── ROUTES ────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[Dict])
async def list_products(db: Session = Depends(get_db)):
    products = db.query(WarehouseProduct).order_by(WarehouseProduct.created_at.desc()).all()
    return [_serialize_product(p) for p in products]

@router.post("/products")
async def create_product(product: ProductCreate, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    # Check uniqueness
    existing = db.query(WarehouseProduct).filter(WarehouseProduct.sku == product.sku).first()
    if existing: raise HTTPException(status_code=400, detail="SKU già esistente.")
    
    
    new_p = WarehouseProduct(**product.model_dump())
    
    # Enforce packaging constraints
    if new_p.is_packaging:
        new_p.selling_price = 0.0
        new_p.is_visible = 0

    db.add(new_p)
    db.flush()
    _log_movement(db, new_p.id, "Carico", delta=new_p.quantity, new=new_p.selling_price, notes="Inserimento manuale", performed_by=user.email)
    db.commit()
    db.refresh(new_p)
    return _serialize_product(new_p)

@router.patch("/products/{product_id}")
async def update_product(product_id: int, updates: ProductUpdate, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id).first()
    if not product: raise HTTPException(status_code=404)

    # Track changes
    old_qty = product.quantity
    old_price = product.selling_price
    
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(product, key, value)

    # Enforce packaging constraints after update
    if product.is_packaging:
        product.selling_price = 0.0
        product.is_visible = 0

    usr_tag = user.email if user else "System"

    if updates.quantity is not None and updates.quantity != old_qty:
        _log_movement(db, product.id, "Rettifica", delta=updates.quantity - old_qty, old=old_qty, new=updates.quantity, notes="Aggiornamento manuale", performed_by=usr_tag)
    
    if updates.selling_price is not None and updates.selling_price != old_price:
        _log_movement(db, product.id, "Prezzo", old=old_price, new=updates.selling_price, notes="Variazione prezzo vendita", performed_by=usr_tag)

    product.sync_status = 0
    db.commit()
    db.refresh(product)
    return _serialize_product(product)

@router.post("/products/bulk")
async def bulk_update(body: BulkUpdateAction, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    products = db.query(WarehouseProduct).filter(WarehouseProduct.id.in_(body.ids)).all()
    usr_tag = user.email if user else "System"
    for p in products:
        if body.action == "show": p.is_visible = 1
        elif body.action == "hide": p.is_visible = 0
        elif body.action == "delete": db.delete(p)
        elif body.action == "ai_discount" and body.value:
            old = p.selling_price
            p.selling_price = body.value
            _log_movement(db, p.id, "Prezzo", old=old, new=p.selling_price, notes="Sconto AI Applicato", performed_by=usr_tag)
        p.sync_status = 0
    db.commit()
    return {"message": f"Aggiornati {len(products)} prodotti."}

@router.get("/products/{product_id}/movements")
async def get_movements(product_id: int, db: Session = Depends(get_db)):
    moves = db.query(WarehouseMovement).filter(WarehouseMovement.product_id == product_id).order_by(WarehouseMovement.created_at.desc()).all()
    return [{
        "id": m.id,
        "type": m.movement_type,
        "delta": m.quantity_delta,
        "old": m.old_value,
        "new": m.new_value,
        "notes": m.notes,
        "at": m.created_at.isoformat(),
        "by": m.performed_by or "System"
    } for m in moves]

# ── CSV Endpoints ─────────────────────────────────────────────────────

@router.get("/template")
async def get_csv_template():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["sku", "name", "category", "purchase_price", "selling_price", "quantity", "reorder_point"])
    # Example Row
    writer.writerow(["EXAMPLE-001", "Prodotto Esempio", "Elettronica", "100.00", "150.00", "10", "3"])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=template_magazzino.csv"}
    )

@router.post("/import")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    content = await file.read()
    decoded = content.decode('utf-8').splitlines()
    reader = csv.DictReader(decoded)
    
    count = 0
    usr_tag = user.email if user else "System"
    for row in reader:
        sku = row.get("sku")
        if not sku: continue
        
        product = db.query(WarehouseProduct).filter(WarehouseProduct.sku == sku).first()
        if product:
            # Update existing
            old_qty = product.quantity
            product.name = row.get("name", product.name)
            product.category = row.get("category", product.category)
            product.purchase_price = float(row.get("purchase_price", product.purchase_price))
            product.selling_price = float(row.get("selling_price", product.selling_price))
            product.quantity = int(row.get("quantity", product.quantity))
            product.reorder_point = int(row.get("reorder_point", product.reorder_point))
            
            if product.quantity != old_qty:
                 _log_movement(db, product.id, "Import", delta=product.quantity - old_qty, notes="Aggiornamento via CSV", performed_by=usr_tag)
        else:
            # Create new
            new_p = WarehouseProduct(
                sku=sku,
                name=row.get("name", "New Product"),
                category=row.get("category", "General"),
                purchase_price=float(row.get("purchase_price", 0)),
                selling_price=float(row.get("selling_price", 0)),
                quantity=int(row.get("quantity", 0)),
                reorder_point=int(row.get("reorder_point", 3))
            )
            db.add(new_p)
            db.flush()
            _log_movement(db, new_p.id, "Import", delta=new_p.quantity, notes="Creato via CSV", performed_by=usr_tag)
        
        count += 1
    
    db.commit()
    return {"message": f"Importati/Aggiornati {count} prodotti."}

# ── AI Endpoints ──────────────────────────────────────────────────────

@router.get("/ai/strategy")
async def get_ai_strategy(db: Session = Depends(get_db)):
    products = db.query(WarehouseProduct).all()
    inventory_stats = [_serialize_product(p) for p in products]
    leads = db.query(LeadRecord.topic).filter(LeadRecord.status.in_(["Aperto", "Nuovo"])).all()
    leads_summary = f"Richieste attive per: {', '.join(set([l.topic for l in leads]))}" if leads else "Nessun lead attivo."
    strategy = await warehouse_ai_layer.analyze_inventory_strategy(inventory_stats, leads_summary)
    return {"strategy": strategy}

@router.get("/ai/bundles")
async def get_ai_bundles(db: Session = Depends(get_db)):
    products = db.query(WarehouseProduct).all()
    inventory = [_serialize_product(p) for p in products]
    bundles = await warehouse_ai_layer.suggest_product_bundles(inventory)
    return {"bundles": bundles}

@router.get("/ai/optimize-price/{product_id}")
async def optimize_product_price(product_id: int, db: Session = Depends(get_db)):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id).first()
    if not product: raise HTTPException(status_code=404)
    
    # Prepare data for AI
    p_data = _serialize_product(product)
    
    # Get optimization from AI Layer
    suggestion = await warehouse_ai_layer.suggest_price_optimization(
        product=p_data,
        current_price=product.selling_price,
        days_in_stock=p_data["days_in_stock"],
        purchase_price=product.purchase_price,
        quantity=product.quantity,
        target_margin=0.25 # Default 25%
    )
    return suggestion

@router.get("/stats/charts")
async def get_chart_stats(db: Session = Depends(get_db)):
    products = db.query(WarehouseProduct).all()
    cat_data = {}
    for p in products:
        val = (p.selling_price or 0) * (p.quantity or 0)
        cat_data[p.category] = cat_data.get(p.category, 0) + val
    
    return [
        {"category": k, "value": round(v, 2)} for k, v in cat_data.items()
    ]

# ── IMAGE MANAGEMENT ──────────────────────────────────────────────────

@router.post("/products/{product_id}/images")
async def add_product_image(
    product_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    user: UserProfile = Depends(get_current_user)
):
    product = db.query(WarehouseProduct).filter(WarehouseProduct.id == product_id).first()
    if not product: raise HTTPException(status_code=404)

    # 1. Upload to Supabase
    ext = os.path.splitext(file.filename)[1].lower()
    fname = f"prod_{product_id}_{uuid.uuid4()}{ext}"
    content = await file.read()
    
    url = await upload_product_image(content, fname, file.content_type)
    if not url:
        raise HTTPException(status_code=500, detail="Errore durante l'upload su Supabase.")

    # 2. Save Reference in DB
    # If it's the first image, make it primary
    is_first = db.query(WarehouseProductImage).filter(WarehouseProductImage.product_id == product_id).count() == 0
    
    new_img = WarehouseProductImage(
        product_id=product_id,
        url=url,
        is_primary=1 if is_first else 0
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    
    return {"id": new_img.id, "url": new_img.url, "is_primary": bool(new_img.is_primary)}

@router.delete("/images/{image_id}")
async def delete_product_image(image_id: int, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    img = db.query(WarehouseProductImage).filter(WarehouseProductImage.id == image_id).first()
    if not img: raise HTTPException(status_code=404)
    
    # Check if delete was primary, set another one as primary if exists
    is_primary = img.is_primary == 1
    p_id = img.product_id
    
    db.delete(img)
    db.commit()
    
    if is_primary:
        next_img = db.query(WarehouseProductImage).filter(WarehouseProductImage.product_id == p_id).first()
        if next_img:
            next_img.is_primary = 1
            db.commit()
            
    return {"message": "Immagine eliminata."}

@router.patch("/images/{image_id}/primary")
async def set_primary_image(image_id: int, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    img = db.query(WarehouseProductImage).filter(WarehouseProductImage.id == image_id).first()
    if not img: raise HTTPException(status_code=404)
    
    # Unset other primaries
    db.query(WarehouseProductImage).filter(WarehouseProductImage.product_id == img.product_id).update({"is_primary": 0})
    img.is_primary = 1
    db.commit()
    
    return {"message": "Immagine impostata come principale."}
