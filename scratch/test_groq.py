import asyncio
import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

async def test():
    c = AsyncOpenAI(api_key=os.getenv('GROQ_API_KEY'), base_url='https://api.groq.com/openai/v1')
    try:
        r = await c.chat.completions.create(
            messages=[{'role':'user', 'content':'test'}], 
            model='llama-3.1-8b-instant'
        )
        print(r)
    except Exception as e:
        print(f"Exception: {repr(e)}")

asyncio.run(test())
