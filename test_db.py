from database import SessionLocal, text
print("Testing Database connection...")
db = SessionLocal()
try:
    res = db.execute(text("SELECT 1")).fetchone()
    print(f"Database connection successful! Result: {res}")
except Exception as e:
    print(f"Database connection failed: {e}")
finally:
    db.close()
