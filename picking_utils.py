from typing import List, Dict, Optional

def calculate_ideal_packaging(items: List[Dict], available_packaging: List[Dict], tolerance: float = 0.1) -> Dict:
    """
    Deterministic algorithm to select packaging.
    - items: list of dicts with {"width": float, "height": float, "depth": float, "qty": int, "name": str}
    - available_packaging: list of dicts with {"id": int, "sku": str, "name": str, "width": float, "height": float, "depth": float}
    
    Returns:
    {
        "packaging": List[str], # list of packaging names or SKUs
        "reason": str
    }
    """
    if not available_packaging:
        return {"packaging": ["Standard Box"], "reason": "Nessun imballaggio specifico configurato."}

    # Normalize dimensions (L, M, S) for all items and packaging
    def normalize(dists):
        return sorted([dists.get("width", 0), dists.get("height", 0), dists.get("depth", 0)], reverse=True)

    norm_packages = []
    for p in available_packaging:
        dims = normalize(p)
        norm_packages.append({**p, "dims": dims, "volume": dims[0] * dims[1] * dims[2]})
    
    # Sort packages by volume (asc)
    norm_packages.sort(key=lambda x: x["volume"])

    # Expand items by quantity
    flat_items = []
    for it in items:
        dims = normalize(it)
        for _ in range(it.get("qty", 1)):
            flat_items.append({"name": it.get("name", "Item"), "dims": dims, "volume": dims[0] * dims[1] * dims[2]})

    if not flat_items:
        return {"packaging": [], "reason": "Ordine vuoto."}

    selected_packages = []
    current_items = flat_items[:]

    while current_items:
        # Try to find a single package that fits all current_items
        best_single = None
        
        # Simple bounding box for remaining items:
        # Max(L), Max(M), Sum(S)
        max_l = max(it["dims"][0] for it in current_items)
        max_m = max(it["dims"][1] for it in current_items)
        sum_s = sum(it["dims"][2] for it in current_items)
        
        needed = sorted([max_l, max_m, sum_s], reverse=True)
        
        for p in norm_packages:
            # Check if package fits with tolerance
            if (p["dims"][0] >= needed[0] * (1 - tolerance) and 
                p["dims"][1] >= needed[1] * (1 - tolerance) and 
                p["dims"][2] >= needed[2] * (1 - tolerance)):
                best_single = p
                break
        
        if best_single:
            selected_packages.append(best_single["name"])
            break # All items fit
        else:
            # If it doesn't fit in the largest package as a whole,
            # take the largest package and fill it as much as possible
            largest_pkg = norm_packages[-1]
            selected_packages.append(largest_pkg["name"])
            
            # Greedy fill: remove items that fit in the largest package
            remaining = []
            current_vol = 0
            limit_vol = largest_pkg["volume"]
            
            # Simple volume-based greedy split for now
            # In a more advanced version, we'd use 3D bin packing logic
            for it in current_items:
                if current_vol + it["volume"] <= limit_vol:
                    current_vol += it["volume"]
                else:
                    remaining.append(it)
            
            if len(remaining) == len(current_items):
                # Edge case: single item is larger than largest package
                # Suggest the largest package anyway but add a note
                break
            
            current_items = remaining

    return {
        "packaging": selected_packages,
        "reason": f"Calcolato in base alle dimensioni degli articoli ({len(selected_packages)} imballaggi)."
    }

def sequence_orders(orders: List[Dict]) -> List[Dict]:
    """
    Deterministic algorithm to group orders by SKU frequency to optimize picking.
    """
    remaining = orders[:]
    sequenced = []
    
    while remaining:
        # Count SKU frequency in remaining orders
        sku_counts = {}
        for o in remaining:
            for item in o.get('items', []):
                sku = item.get('product_sku')
                if sku:
                    sku_counts[sku] = sku_counts.get(sku, 0) + 1
        
        if not sku_counts:
            sequenced.extend(remaining)
            break
            
        # Find the most frequent SKU
        top_sku = max(sku_counts, key=sku_counts.get)
        
        # Extract all orders containing this SKU
        batch = []
        still_remaining = []
        for o in remaining:
            contains_sku = any(i.get('product_sku') == top_sku for i in o.get('items', []))
            if contains_sku:
                # Add tagging to the order dict so it can be saved back
                o['ai_reason'] = f"Raggruppato per articolo frequente: {top_sku}"
                batch.append(o)
            else:
                still_remaining.append(o)
            
        sequenced.extend(batch)
        remaining = still_remaining
    
    return sequenced
