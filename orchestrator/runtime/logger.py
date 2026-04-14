import json
import os
from datetime import datetime
from typing import Any, Dict

LOG_FILE = "logs/runtime_logs.json"

def log_runtime_query(log_data: Dict[str, Any]):
    """
    Logs a runtime query interaction to a JSON file.
    """
    if not os.path.exists("logs"):
        os.makedirs("logs")
        
    # Standard fields
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **log_data
    }
    
    try:
        # Append to a list in the file or create new list
        logs = []
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                try:
                    logs = json.load(f)
                except:
                    logs = []
                    
        logs.append(entry)
        
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"FAILED TO LOG RUNTIME QUERY: {e}")
