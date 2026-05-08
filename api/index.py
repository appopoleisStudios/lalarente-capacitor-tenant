import os
import sys
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# 1. Point FastAPI to the Hermes logic folder
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../hermes-agent'))

try:
    from run_agent import AIAgent
except ImportError:
    # Fallback if the folder structure is nested differently in Vercel
    sys.path.insert(0, './hermes-agent')
    from run_agent import AIAgent

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(os.getenv("SUPABASE_URL").strip(), os.getenv("SUPABASE_KEY").strip())

class ChatRequest(BaseModel):
    text: str
    tenant_id: str

def get_properties() -> str:
    try:
        res = supabase.table('properties').select('*').limit(5).execute()
        return str(res.data) if res.data else "No properties currently listed."
    except Exception as e:
        return f"DB Error: {e}"

@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    prop_data = get_properties()
    
    # This is the "Hermes Layer" you're looking for.
    # It uses the actual AIAgent class from your hermes-agent folder.
    hermes = AIAgent(
        model=os.getenv("ASSISTANT_MODEL", "llama-3.1-8b-instant"),
        ephemeral_system_prompt=(
            "You are the Lalarente Executive Assistant. "
            "Use only this data to answer. Do not hallucinate. "
            f"DATA: {prop_data}"
        ),
        quiet_mode=True,
        skip_memory=False # Keep the conversation flow
    )

    # The agent processes the logic (Tool use/Grounding)
    response = hermes.chat(req.text)
    
    # Return the real agent's response
    return {"reply": response}

@app.get("/health")
async def health_check():
    return {"status": "ok", "layer": "hermes-agent-active"}
