import os
import sys
import traceback
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# 1. THE "HOME TRICK": Force the agent to use /tmp for any hidden writes
os.environ["HOME"] = "/tmp"
os.environ["XDG_CACHE_HOME"] = "/tmp"

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

# CLIENTS
try:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"FAILED TO INIT SUPABASE: {e}")

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

@app.get("/")
async def root():
    return {"message": "Lalarente AI Backend is Online", "docs": "/docs"}

@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    try:
        from run_agent import AIAgent
        
        prop_data = get_property_context()

        # Initialize the Agent
        hermes = AIAgent(
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
        # If it still crashes, we see exactly where it is trying to write
        error_msg = traceback.format_exc()
        print(f"RUNTIME ERROR: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Hermes Agent crashed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "ok", "home_dir": os.environ.get("HOME")}
