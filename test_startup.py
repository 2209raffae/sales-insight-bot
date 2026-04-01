from main import on_startup
print("Manually triggering on_startup to debug migrations...")
try:
    on_startup()
    print("on_startup completed successfully!")
except Exception as e:
    print(f"CRASH in on_startup: {e}")
    import traceback
    traceback.print_exc()
