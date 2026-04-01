import sys
import os
import traceback

# Add current directory to path
sys.path.append(os.getcwd())

print("--- STARTING DEBUG ---")
try:
    print("Step 1: Importing database...")
    from database import engine
    print("Step 2: Importing models...")
    from models import Base
    print("Step 3: Creating metadata...")
    Base.metadata.create_all(bind=engine)
    print("Step 4: Success!")
except Exception as e:
    print("\n--- ERROR DETECTED ---")
    traceback.print_exc()
    sys.exit(1)
