import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

from picking_utils import sequence_orders

def test_logic():
    print("Testing Sequencing logic...")
    test_orders = [
        {"id": 1, "items": [{"product_sku": "MOUSE"}]},
        {"id": 2, "items": [{"product_sku": "PHONE"}]},
        {"id": 3, "items": [{"product_sku": "MOUSE"}]},
        {"id": 4, "items": [{"product_sku": "KEYBOARD"}]},
        {"id": 5, "items": [{"product_sku": "MOUSE"}]},
    ]
    
    # 3 orders have MOUSE. They should be grouped together.
    sequenced = sequence_orders(test_orders)
    
    ids = [o['id'] for o in sequenced]
    print(f"Sequenced IDs: {ids}")
    
    # Check if the three MOUSE orders are together
    # Indices of IDs 1, 3, 5 should be consecutive
    indices = sorted([sequenced.index(next(o for o in sequenced if o['id'] == i)) for i in [1, 3, 5]])
    if indices == [0, 1, 2]:
        print("Success: MOUSE orders are grouped at the beginning (most frequent first)!")
    elif indices == [2, 3, 4] or indices == [1, 2, 3]: # depending on other SKU counts
         print("Success: MOUSE orders are grouped together!")
    else:
        print(f"Failure: MOUSE orders are NOT grouped together. Indices: {indices}")

    # Check reason tagging
    for o in sequenced:
        if o['id'] in [1, 3, 5]:
            if "MOUSE" in o.get('ai_reason', ''):
                 print(f"Order {o['id']} correctly tagged: {o['ai_reason']}")

if __name__ == "__main__":
    test_logic()
