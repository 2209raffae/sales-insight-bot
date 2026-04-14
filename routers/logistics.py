from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import json
from datetime import datetime

from database import get_db
from models import WarehouseOrder, OrderItem, Shipment, WarehouseProduct, WarehouseMovement, LeadRecord, UserProfile, CRMCustomer
from routers.auth import get_current_user
from pydantic import BaseModel
import logistics_ai_layer
from picking_utils import calculate_ideal_packaging, sequence_orders
import uuid
from routers.crm import process_order_automations

router = APIRouter(prefix="/api/logistics", tags=["Logistics & Order Hub"])

# ── SCHEMAS ───────────────────────────────────────────────────────────

class OrderItemSchema(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class OrderCreate(BaseModel):
    lead_id: Optional[int] = None
    customer_name: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    shipping_street: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_zip: Optional[str] = None
    shipping_province: Optional[str] = None
    shipping_country: Optional[str] = None
    phone_number: Optional[str] = None
    order_channel: str  # "Online" | "Fisico"
    items: List[OrderItemSchema]
    shipping_fee: float = 0.0
    notes: Optional[str] = None

class ShipmentUpdate(BaseModel):
    courier_name: Optional[str] = None
    tracking_code: Optional[str] = None
    shipment_status: Optional[str] = None
    estimated_delivery: Optional[datetime] = None

# ── HELPERS ───────────────────────────────────────────────────────────

def _log_movement(db: Session, product_id: int, m_type: str, delta: int, notes: str, performed_by: str):
    move = WarehouseMovement(
        product_id=product_id,
        movement_type=m_type,
        quantity_delta=delta,
        notes=notes,
        performed_by=performed_by
    )
    db.add(move)

def _serialize_order(o: WarehouseOrder) -> Dict:
    return {
        "id": o.id,
        "customer_name": o.customer_name,
        "first_name": o.customer_first_name,
        "last_name": o.customer_last_name,
        "email": o.customer_email,
        "shipping_address": o.shipping_address,
        "shipping_street": o.shipping_street,
        "shipping_city": o.shipping_city,
        "shipping_zip": o.shipping_zip,
        "shipping_province": o.shipping_province,
        "shipping_country": o.shipping_country,
        "phone_number": o.phone_number,
        "shipping_fee": o.shipping_fee,
        "lead_id": o.lead_id,
        "status": o.status,
        "channel": o.order_channel,
        "total": o.total_amount,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        # AI analysis persisted fields
        "ai_packaging": o.ai_packaging,
        "ai_reason": o.ai_reason,
        "ai_analyzed": bool(o.ai_analyzed),
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": i.product.name,
                "product_sku": i.product.sku,
                "product_location": i.product.location,
                "qty": i.quantity,
                "price": i.unit_price,
                "width": i.product.width,
                "height": i.product.height,
                "depth": i.product.depth
            } for i in o.items
        ],
        "shipment": {
            "courier": o.shipment.courier_name if o.shipment else None,
            "tracking": o.shipment.tracking_code if o.shipment else None,
            "status": o.shipment.shipment_status if o.shipment else "Non Spedito"
        } if o.shipment else None
    }

async def _run_ai_analysis_for_new_orders(db: Session):
    """
    Find all pending orders, calculate deterministic packaging, and persist results.
    Called as a background task.
    """
    pending = db.query(WarehouseOrder).filter(
        WarehouseOrder.status.in_(["Da Preparare", "In Preparazione"])
    ).all()

    if not pending:
        return

    orders_data = [_serialize_order(o) for o in pending]
    
    # NEW logic: Use deterministic algorithm first for packaging
    # Get all products that are marked as packaging
    packaging_pool = db.query(WarehouseProduct).filter(WarehouseProduct.is_packaging == 1).all()
    pkg_stock = [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "width": p.width,
            "height": p.height,
            "depth": p.depth,
            "qty": p.quantity
        } for p in packaging_pool
    ]

    try:
        # NEW logic: Deterministic sequencing to put orders with same products together
        sequenced_data = sequence_orders(orders_data)
        seq_map = {item["id"]: item for item in sequenced_data}

        for order in pending:
            # Run deterministic algorithm for this specific order packaging
            items_for_algo = [
                {
                    "name": i.product.name,
                    "width": i.product.width,
                    "height": i.product.height,
                    "depth": i.product.depth,
                    "qty": i.quantity
                } for i in order.items
            ]
            
            pack_result = calculate_ideal_packaging(items_for_algo, pkg_stock)
            pkg_str = ", ".join(pack_result["packaging"]) if pack_result["packaging"] else "Nessun imballaggio adatto"
            order.ai_packaging = pkg_str
            
            # Use data from sequencer for the reason
            seq_item = seq_map.get(order.id, {})
            order.ai_reason = seq_item.get("ai_reason", pack_result["reason"])
            order.ai_analyzed = 1

        db.commit()
        print(f"[Logistics] Analyzed {len(pending)} orders with deterministic sequencing + packaging.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[Logistics] Background analysis error: {e}")

