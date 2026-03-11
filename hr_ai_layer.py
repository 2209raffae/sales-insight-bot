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

def analyze_cv(cv_text: str, job_description: str | None = None) -> dict:
    """
    Extracts structured information from CV text and calculates a match score if a Job Description is provided.
    """
    client = _get_client()
    model = os.getenv("MODEL", "llama-3.1-8b-instant")
    
    sys_prompt = "Sei un recruiter esperto. Estrai le informazioni dal CV fornito e restituisci SOLO un JSON valido, senza preamboli o markdown blocks come ```json."
    
    prompt = f"Analizza il seguente CV:\\n{cv_text}\\n\\n"
    if job_description:
        prompt += f"Confrontalo con questa Job Description:\\n{job_description}\\n\\n"
        prompt += "Calcola un `match_score` da 0 a 100 in base all'attinenza del profilo con la JD. Fornisci un breve `match_reasoning`."
    else:
        prompt += "Non è stata fornita una Job Description, imposta `match_score` a null e `match_reasoning` a stringa vuota."
        
    prompt += """
Formato JSON richiesto:
{
  "candidate_name": string (se non trovato "Sconosciuto"),
  "years_of_experience": number (stima totale anni),
  "top_skills": [string, string...],
  "education_summary": string,
  "match_score": number or null,
  "match_reasoning": string,
  "red_flags": [string, string...] (es. buchi nel CV, job hopping frequente)
}
Restituisci ESATTAMENTE e SOLO il JSON.
"""

    try:
        res = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        content = res.choices[0].message.content or "{}"
        # Pulisco eventuali markdown accidentali
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        
        return json.loads(content.strip())
    except Exception as e:
        return {"error": str(e), "candidate_name": "Errore", "top_skills": []}

def analyze_performance(kpi_data: dict) -> str:
    """
    Generates a natural language performance review based on employee metrics.
    """
    client = _get_client()
    model = os.getenv("MODEL", "llama-3.1-8b-instant")
    
    sys_prompt = "Sei un HR Manager. Il tuo compito è scrivere brevi feedback prestazionali chiari, motivanti e bilanciati."
    
    prompt = f"""
Ecco i KPI del dipendente:
```json
{json.dumps(kpi_data, indent=2)}
```
Sintetizza in una breve performance review in lingua italiana. Struttura in 3 punti:
1) **Punti di Forza** (cosa sta andando bene)
2) **Aree di Miglioramento** (dove concentrarsi)
3) **Azione Consigliata** (prossimo passo per il piano di sviluppo).
Sii diretto, professionale e costruttivo.
"""
    try:
        res = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return res.choices[0].message.content or "Impossibile generare la review."
    except Exception as e:
        return f"Errore: {str(e)}"

def policy_chat_reply(chat_history: list, new_message: str) -> str:
    """
    HR Policy bot chat endpoint.
    """
    client = _get_client()
    model = os.getenv("MODEL", "llama-3.1-8b-instant")
    
    sys_prompt = """Sei l'Assistente HR AI aziendale. Conosci le policy su ferie, permessi, remote working e benefit.
Il tuo tono è professionale, empatico e orientato al supporto. Non usare gergo eccessivo.
Se un dipendente chiede policy generiche (perché non hai un DB collegato al momento), invéntati policy verosimili da tech company (es. smart working flessibile ma in accordo col manager, 4 settimane di ferie annue, etc.). 
Indica sempre che queste policy simulate sono a scopo dimostrativo."""

    messages = [{"role": "system", "content": sys_prompt}]
    for msg in chat_history:
        role = "assistant" if msg["sender"] == "ai" else "user"
        messages.append({"role": role, "content": msg["text"]})
    
    messages.append({"role": "user", "content": new_message})
    
    try:
        res = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.4,
            max_tokens=600
        )
        return res.choices[0].message.content or "Scusa, non posso rispondere al momento."
    except Exception as e:
        return f"Errore del bot: {str(e)}"
