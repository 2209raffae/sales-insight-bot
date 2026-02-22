import py_compile, sys
files = [
    "models.py",
    "database.py",
    "leads_kpi_engine.py",
    "spend_kpi_engine.py",
    "budget_kpi_engine.py",
    "routers/leads_upload.py",
    "routers/leads_kpi.py",
    "routers/spend_upload.py",
    "routers/spend_kpi.py",
    "routers/uploads.py",
    "routers/budgets.py",
    "routers/manual_spend.py",
    "routers/chat.py",
    "main.py",
]
errors = []
for f in files:
    try:
        py_compile.compile(f, doraise=True)
        print(f"  OK  {f}")
    except py_compile.PyCompileError as e:
        errors.append(str(e))
        print(f"  ERR {f}: {e}")

print()
if errors:
    print(f"FAILED: {len(errors)} error(s)")
    sys.exit(1)
else:
    print("All syntax checks passed!")
