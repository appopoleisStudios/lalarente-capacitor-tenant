import os
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(os.getenv("SUPABASE_URL").strip(), os.getenv("SUPABASE_KEY").strip())
groq_client = Groq(api_key=os.getenv("ASSISTANT_API_KEY").strip())

class ChatRequest(BaseModel):
    text: str
    tenant_id: str

class ChatResponse(BaseModel):
    reply: str
    properties: List[dict] = []

def get_real_properties() -> List[dict]:
    try:
        # SELECT specific columns to ensure we get the image_url
        res = supabase.table('properties').select('id, title, price, location, image_url').limit(3).execute()
        return res.data if res.data else []
    except:
        return []

@app.post("/agent", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    raw_props = get_real_properties()
    
    # Format properties for the AI's "Eyes"
    context_string = ""
    for p in raw_props:
        context_string += f"- {p.get('title')}: ${p.get('price')} in {p.get('location')}\n"

    # THE MASTER PROMPT (Grounding + Conciseness)
    system_instruction = (
        "You are the Lalarente Assistant. "
        "STRICT RULES:\n"
        "1. ONLY discuss properties listed in the 'REAL_DATA' section below.\n"
        "2. If a property is not in 'REAL_DATA', say you don't have information on it.\n"
        "3. NEVER invent addresses (like Dolphin Crescent).\n"
        "4. Be extremely concise. Max 2 short sentences.\n"
        "5. Tone: Professional and direct.\n\n"
        f"REAL_DATA:\n{context_string if context_string else 'No properties currently available.'}"
    )

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": req.text}
        ],
        temperature=0.1, # Lower temperature = less hallucination
        max_tokens=100   # Hard limit on length
    )
    
    return {
        "reply": response.choices[0].message.content,
        "properties": raw_props # The app uses this for images
    }

@app.get("/health")
async def health_check():
    return {"status": "ok"}