# ── ROUTES ────────────────────────────────────────────────────────────

@router.get("/orders", response_model=List[Dict])
async def list_orders(db: Session = Depends(get_db)):
    orders = db.query(WarehouseOrder).order_by(WarehouseOrder.created_at.desc()).all()
    serialized = [_serialize_order(o) for o in orders]
    
    # Dynamically structure 'picking_index' based on deterministic sequence
    pending = [o for o in serialized if o["status"] in ("Da Preparare", "In Preparazione")]
    sequenced = sequence_orders(pending)
    seq_lookup = {o["id"]: idx for idx, o in enumerate(sequenced)}
    
    for o in serialized:
        if o["id"] in seq_lookup:
            o["picking_index"] = seq_lookup[o["id"]]
            # Also apply the dynamic reason so it shows up instantly without waiting for background persist!
            seq_match = [s for s in sequenced if s["id"] == o["id"]]
            if seq_match and "ai_reason" in seq_match[0]:
                o["ai_reason"] = seq_match[0]["ai_reason"]
        else:
            o["picking_index"] = 9999
            
    return serialized

@router.post("/orders")
async def create_order(
    order_data: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: UserProfile = Depends(get_current_user)
):
    # Validation for Online orders
    if order_data.order_channel == "Online":
        if not all([order_data.shipping_street, order_data.shipping_city, order_data.shipping_zip, order_data.shipping_province, order_data.shipping_country]):
            raise HTTPException(status_code=400, detail="Per ordini Online è necessario compilare l'indirizzo completo (Via, Città, CAP, Provincia, Stato).")

    # Calculate sum of items + shipping fee
    items_total = sum(i.quantity * i.unit_price for i in order_data.items)
    shipping_fee = order_data.shipping_fee if order_data.order_channel == "Online" else 0.0
    total_amount = items_total + shipping_fee

    full_name = f"{order_data.first_name} {order_data.last_name}"
    
    # Combined address string for display/legacy
    full_address = ""
    if order_data.shipping_street:
        full_address = f"{order_data.shipping_street}, {order_data.shipping_zip} {order_data.shipping_city} ({order_data.shipping_province}), {order_data.shipping_country}"

    new_order = WarehouseOrder(
        lead_id=order_data.lead_id,
        customer_name=full_name,
        customer_first_name=order_data.first_name,
        customer_last_name=order_data.last_name,
        customer_email=order_data.email,
        shipping_address=full_address,
        shipping_street=order_data.shipping_street,
        shipping_city=order_data.shipping_city,
        shipping_zip=order_data.shipping_zip,
        shipping_province=order_data.shipping_province,
        shipping_country=order_data.shipping_country,
        phone_number=order_data.phone_number,
        order_channel=order_data.order_channel,
        shipping_fee=shipping_fee,
        total_amount=total_amount,
        notes=order_data.notes,
        status="Da Preparare",
        ai_analyzed=0
    )
    db.add(new_order)
    
    # ── CRM INTEGRATION ──────────────────────────────────────────────
    if order_data.phone_number:
        crm_customer = db.query(CRMCustomer).filter(CRMCustomer.phone_number == order_data.phone_number).first()
        if crm_customer:
            crm_customer.orders_count += 1
            crm_customer.total_spent += total_amount
            crm_customer.last_purchase_date = datetime.utcnow()
            # Update info
            crm_customer.first_name = order_data.first_name
            crm_customer.last_name = order_data.last_name
            crm_customer.name = full_name
            if order_data.email:
                crm_customer.email = order_data.email
            if full_address:
                crm_customer.address = full_address
                crm_customer.street = order_data.shipping_street
                crm_customer.city = order_data.shipping_city
                crm_customer.zip_code = order_data.shipping_zip
                crm_customer.province = order_data.shipping_province
                crm_customer.country = order_data.shipping_country
        else:
            crm_customer = CRMCustomer(
                phone_number=order_data.phone_number,
                name=full_name,
                first_name=order_data.first_name,
                last_name=order_data.last_name,
                email=order_data.email,
                address=full_address,
                street=order_data.shipping_street,
                city=order_data.shipping_city,
                zip_code=order_data.shipping_zip,
                province=order_data.shipping_province,
                country=order_data.shipping_country,
                total_spent=total_amount,
                orders_count=1,
                last_purchase_date=datetime.utcnow()
            )
            db.add(crm_customer)

    db.flush()

    for item in order_data.items:
        product = db.query(WarehouseProduct).filter(WarehouseProduct.id == item.product_id).first()
        if not product or product.quantity < item.quantity:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Stock insufficiente per {product.name if product else 'ID '+str(item.product_id)}")

        db.add(OrderItem(order_id=new_order.id, product_id=item.product_id, quantity=item.quantity, unit_price=item.unit_price))

        if order_data.order_channel == "Fisico":
            product.quantity -= item.quantity
            _log_movement(db, product.id, "Vendita", -item.quantity, f"Vendita in sede (Ordine #{new_order.id})", user.email)

    if order_data.order_channel == "Fisico":
        new_order.status = "Completato"

    # ── SALES INSIGHT INTEGRATION ────────────────────────────────────
    if order_data.order_channel == "Online":
        if order_data.lead_id:
            lead = db.query(LeadRecord).filter(LeadRecord.id == order_data.lead_id).first()
            if lead:
                lead.status = "Vinta"
                lead.closed_at = datetime.utcnow()
        else:
            # Create new LeadRecord for this direct site order
            new_lead = LeadRecord(
                lead_id=f"SITO-{uuid.uuid4().hex[:8].upper()}",
                source="SITO WEB",
                status="Vinta",
                requester=full_name,
                subject=f"Acquisto Online: {new_order.total_amount}€",
                opened_at=datetime.utcnow(),
                closed_at=datetime.utcnow(),
                doc_no=f"ORD-{new_order.id}"
            )
            db.add(new_lead)
            db.flush()
            new_order.lead_id = new_lead.id

    db.commit()

    # Trigger AI analysis in background for this new order
    background_tasks.add_task(_run_ai_analysis_for_new_orders, db)
    
    # NEW: Trigger CRM Automations engine
    background_tasks.add_task(process_order_automations, db, new_order.id)

    return _serialize_order(new_order)

