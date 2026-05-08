import os
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

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
groq_client = Groq(api_key=os.getenv("ASSISTANT_API_KEY"))

class ChatRequest(BaseModel):
    text: str
    tenant_id: str

def get_properties() -> str:
    try:
        res = supabase.table('properties').select('*').limit(5).execute()
        return str(res.data) if res.data else "No properties available."
    except Exception as e:
        return f"Database error: {e}"

@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    prop_data = get_properties()
    response = groq_client.chat.completions.create(
        model=os.getenv("ASSISTANT_MODEL", "llama3-8b-8192"),
        messages=[
            {"role": "system", "content": f"You are Hermes, the Lalarente AI assistant. Be professional and concise. Properties: {prop_data}"},
            {"role": "user", "content": req.text}
        ]
    )
    return {"reply": response.choices[0].message.content}

@app.get("/health")
async def health_check():
    return {"status": "ok", "vercel": True, "ai": "groq"}
