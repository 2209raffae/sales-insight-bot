from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from models import ActiveAgent

# Intent to Agent Slug mapping
INTENT_AGENT_MAP = {
    "sales_analysis": ["sales-insight"],
    "inventory_check": ["warehouse-intelligence"],
    "hr_query": ["hr-copilot"],
    "competitor_analysis": ["competitor-radar"],
    "automation_request": ["crm-automation"],
    "task_force": ["task-force"],
    "general_business": ["sales-insight", "warehouse-intelligence", "crm-automation"]
}

def match_agents(company_id: int, intents: List[str], db: Session) -> List[str]:
    """
    Finds active agents for a company that match the detected intents.
    """
    all_target_slugs: Set[str] = set()
    for intent in intents:
        slugs = INTENT_AGENT_MAP.get(intent, ["sales-insight"])
        all_target_slugs.update(slugs)
    
    # 2. Query DB for active agents for this company
    active_agents = db.query(ActiveAgent.agent_slug).filter(
        ActiveAgent.company_id == company_id,
        ActiveAgent.is_enabled == 1,
        ActiveAgent.agent_slug.in_(list(all_target_slugs))
    ).all()
    
    # Extract slugs
    matched_slugs = [a.agent_slug for a in active_agents]
    
    # Policy Task 2: Limitare a massimo 2 agenti se ci sono più intenti
    if len(matched_slugs) > 2:
        matched_slugs = matched_slugs[:2]
    
    # Fallback: if no active agent matches the specific intent, 
    # check if 'sales-insight' is at least active
    if not matched_slugs:
        sales_active = db.query(ActiveAgent).filter(
            ActiveAgent.company_id == company_id,
            ActiveAgent.is_enabled == 1,
            ActiveAgent.agent_slug == "sales-insight"
        ).first()
        if sales_active:
            matched_slugs = ["sales-insight"]
            
    return matched_slugs
