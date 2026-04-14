import sys
import os
import asyncio
import json
import time
from typing import List, Dict, Any
from unittest.mock import patch, MagicMock

# Aggiungi root al path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import SessionLocal
from orchestrator.runtime.service import process_runtime_request
from orchestrator.runtime.schemas import AgentResult

# Report accumulator
test_results = []
metrics = {
    "total_queries": 0,
    "total_time": 0.0,
    "fallback_count": 0,
    "agent_count": 0,
    "anomalies": []
}

async def run_test_case(name: str, company_id: int, query: str, expected_intent: str = None, iterations: int = 1):
    print(f"\n[TEST] {name} - Query: '{query}'")
    db = SessionLocal()
    
    case_success = True
    local_intents = []
    local_agents = []
    
    for i in range(iterations):
        start = time.time()
        try:
            result = await process_runtime_request(company_id, query, db)
            elapsed = time.time() - start
            
            # 1. Determinismo (accumula dati per verifica post-loop)
            local_intents.append(",".join(sorted(result.get("intents_detected", []))))
            local_agents.append(",".join(sorted(result.get("agents_executed", []))))
            
            # 2. Validazione AgentResult (Task 2)
            raw_results = result.get("raw_results", {})
            for slug, res_dict in raw_results.items():
                required_fields = ["status", "summary", "structured_data", "signals", "warnings", "metadata"]
                for field in required_fields:
                    if field not in res_dict:
                        metrics["anomalies"].append(f"Field '{field}' missing in agent '{slug}' output")
                        case_success = False
                if not res_dict.get("status"):
                    metrics["anomalies"].append(f"Status empty in agent '{slug}' output")
                    case_success = False

            # 3. Validazione Aggregator (Task 3: No ungrounded numbers)
            final_resp = result.get("final_response", "").lower()
            import re
            numbers_in_final = re.findall(r'\d+(?:[.,]\d+)?', final_resp)
            
            # Estraiamo tutti i numeri dai raw results per confronto
            raw_content_str = json.dumps(raw_results).lower()
            for num in numbers_in_final:
                # Semplice controllo di esistenza: se il numero è > 1 (evitiamo micro-numeri comuni), 
                # deve essere nel raw_results
                if float(num.replace(",", ".")) > 1.0 and num not in raw_content_str:
                    # Eccezione per numeri comuni o formati data se non rilevanti
                    if num not in ["2026", "2025"]: 
                        metrics["anomalies"].append(f"Possibile allucinazione numerica: '{num}' in final response ma non in raw data")
            
            # Se manca un agente atteso o c'è un errore, l'aggregatore deve dichiararlo
            for slug, res in raw_results.items():
                if res.get("status") == "error" and slug.lower() not in final_resp:
                    metrics["anomalies"].append(f"L'aggregatore non ha menzionato l'errore dell'agente '{slug}'")

            # 4. Logging obbligatorio (Task 4)
            if os.path.exists("logs/runtime_logs.json"):
                with open("logs/runtime_logs.json", "r") as f:
                    logs = json.load(f)
                    if logs:
                        last_log = logs[-1]
                        log_fields = ["query", "company_id", "intents", "agents", "execution_time_ms"]
                        for lf in log_fields:
                            if lf not in last_log:
                                metrics["anomalies"].append(f"Log mancante del campo obbligatorio: {lf}")
            else:
                metrics["anomalies"].append("File di log 'logs/runtime_logs.json' non trovato")

            # Metrics update
            metrics["total_queries"] += 1
            metrics["total_time"] += elapsed
            metrics["agent_count"] += len(result.get("agents_executed", []))
            if "general_business" in result.get("intents_detected", []):
                metrics["fallback_count"] += 1
                
            print(f"  Iterazione {i+1}: OK ({round(elapsed, 2)}s) - Intents: {result.get('intents_detected')}")
            
        except Exception as e:
            print(f"  Iterazione {i+1}: FALLITA - {e}")
            case_success = False
            metrics["anomalies"].append(f"Crash in {name}: {e}")

    # Check determinismo (Task 1)
    if iterations > 1:
        if not all(x == local_intents[0] for x in local_intents):
            metrics["anomalies"].append(f"Instabilità Intent in {name}")
            print("  [WARN] Rilevata instabilità negli intenti")
        if not all(x == local_agents[0] for x in local_agents):
            metrics["anomalies"].append(f"Instabilità Agenti in {name}")
            print("  [WARN] Rilevata instabilità nella selezione agenti")

    test_results.append({
        "name": name,
        "success": case_success,
        "query": query,
        "avg_time": sum(local_intents.count(x) for x in local_intents) # dummy
    })
    
    db.close()

