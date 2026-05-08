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

def get_val(item, keys):
    """Helper to find data even if column names are slightly different."""
    for k in keys:
        if k in item and item[k] is not None:
            return item[k]
    return "Contact for Price" if "price" in keys[0] else "Unknown Location"

@app.post("/agent", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    try:
        res = supabase.table('properties').select('*').limit(5).execute()
        raw_props = res.data or []
    except:
        raw_props = []
    
    # Create the context string for the AI
    context_string = ""
    for p in raw_props:
        # Tries to match common column names automatically
        name = get_val(p, ['title', 'name', 'heading'])
        price = get_val(p, ['price', 'rent', 'amount', 'cost'])
        loc = get_val(p, ['location', 'address', 'city', 'area'])
        context_string += f"- {name}: {price} in {loc}\n"

    system_instruction = (
        "You are the Lalarente Assistant. "
        "STRICT RULES:\n"
        "1. ONLY use the provided data. If data is missing or says 'Unknown', tell the user you don't have that info yet.\n"
        "2. Do NOT mention 'Test Property A' or any property not in the list.\n"
        "3. Be brief (1-2 sentences). No fluff.\n\n"
        f"CURRENT DATA FROM DATABASE:\n{context_string if context_string else 'NO DATA FOUND.'}"
    )

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "system", "content": system_instruction}, {"role": "user", "content": req.text}],
        temperature=0.0 # Force accuracy
    )
    
    return {"reply": response.choices[0].message.content, "properties": raw_props}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
