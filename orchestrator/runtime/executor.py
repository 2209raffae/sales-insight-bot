import importlib
import asyncio
from typing import List, Dict, Any, Optional
from ..registry import AGENT_REGISTRY, AgentDefinition
from ..base_agent import BaseAgent
from .schemas import AgentResult
from sqlalchemy.orm import Session
from models import ActiveAgent

def get_agent_instance(slug: str, company_id: int, config: Dict[str, Any]) -> Optional[BaseAgent]:
    """
    Resolves an agent class from the registry and instantiates it.
    """
    agent_def = AGENT_REGISTRY.get(slug)
    if not agent_def or not agent_def.class_path:
        return None
        
    try:
        parts = agent_def.class_path.split('.')
        module_path = ".".join(parts[:-1])
        class_name = parts[-1]
        
        module = importlib.import_module(module_path)
        agent_class = getattr(module, class_name)
        
        return agent_class(company_id=company_id, config=config)
    except Exception as e:
        print(f"Error instantiating agent {slug}: {e}")
        return None

async def _safe_run_agent(slug: str, instance: BaseAgent, user_input: str, context: Dict[str, Any]) -> AgentResult:
    """
    Executes a single agent with a 3-second timeout and error handling.
    """
    import time
    start_t = time.time()
    try:
        # Task 8: Implement timeout of 3s per agent
        res = await asyncio.wait_for(instance.run(user_input, context), timeout=3.0)
        res.metadata["execution_time_seconds"] = round(time.time() - start_t, 3)
        return res
    except asyncio.TimeoutError:
        return AgentResult(
            status="error",
            summary=f"Timeout: l'agente '{slug}' ha impiegato troppo tempo (>3s).",
            metadata={"error": "timeout", "execution_time_seconds": 3.0}
        )
    except Exception as e:
        # Task 4: Unified error handling - an agent failure should not block others
        return AgentResult(
            status="error",
            summary=f"Errore durante l'esecuzione dell'agente '{slug}': {str(e)}",
            metadata={
                "error": "exception", 
                "details": str(e),
                "execution_time_seconds": round(time.time() - start_t, 3)
            }
        )

async def execute_agents(company_id: int, matched_slugs: List[str], user_input: str, context: Dict[str, Any], db: Session) -> Dict[str, AgentResult]:
    """
    Executes a list of agents for a given company in parallel.
    """
    tasks = []
    slug_list = []
    
    for slug in matched_slugs:
        active_agent = db.query(ActiveAgent).filter(
            ActiveAgent.company_id == company_id,
            ActiveAgent.agent_slug == slug,
            ActiveAgent.is_enabled == 1
        ).first()
        
        if not active_agent or not active_agent.config:
            continue
            
        config = active_agent.config.config_json
        instance = get_agent_instance(slug, company_id, config)
        
        if instance:
            tasks.append(_safe_run_agent(slug, instance, user_input, context))
            slug_list.append(slug)
        else:
            # Report initialization error immediately
            error_res = AgentResult(
                status="error",
                summary=f"Impossibile istanziare l'agente '{slug}'. Controllare il registry.",
                metadata={"error": "instantiation_failure"}
            )
            tasks.append(asyncio.sleep(0, result=error_res))
            slug_list.append(slug)
            
    if not tasks:
        return {}
        
    # Execute all agents in parallel
    executed_results = await asyncio.gather(*tasks)
    
    return {slug: res for slug, res in zip(slug_list, executed_results)}
