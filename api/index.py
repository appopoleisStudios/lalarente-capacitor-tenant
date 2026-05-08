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

@app.post("/agent", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    # DEBUG: See what is actually in the table
    try:
        res = supabase.table('properties').select('*').limit(5).execute()
        raw_props = res.data
        print(f"DEBUG DATA: {raw_props}")
    except Exception as e:
        print(f"SUPABASE ERROR: {e}")
        raw_props = []
    
    if not raw_props:
        return {
            "reply": "I am connected to the database, but your 'properties' table appears to be empty or inaccessible. Please check your Supabase dashboard.",
            "properties": []
        }

    context_string = "\n".join([f"- {p.get('title')}: ${p.get('price')} ({p.get('location')})" for p in raw_props])

    system_instruction = (
        "You are the Lalarente Assistant. Be concise (max 2 sentences). "
        "Only talk about these properties:\n" + context_string
    )

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "system", "content": system_instruction}, {"role": "user", "content": req.text}],
        temperature=0.1
    )
    
    return {"reply": response.choices[0].message.content, "properties": raw_props}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
