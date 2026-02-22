# Deterministic Smoke Test (Leads + Spend + Budgets)

## Expected scope
- No legacy revenue dataset.
- KPIs are deterministic.
- Groq explains KPI output only.

## Validation flow
1. Reset database.
2. Upload leads CSV.
3. Upload spend CSV.
4. Create monthly budget.
5. Add manual spend entry.
6. Verify spend summary `mode=actual|planned|both` in Feb 2026.

## Assertions
- `GET /api/uploads?dataset=leads` returns the leads batch.
- `GET /api/uploads?dataset=spend` returns the spend batch.
- `GET /api/kpi/spend/summary?from=2026-02-01&to=2026-02-28&mode=planned` has non-zero planned spend when budget exists.
- `mode=actual` includes CSV + manual spend.
- `mode=both` = `planned + actual`.
- CPL and cost-per-winning return consistent deterministic values.