@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: str,
    db: Session = Depends(get_db),
    user: UserProfile = Depends(get_current_user)
):
    order = db.query(WarehouseOrder).filter(WarehouseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404)

    # Deduction logic for online orders going to Spedito
    if status == "Spedito" and order.status != "Spedito":
        for item in order.items:
            product = db.query(WarehouseProduct).filter(WarehouseProduct.id == item.product_id).first()
            if product:
                product.quantity -= item.quantity
                _log_movement(db, product.id, "Vendita", -item.quantity, f"Ordine Online Spedito (#{order.id})", user.email)

    order.status = status
    # NOTE: ai_packaging and ai_reason are NOT reset — they are permanent
    db.commit()
    return _serialize_order(order)

@router.post("/orders/{order_id}/shipment")
async def upsert_shipment(order_id: int, ship_data: ShipmentUpdate, db: Session = Depends(get_db)):
    ship = db.query(Shipment).filter(Shipment.order_id == order_id).first()
    if not ship:
        ship = Shipment(order_id=order_id)
        db.add(ship)

    for key, val in ship_data.model_dump(exclude_unset=True).items():
        setattr(ship, key, val)

    db.commit()
    return {"message": "Spedizione aggiornata."}

@router.post("/ai/analyze-pending")
async def trigger_ai_analysis(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Manually trigger AI analysis for all unanalyzed pending orders.
    Runs in background — returns immediately.
    """
    count = db.query(WarehouseOrder).filter(
        WarehouseOrder.status.in_(["Da Preparare", "In Preparazione"])
    ).count()

    background_tasks.add_task(_run_ai_analysis_for_new_orders, db)
    return {"message": f"Organizzazione e Packaging calcolati per {count} ordini in coda.", "queued": count}

@router.post("/orders/{order_id}/generate-label")
async def generate_shipping_label(order_id: int, db: Session = Depends(get_db)):
    order = db.query(WarehouseOrder).filter(WarehouseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404)

    ship = db.query(Shipment).filter(Shipment.order_id == order_id).first()
    if not ship:
        ship = Shipment(order_id=order_id)
        db.add(ship)

    ship.shipment_status = "Etichetta Generata"
    ship.tracking_code = f"NX-{datetime.now().strftime('%Y%m%d')}-{order_id:04d}"
    db.commit()

    return {
        "message": "Etichetta generata con successo (Simulazione)",
        "tracking_code": ship.tracking_code,
        "label_url": f"/api/static/labels/label_{order_id}.pdf"
    }

@router.get("/stats/overview")
async def get_logistics_stats(db: Session = Depends(get_db)):
    total = db.query(WarehouseOrder).count()
    pending = db.query(WarehouseOrder).filter(WarehouseOrder.status == "Da Preparare").count()
    shipped = db.query(WarehouseOrder).filter(WarehouseOrder.status == "Spedito").count()
    online = db.query(WarehouseOrder).filter(WarehouseOrder.order_channel == "Online").count()
    physical = db.query(WarehouseOrder).filter(WarehouseOrder.order_channel == "Fisico").count()

    return {
        "total": total,
        "pending_preparation": pending,
        "shipped": shipped,
        "online_pct": round((online / total * 100), 1) if total > 0 else 0,
        "physical_pct": round((physical / total * 100), 1) if total > 0 else 0
    }
