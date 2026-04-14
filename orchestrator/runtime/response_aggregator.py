import json
import os
from typing import Dict, Any, List
from openai import OpenAI
from dotenv import load_dotenv
from .schemas import AgentResult

load_dotenv()

def _get_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("GROQ_API_KEY", ""),
        base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
    )

async def aggregate_responses(
    user_query: str, 
    intents: List[str], 
    agents_used: List[str], 
    agent_results: Dict[str, AgentResult],
    metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Synthesizes the results from multiple agents into a single response.
    """
    client = _get_client()
    model = "llama-3.3-70b-versatile"
    
    # Task 5: Context for aggregation with rigorous distinction
    summary_context = ""
    for slug, res in agent_results.items():
        status_tag = "[OK]" if res.status == "ok" else "[ERRORE]"
        summary_context += f"\n--- AGENTE: {slug} {status_tag} ---\n"
        summary_context += f"SINTESI: {res.summary}\n"
        if res.structured_data:
            summary_context += f"DATI: {json.dumps(res.structured_data, ensure_ascii=False)}\n"
        if res.warnings:
            summary_context += f"WARNINGS: {', '.join(res.warnings)}\n"
    
    prompt = f"""
Sei il Nexus Orchestrator, l'intelligenza centrale della piattaforma AI aziendale.
Il tuo compito è sintetizzare l'output degli agenti specializzati in una risposta coerente, professionale e orientata all'azione.

QUERY UTENTE: "{user_query}"
INTENTI RILEVATI: {", ".join(intents)}
AGENTI COINVOLTI: {", ".join(agents_used)}

RISULTATI DEGLI AGENTI:
{summary_context}

REGOLE MANDATORIE DI RISPOSTA:
1. Distingui chiaramente tra DATI DETERMINISTICI (forniti dagli agenti) e ANALISI/CONSIGLI AI.
2. Se un agente ha riportato un errore o un timeout, indicalo chiaramente come mancanza parziale di dati.
3. Se ci sono WARNINGS importanti, evidenziali in una sezione finale "Attenzione".
4. Sii asciutto, professionale e concreto. Evita frasi di circostanza lunghe.
5. Usa Markdown (grassetto, tabelle se utile, elenchi).

RISPOSTA:
"""

    try:
        response = client.chat.completions.create(
            messages=[{"role": "system", "content": "Sei l'aggregatore di risposte del Nexus Orchestrator. Rispondi con precisione chirurgica."},
                      {"role": "user", "content": prompt}],
            model=model,
            temperature=0.3
        )
        final_text = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Aggregation Error: {e}")
        # Fallback to a simpler model if 70b fails
        try:
             response = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.3
            )
             final_text = response.choices[0].message.content.strip()
        except Exception:
            final_text = "Spiacente, ho riscontrato un errore nell'aggregazione dei dati."

    return {
        "final_response": final_text,
        "intents_detected": intents,
        "agents_executed": agents_used,
        "raw_results": {slug: res.dict() for slug, res in agent_results.items()},
        "execution_metadata": metadata
    }
