import os
import sys
import traceback
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# 1. THE CLOUD WORKAROUND: Trick Hermes into thinking it's already set up
os.environ["HOME"] = "/tmp"
os.environ["HERMES_HOME"] = "/tmp/.hermes"
os.makedirs("/tmp/.hermes", exist_ok=True)

# 2. MAP API KEYS: Ensure Groq can find its key under the standard name
GROQ_KEY = os.getenv("ASSISTANT_API_KEY", "").strip()
os.environ["GROQ_API_KEY"] = GROQ_KEY

# SETUP PATHS
base_path = os.path.dirname(os.path.abspath(__file__))
agent_path = os.path.join(base_path, "..", "hermes-agent")
sys.path.append(agent_path)

app = FastAPI(title="Lalarente Hermes Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# INIT SUPABASE
try:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"SUPABASE INIT FAILED: {e}")

class ChatRequest(BaseModel):
    text: str
    tenant_id: str

def get_property_context() -> str:
    try:
        res = supabase.table('properties').select('*').limit(5).execute()
        if res.data:
            return "\n".join([f"- {p.get('title', 'Property')}: {p.get('price', 'N/A')} in {p.get('location', 'N/A')}" for p in res.data])
        return "No properties currently available."
    except Exception as e:
        return f"Property data unavailable (DB Error: {e})"

@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    try:
        from run_agent import AIAgent
        
        prop_data = get_property_context()

        # 3. INITIALIZE WITH EXPLICIT PROVIDER
        # This bypasses the need for a 'config.yaml' file
        hermes = AIAgent(
            provider="groq",
            api_key=GROQ_KEY,
            model=os.getenv("ASSISTANT_MODEL", "llama-3.1-8b-instant").strip(),
            ephemeral_system_prompt=(
                "You are Hermes, the Lalarente Executive Assistant. "
                "Tone: Professional, sophisticated, and minimalist. "
                f"AVAILABLE PROPERTIES:\n{prop_data}"
            ),
            quiet_mode=True,
            skip_memory=True,         
            skip_context_files=True
        )

        response = hermes.chat(req.text)
        return {"reply": response}

    except Exception as e:
        error_msg = traceback.format_exc()
        print(f"RUNTIME ERROR: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Hermes Agent crashed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "ok", "vercel": True, "hermes_home": os.environ.get("HERMES_HOME")}
