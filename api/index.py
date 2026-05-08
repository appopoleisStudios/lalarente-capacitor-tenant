import os
import sys
import traceback
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# 1. SETUP PATHS: Ensure Vercel can find the 'hermes-agent' folder
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

# 2. CLIENTS: Initialize with .strip() to remove invisible newline characters
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
    """Helper to fetch property data for the Hermes brain."""
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
        # Import the agent logic from your hermes-agent folder
        from run_agent import AIAgent
        
        # Get the latest data from Supabase
        prop_data = get_property_context()

        # Initialize the REAL Hermes with Serverless-Safety flags
        hermes = AIAgent(
            model=os.getenv("ASSISTANT_MODEL", "llama-3.1-8b-instant").strip(),
            ephemeral_system_prompt=(
                "You are Hermes, the Lalarente Executive Assistant. "
                "Your tone is professional, sophisticated, and minimalist. "
                "STRICT RULE: Use ONLY the following property data. Do not hallucinate addresses.\n"
                f"AVAILABLE PROPERTIES:\n{prop_data}"
            ),
            quiet_mode=True,
            skip_memory=True,         # CRITICAL: Vercel doesn't allow writing local memory files
            skip_context_files=True,  # CRITICAL: Vercel can't read local PDF/Docs indexes easily
            no_log=True               # CRITICAL: Vercel doesn't allow writing local log files
        )

        # Process the chat through the Hermes Agent Layer
        response = hermes.chat(req.text)
        
        return {"reply": response}

    except ImportError as e:
        print(f"IMPORT ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Hermes Agent folder not found: {str(e)}")
    except Exception as e:
        # This will print the full error in your 'vercel logs'
        print(f"RUNTIME ERROR: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Hermes Agent crashed. Check Vercel logs for traceback.")

@app.get("/health")
async def health_check():
    return {"status": "ok", "vercel": True, "agent_layer": "hermes-agent-detected"}