async def run_failure_test():
    """Task 2.5: Agent Failure Simulation"""
    print("\n[TEST] Agent Failure Simulation")
    db = SessionLocal()
    
    # Mocking a failure in one agent (e.g. warehouse-intelligence)
    with patch("orchestrator.runtime.executor._safe_run_agent") as mock_run:
        # Mocking the side effect: first call fails, second succeeds
        async def side_effect(slug, *args, **kwargs):
            if slug == "warehouse-intelligence":
                return AgentResult(status="error", summary="Errore simulato", metadata={"err": "test"})
            # Fallback to real logic is hard here without original, so we return a dummy ok
            return AgentResult(status="ok", summary="Dati vendite ok", structured_data={"rev": 100})
            
        mock_run.side_effect = side_effect
        
        result = await process_runtime_request(999, "Controlla le vendite e lo stock", db)
        print(f"  Status Agenti: {[res['status'] for res in result['raw_results'].values()]}")
        print(f"  Response: {result['final_response'][:100]}...")
        
        # Verify sales still works
        if "sales-insight" in result["raw_results"]:
            print("  [OK] Sales agent processed correctly despite Warehouse failure.")
            
    db.close()

async def run_timeout_test():
    """Task 2.6: Timeout Handling"""
    print("\n[TEST] Timeout Handling")
    db = SessionLocal()
    
    # Mocking timeout
    with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError):
        result = await process_runtime_request(999, "Dammi lo stock", db)
        res_values = list(result["raw_results"].values())[0]
        if res_values["status"] == "error" and "Timeout" in res_values["summary"]:
             print("  [OK] Timeout rilevato e gestito correttamente.")
             
    db.close()

async def run_all_tests():
    print("=== AVVIO SUITE TEST E2E RUNTIME ORCHESTRATOR ===")
    
    # Task 2.1: Single Agent
    await run_test_case("Single Agent Access", 999, "Come stanno andando le vendite?", iterations=3)
    
    # Task 2.2: Multi Agent (Retail has 2 agents)
    await run_test_case("Multi Agent Access", 999, "Controlla le vendite e dimmi se lo stock è sufficiente", iterations=3)
    
    # Task 2.3: Ambiguous
    await run_test_case("Ambiguous Query", 999, "Cosa devo fare oggi?", iterations=1)
    
    # Task 2.4: No Agent (Company 888 has no logistic)
    await run_test_case("No Matching Agent", 888, "Qual è il tracking della spedizione 123?", iterations=1)
    
    # Task 2.5 & 2.6
    await run_failure_test()
    await run_timeout_test()
    
    # Task 5: Stress Test (20 iterations)
    print("\n[STRESS] Esecuzione di 20 query varie in loop...")
    queries = [
        "Le vendite di oggi?",
        "Situazione magazzino",
        "Quanto abbiamo speso in ads?",
        "Bundling suggeriti?",
        "Analisi performance HR",
        "Pianifica task per progetto X"
    ]
    for i in range(20):
        q = queries[i % len(queries)]
        cid = 999 if i % 2 == 0 else 888
        await run_test_case(f"Stress_{i}", cid, q, iterations=1)

    # Final Summary (Task 5 & 6)
    print("\n" + "="*50)
    print("RELAZIONE FINALE TEST E2E")
    print("="*50)
    print(f"Query Totali: {metrics['total_queries']}")
    avg_t = metrics['total_time'] / metrics['total_queries'] if metrics['total_queries'] > 0 else 0
    print(f"Tempo Medio Risposta: {round(avg_t, 2)}s")
    fallback_p = (metrics['fallback_count'] / metrics['total_queries']) * 100 if metrics['total_queries'] > 0 else 0
    print(f"Percentuale Fallback: {round(fallback_p, 1)}%")
    print(f"Agenti Medi per Query: {round(metrics['agent_count'] / metrics['total_queries'], 1) if metrics['total_queries'] > 0 else 0}")
    print(f"Anomalie Rilevate: {len(metrics['anomalies'])}")
    for a in metrics['anomalies'][:10]:
        print(f" - {a}")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
