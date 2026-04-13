import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET_NAME = "product-gallery"

async def check_and_fix_bucket():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Credenziali mancanti nel file .env")
        return

    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        # 1. Elenca tutti i bucket
        list_url = f"{SUPABASE_URL}/storage/v1/bucket"
        response = await client.get(list_url, headers=headers)
        
        if response.status_code == 200:
            buckets = response.json()
            bucket_names = [b['name'] for b in buckets]
            print(f"Bucket trovati: {bucket_names}")
            
            if BUCKET_NAME in bucket_names:
                print(f"Il bucket '{BUCKET_NAME}' esiste già.")
                return
        else:
            print(f"Errore nell'elenco dei bucket: {response.status_code} - {response.text}")

        # 2. Se non esiste, crealo
        print(f"Il bucket '{BUCKET_NAME}' non esiste. Tentativo di creazione...")
        create_url = f"{SUPABASE_URL}/storage/v1/bucket"
        payload = {
            "id": BUCKET_NAME,
            "name": BUCKET_NAME,
            "public": True
        }
        create_res = await client.post(create_url, json=payload, headers=headers)
        if create_res.status_code == 200:
            print(f"Bucket '{BUCKET_NAME}' creato con successo.")
        else:
            print(f"Errore nella creazione del bucket: {create_res.status_code} - {create_res.text}")


if __name__ == "__main__":
    asyncio.run(check_and_fix_bucket())
