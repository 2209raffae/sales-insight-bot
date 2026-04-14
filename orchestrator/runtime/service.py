import time
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from .intent_detector import detect_intent
from .agent_matcher import match_agents
from .executor import execute_agents
from .context_builder import build_context
from .response_aggregator import aggregate_responses
from .logger import log_runtime_query

async def process_runtime_request(
    company_id: int, 
    query: str, 
    db: Session,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main entry point for the Runtime Orchestrator.
    Coordinates intent detection, agent matching, execution, and aggregation.
    """
    start_time = time.time()
    
    # 1. Build Context
    context = build_context(company_id, session_id)
    
    # 2. Detect Intent
    intent_result = await detect_intent(query)
    
    # 3. Match Agents
    matched_slugs = match_agents(company_id, intent_result.intents, db)
    
    # 4. Execute Agents
    raw_results = await execute_agents(
        company_id=company_id,
        matched_slugs=matched_slugs,
        user_input=query,
        context=context,
        db=db
    )
    
    # 5. Aggregate Responses
    execution_time = time.time() - start_time
    metadata = {
        "execution_time_seconds": round(execution_time, 3),
        "confidence": intent_result.confidence,
        "entities_extracted": intent_result.entities,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    
    final_output = await aggregate_responses(
        user_query=query,
        intents=intent_result.intents,
        agents_used=matched_slugs,
        agent_results=raw_results,
        metadata=metadata
    )
    
    # Task 3: Logging strutturato
    log_runtime_query({
        "company_id": company_id,
        "query": query,
        "intents": intent_result.intents,
        "agents": matched_slugs,
        "execution_time": execution_time,
        "status": "success" if any(r.status == "ok" for r in raw_results.values()) else "partial_failure"
    })
    
    return final_output
