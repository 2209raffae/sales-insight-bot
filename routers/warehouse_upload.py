import io
import uuid
import json
from datetime import datetime
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import WarehouseProduct, UploadBatch, UserProfile
from routers.auth import get_current_user

router = APIRouter(prefix="/api/warehouse", tags=["Warehouse Intelligence"])

REQUIRED_COLUMNS = {"sku", "name"}
CORE_COLUMNS = {"sku", "name", "category", "purchase_price", "selling_price", "quantity", "status"}

@router.post("/upload")
async def upload_warehouse_csv(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Sono accettati solo file CSV.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore nel parsing del CSV: {e}")

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Colonne obbligatorie mancanti: {missing}. Trovate: {list(df.columns)}"
        )

    # Statistics for the batch
    rows_new = 0
    rows_updated = 0
    rows_skipped = 0

    batch_id = str(uuid.uuid4())
    
    for _, row in df.iterrows():
        sku = str(row["sku"]).strip()
        if not sku:
            rows_skipped += 1
            continue

        # Check if product exists for UPSERT
        product = db.query(WarehouseProduct).filter(WarehouseProduct.sku == sku).first()
        
        # Prepare metadata (everything not in CORE_COLUMNS)
        metadata = {}
        for col in df.columns:
            if col not in CORE_COLUMNS:
                val = row[col]
                metadata[col] = val if pd.notna(val) else None

        if product:
            # Update existing
            product.name = str(row["name"])
            product.category = str(row.get("category", product.category))
            product.purchase_price = float(row.get("purchase_price", product.purchase_price))
            product.selling_price = float(row.get("selling_price", product.selling_price))
            product.quantity = int(row.get("quantity", product.quantity))
            product.status = str(row.get("status", product.status))
            product.metadata_json = json.dumps(metadata)
            product.sync_status = 0 # Mark for re-sync
            rows_updated += 1
        else:
            # Insert new
            new_p = WarehouseProduct(
                sku=sku,
                name=str(row["name"]),
                category=str(row.get("category", "Generale")),
                purchase_price=float(row.get("purchase_price", 0)),
                selling_price=float(row.get("selling_price", 0)),
                quantity=int(row.get("quantity", 1)),
                status=str(row.get("status", "Disponibile")),
                metadata_json=json.dumps(metadata),
                sync_status=0
            )
            db.add(new_p)
            rows_new += 1

    # Create batch record
    batch = UploadBatch(
        upload_id=batch_id,
        dataset="warehouse",
        filename=file.filename,
        uploaded_at=datetime.utcnow(),
        rows_new=rows_new,
        rows_updated=rows_updated,
        rows_skipped=rows_skipped,
        user=current_user.email
    )
    db.add(batch)
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Errore nel salvataggio dei dati: {e}")

    return {
        "upload_id": batch_id,
        "rows_new": rows_new,
        "rows_updated": rows_updated,
        "rows_skipped": rows_skipped
    }
