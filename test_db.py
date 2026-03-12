import os
from sqlalchemy import create_engine
import traceback

DB_URL = "postgresql://postgres.ebcyurvujemufpcwqjwj:12opi6QWDq5tYzMh@aws-1-eu-west-2.pooler.supabase.com:5432/postgres"

try:
    print(f"Trying to connect to: {DB_URL.replace('12opi6QWDq5tYzMh', '***')}")
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        print("CONNECTION SUCCESSFUL!")
except Exception as e:
    print("CONNECTION FAILED!")
    traceback.print_exc()
