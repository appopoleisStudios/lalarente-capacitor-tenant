import os
import sys
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# 1. SETUP PATHS
base_path = os.path.dirname(os.path.abspath(__file__))
agent_path = os.path.join(base_path, "..", "hermes-agent")
sys.path.append(agent_path)

app = FastAPI(title="Lalarente Hermes Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# 2. INIT SUPABASE SAFELY
try:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"SUPABASE INIT FAILED: {e}")
    supabase = None

class ChatRequest(BaseModel):
    text: str
    tenant_id: str

@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    try:
        # 3. THE GHOST TRICK (Moved inside the route so it doesn't crash the Vercel build)
        os.environ["HOME"] = "/tmp"
        os.environ["HERMES_HOME"] = "/tmp/.hermes"
        os.makedirs("/tmp/.hermes", exist_ok=True)

        GROQ_KEY = os.environ.get("GROQ_API_KEY") or os.environ.get("ASSISTANT_API_KEY", "")
        os.environ["GROQ_API_KEY"] = GROQ_KEY.strip()

        config_yaml_path = "/tmp/.hermes/config.yaml"
        config_content = f"provider: groq\napi_key: {GROQ_KEY.strip()}\nmodel: llama-3.1-8b-instant\n"
        with open(config_yaml_path, "w") as f:
            f.write(config_content)

        # 4. Fetch properties from DB
        prop_data = "No properties available."
        if supabase:
            res = supabase.table('properties').select('*').limit(5).execute()
            if res.data:
                prop_data = "\n".join([f"- {p.get('title')}: {p.get('price')}" for p in res.data])

        # 5. Import and Run Hermes
        from run_agent import AIAgent

        hermes = AIAgent(
            ephemeral_system_prompt=f"You are Hermes, the Lalarente Assistant.\nAVAILABLE PROPERTIES:\n{prop_data}",
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
