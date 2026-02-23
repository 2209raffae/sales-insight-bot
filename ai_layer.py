"""
AI layer - sends computed KPI results to Groq for explanation & recommendations.
The LLM NEVER computes metrics; it only interprets pre-computed JSON.
"""
import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.getenv("GROQ_API_KEY", ""),
            base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
        )
    return _client


SYSTEM_PROMPT = """Sei un assistente di business analysis per team Leads/Spese/Budget.
Devi rispondere SEMPRE in italiano (it-IT), anche se l'utente scrive in inglese.

Ricevi KPI gia calcolati in JSON. Devi SOLO interpretarli, senza ricalcolare nulla.

Vincoli obbligatori:
- Non inventare numeri, periodi o fonti.
- Non stimare KPI mancanti.
- Non usare conoscenza esterna al payload.
- Se una domanda richiede dati assenti nel payload, rispondi: "Non ho abbastanza dati per rispondere con precisione."
  Poi indica chiaramente quali dati/periodo mancano e quale upload/filtro usare.

Formato risposta obbligatorio (Markdown):
1) **Sintesi** (1-2 righe)
2) **Numeri chiave** (bullet con i valori presenti nel payload)
3) **Interpretazione** (breve)
4) **Azioni consigliate** (3-5 bullet, concrete e operative)
5) **Attenzioni/Note** (solo se necessario)

Lessico consigliato quando pertinente:
- CPL
- costo per lead vincente
- budget vs actual
- lead aperte / lead vincenti
- aging

Tono: professionale, chiaro, pratico, non eccessivamente formale.
"""


def explain_kpis(
    user_question: str,
    intent: str,
    kpi_data: dict,
    model: str | None = None,
) -> str:
    """
    Send computed KPI data to the LLM and return a natural language explanation.
    """
    client = _get_client()
    model = model or os.getenv("MODEL", "llama-3.1-8b-instant")

    context = f"""
Domanda utente: {user_question}

Categoria KPI: {intent.replace('_', ' ').title()}

KPI calcolati (NON ricalcolarli):
```json
{json.dumps(kpi_data, indent=2, default=str)}
```

Spiega questi risultati in italiano seguendo esattamente il formato richiesto.
Usa solo i dati presenti nel JSON.
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": context},
        ],
        temperature=0.2,
        max_tokens=700,
    )

    return response.choices[0].message.content or "Nessuna risposta disponibile."


def forecast_trend(
    trend_data: list[dict],
    model: str | None = None,
) -> str:
    """
    Send monthly trend data to the LLM to forecast the next month.
    """
    client = _get_client()
    model = model or os.getenv("MODEL", "llama-3.1-8b-instant")

    context = f"""
Ecco i dati storici del trend mensile (Spesa totale, Numero di Lead, CPL medio):

```json
{json.dumps(trend_data, indent=2, default=str)}
```

In base a questi dati aggregati, genera una BREVE e SPECIFICA previsione per il prossimo mese.
Considera la direzionalita dei costi (CPL sta aumentando?), del volume di lead e della spesa totale.

Formato di risposta (Usa Markdown, niente preamboli, vai dritto al punto):
1) **Analisi del Trend** (Cosa e successo recentemente)
2) **Previsione Stimata Prossimo Mese** (Stima numeri di spesa, lead e CPL)
3) **Suggerimenti di ottimizzazione** (Come migliorare il CPL o il volume)

Sii professionale ma conciso. Usa l'italiano. Se ci sono pochi dati (es. solo 1 mese), indicalo e fai le proiezioni con cautela.
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Sei un Data Analyst senior esperto in performance marketing previsivo."},
                {"role": "user", "content": context},
            ],
            temperature=0.3,
            max_tokens=600,
        )
        return response.choices[0].message.content or "Nessuna previsione generata."
    except Exception as e:
        return f"Errore durante la generazione della previsione AI: {str(e)}"
