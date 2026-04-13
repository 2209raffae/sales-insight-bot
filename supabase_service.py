import os
import httpx
from typing import Optional

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET_NAME = "product-gallery"

async def upload_product_image(file_data: bytes, filename: str, content_type: str) -> Optional[str]:
    """
    Uploads an image to Supabase Storage and returns the public URL.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase credentials missing.")
        return None

    # Supabase expects: /storage/v1/object/{bucket}/{path}
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{filename}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type
    }

    async with httpx.AsyncClient() as client:
        # 1. First, try to ensure bucket is public or check its existence would be complex,
        # but the simple upload is:
        response = await client.post(url, content=file_data, headers=headers)
        
        if response.status_code == 200:
            # Construct public URL
            # Note: Assuming bucket 'product-gallery' is set to public.
            # Format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{filename}"
            return public_url
        else:
            print(f"Upload failed: {response.status_code} - {response.text}")
            return None

def get_public_url(filename: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{filename}"
