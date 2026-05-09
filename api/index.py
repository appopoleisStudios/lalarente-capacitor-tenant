import os
import sys
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# Force Hermes Home
os.environ["HOME"] = "/tmp"
os.environ["HERMES_HOME"] = "/tmp/.hermes"
os.makedirs("/tmp/.hermes", exist_ok=True)

# SETUP PATHS
base_path = os.path.dirname(os.path.abspath(__file__))
agent_path = os.path.join(base_path, "..", "hermes-agent")
sys.path.append(agent_path)

app = FastAPI(title="Lalarente Hermes Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

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

@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    # 1. THE X-RAY CHECK
    # We check both variable names just to be safe.
    actual_key = os.environ.get("GROQ_API_KEY") or os.environ.get("ASSISTANT_API_KEY")
    
    if not actual_key:
        return {"reply": "VERCEL ERROR: Vercel is NOT passing the GROQ_API_KEY to the backend. Please check your Vercel Dashboard Environment Variables and ensure 'Production' is checked."}

    # Force the key into the environment so Hermes can't miss it
    os.environ["GROQ_API_KEY"] = actual_key.strip()

    try:
        from run_agent import AIAgent
        
        # Fetch properties
        res = supabase.table('properties').select('*').limit(5).execute()
        prop_data = "\n".join([f"- {p.get('title')}: {p.get('price')}" for p in res.data]) if res.data else "No properties."

        hermes = AIAgent(
            provider="groq",
            api_key=os.environ["GROQ_API_KEY"],
            model="llama-3.1-8b-instant",
            ephemeral_system_prompt=f"You are Hermes. AVAILABLE PROPERTIES:\n{prop_data}",
            quiet_mode=True,
            skip_memory=True,         
            skip_context_files=True
        )

        response = hermes.chat(req.text)
        return {"reply": response}

    except Exception as e:
        print(f"RUNTIME ERROR: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Hermes Agent crashed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
