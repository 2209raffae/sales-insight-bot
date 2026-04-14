from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

def build_context(company_id: int, session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Builds the base context for agent execution.
    Fase Hardening: aggiunto platform_version e placeholders per RAG.
    """
    return {
        "company_id": company_id,
        "session_id": session_id or str(uuid.uuid4()),
        "previous_results": [], 
        "vector_context": None, 
        "knowledge_domains": ["warehouse", "sales"], 
        "platform_version": "2.0-hardened",
        "metadata": {
            "source": "runtime_orchestrator",
            "timestamp": datetime.utcnow().isoformat()
        }
    }

def update_context(context: Dict[str, Any], agent_slug: str, result: Any):
    """
    Updates the shared context with results from an agent.
    """
    context["previous_results"].append({
        "agent": agent_slug,
        "result": result
    })
