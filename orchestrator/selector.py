from typing import List, Dict, Any
from .registry import AGENT_REGISTRY

def select_agents(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Decides which agents to activate based on the company profile.
    """
    selected = []
    suggested_slugs = profile.get("suggested_agents", [])
    industry = profile.get("industry", "Unknown")
    
    for slug, agent in AGENT_REGISTRY.items():
        enabled = False
        reason = "Non attivato di default."
        
        if slug in suggested_slugs:
            enabled = True
            reason = f"Consigliato dall'analisi AI per il settore e i bisogni identificati."
        elif "Tutti" in agent.industry_match or industry in agent.industry_match:
            if agent.enabled_by_default:
                enabled = True
                reason = f"Agente core attivato per il settore {industry}."
        
        selected.append({
            "agent_slug": slug,
            "is_enabled": 1 if enabled else 0,
            "reason": reason
        })
        
    return selected

def generate_configurations(profile: Dict[str, Any], active_agents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generates customized JSON configurations for each enabled agent.
    """
    configs = {}
    industry = profile.get("industry", "Retail").lower()
    size = profile.get("company_size", "SME")
    
    for item in active_agents:
        if not item["is_enabled"]:
            continue
            
        slug = item["agent_slug"]
        
        # Default base config
        config = {
            "mode": "standard",
            "features": ["basic_analysis"],
            "parameters": {}
        }
        
        # Custom logic per agent
        if slug == "sales-insight":
            config["mode"] = "performance" if "ecommerce" in str(profile.get("channels")).lower() else "lead-gen"
            config["kpi"] = ["roi", "cost_per_lead", "win_rate"]
            config["alerts"] = ["budget_threshold", "anomaly_detection"]
            
        elif slug == "warehouse-intelligence":
            config["mode"] = "inventory"
            config["features"] = ["low_stock_alerts", "smart_bundles"]
            config["reorder_threshold"] = 0.2 if size == "Enterprise" else 0.1
            
        elif slug == "hr-copilot":
            config["matching_threshold"] = 0.75
            config["active_positions"] = []
            
        elif slug == "crm-automation":
            config["auto_email"] = True
            config["segmentation"] = "rfm" # Recency, Frequency, Monetary
            
        configs[slug] = config
        
    return configs
