# AI Lead & Spend Analytics Copilot

FastAPI + SQLite app for deterministic analytics on:
- Leads
- Spend (CSV + manual entries)
- Monthly budgets
- Upload batch history
- AI chat explanations (Groq explains precomputed KPIs only)

## Run (Windows PowerShell)

```powershell
cd "C:\Users\PC Desktop\.gemini\antigravity\scratch\sales-insight-bot"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open:
- Upload: `http://127.0.0.1:8000/static/index.html`
- Leads KPIs: `http://127.0.0.1:8000/static/leads.html`
- Spend KPIs: `http://127.0.0.1:8000/static/spend.html`
- Budgets: `http://127.0.0.1:8000/static/budgets.html`
- Chat: `http://127.0.0.1:8000/static/chat.html`
- API docs: `http://127.0.0.1:8000/docs`

## Main API routes

- `POST /api/leads/upload`
- `GET /api/leads/status`
- `GET /api/leads/sources`
- `POST /api/spend/upload`
- `GET /api/spend/status`
- `POST /api/spend/manual`
- `GET /api/spend/manual`
- `PUT /api/spend/manual/{entry_id}`
- `DELETE /api/spend/manual/{entry_id}`
- `GET /api/kpi/leads/*`
- `GET /api/kpi/spend/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&mode=actual|planned|both`
- `GET /api/kpi/spend/by-source`
- `GET /api/kpi/spend/cpl`
- `GET /api/kpi/spend/cost-per-winning`
- `GET /api/kpi/spend/alerts`
- `GET /api/kpi/spend/trend`
- `GET /api/uploads`
- `DELETE /api/uploads/{upload_id}`
- `POST /api/chat`

## Notes

- Source values are normalized to uppercase (`trim + uppercase`) on ingest.
- Upload batches are tracked in `upload_batches`; CSV rows are linked via `upload_id`.
- KPI math is deterministic in Python/pandas; LLM does not compute metrics.

## UTF-8 In VS Code

To avoid mojibake (`â‚¬`, `â„¹`, `ðŸ...`) in the UI, keep frontend files as UTF-8 (no BOM).

Recommended VS Code settings:

```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false
}
```

When editing existing files under `static/`:

1. Use the encoding selector in the status bar (bottom-right).
2. If needed, choose `Reopen with Encoding...` then `UTF-8`.
3. Save with `Save with Encoding...` -> `UTF-8`.
