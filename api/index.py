import os
import sys
from fastapi import FastAPI
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# Point to the packaged Hermes folder
sys.path.insert(0, './hermes-agent')
from run_agent import AIAgent

app = FastAPI()

# Crucial for React Native / Web communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

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
    print(f"📩 App message from Tenant {req.tenant_id}: {req.text}")
    
    prop_data = get_properties()
    
    context = (
        "You are the Lalarente Executive Assistant. You provide high-end property management support. "
        "Your tone is professional, sophisticated, and minimalist.\n\n"
        "STRICT UI RULES:\n"
        "1. NO markdown tables. NO ASCII boxes.\n"
        "2. Keep formatting simple for mobile rendering.\n"
        f"\nAVAILABLE DATA:\n{prop_data}"
    )
    
    # Spin up Hermes (It will grab Groq settings automatically from Vercel's env variables)
    hermes = AIAgent(
        model=os.getenv("ASSISTANT_MODEL", "llama3-8b-8192"),
        ephemeral_system_prompt=context,
        quiet_mode=True,
        skip_memory=True,
        skip_context_files=True,
    )
    
    response = hermes.chat(req.text)
    return {"reply": response}

@app.get("/health")
async def health_check():
    return {"status": "ok", "vercel": True, "ai": "groq"}
