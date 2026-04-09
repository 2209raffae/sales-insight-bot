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


def match_problem_to_expertise(
    problem_description: str,
    categories: list[dict],
    model: str | None = None,
) -> list[int]:
    """
    Given a problem description and a list of available categories (id, name),
    returns a list of IDs of categories that match the problem.
    """
    client = _get_client()
    model = model or os.getenv("MODEL", "llama-3.1-8b-instant")

    # categories is list of {"id": int, "name": str}
    categories_str = "\n".join([f"- {c['id']}: {c['name']}" for c in categories])

    context = f"""
Abbiamo un problema tecnico o di business descritto così:
---
{problem_description}
---

Abbiamo le seguenti categorie di competenza disponibili nel sistema:
{categories_str}

Identifica quali di queste categorie sono PARTI NECESSARIE per risolvere il problema. 
Restituisci SOLO un array JSON di interi contenente gli ID delle categorie selezionate.
Esempio: [1, 4, 12]

Se nessuna categoria è pertinente, restituisci un array vuoto [].
Non aggiungere spiegazioni, restituisci solo il JSON.
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Sei un coordinatore tecnico che assegna task ai team giusti in base alle loro competenze."},
                {"role": "user", "content": context},
            ],
            temperature=0.0, # Deterministic
            max_tokens=100,
        )
        content = response.choices[0].message.content or "[]"
        # Clean potential markdown
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        
        selected_ids = json.loads(content.strip())
        if isinstance(selected_ids, list):
            return [int(sid) for sid in selected_ids if isinstance(sid, (int, str)) and str(sid).isdigit()]
        return []
    except Exception:
        return []


def generate_sitrep(
    project_name: str,
    project_description: str,
    updates: list[dict],
    tasks: list[dict],
    model: str | None = None,
) -> str:
    """
    Generates a Situation Report (SITREP) based on the latest 50 updates and the current task list.
    """
    client = _get_client()
    model = model or os.getenv("MODEL", "llama-3.1-8b-instant")

    # Format context for AI
    updates_str = "\n".join([f"- [{u['created_at']}] {u['author_name']}: {u['content'][:200]}" for u in updates])
    tasks_str = "\n".join([f"- [{'DONE' if t['is_done'] else 'PENDING'}] {t['content']}" for t in tasks])

    context = f"""
Sei l'AI di Mission Control per la Task Force: "{project_name}".
Obiettivo: Generare un Situation Report (SITREP) conciso partendo dalla cronologia chat e dai task.

CRONOLOGIA CHAT (Ultimi messaggi):
{updates_str}

STATO TASK:
{tasks_str}

REGOLE DI RISPOSTA:
- Lingua: Italiano.
- Lunghezza: Max 300 parole.
- Stile: Professionale, militare, orientato all'azione.
- Formato Markdown:
  1) **Sintesi Operativa** (Stato attuale)
  2) **Traguardi Raggiunti** (Basati sulla chat)
  3) **Criticità & Blocchi**
  4) **Prossimi Passi Consigliati** (Azioni concrete)
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Sei l'AI di Mission Control per una Task Force operativa. Il tuo obiettivo e la massima efficienza informativa."},
                {"role": "user", "content": context},
            ],
            temperature=0.4,
            max_tokens=800,
        )
        return response.choices[0].message.content or "Impossibile generare il report SITREP."
    except Exception as e:
        return f"Errore durante la generazione del SITREP IA: {str(e)}"

def generate_crm_email(
    prompt: str,
    target_audience: str,
    context: str,
    model: str | None = None,
) -> str:
    """
    Generates a personalized marketing email in HTML format.
    """
    client = _get_client()
    model = model or os.getenv("MODEL", "llama-3.1-8b-instant")

    system = f"""Sei un copywriter esperto di Email Marketing. 
Il tuo obiettivo e scrivere un'email HTML formattata bene basandoti sul prompt dell'utente.
Devi restituire SOLO il codice HTML dell'email senza Markdown avvolgente (niente ```html).
Usa uno stile pulito, persuasivo, inserisci un pulsante CTA visibile e un design base inline.
Target: {target_audience}
Contesto Aziendale: {context}
"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=2000,
        )
        content = response.choices[0].message.content or "<p>Errore di generazione.</p>"
        # Pulizia backticks se la risposta li ha messi lo stesso
        if "```html" in content:
            content = content.replace("```html", "").replace("```", "")
        return content.strip()
    except Exception as e:
        return f"<p>Errore generativo: {e}</p>"
