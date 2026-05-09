import os
import sys
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# 1. SETUP THE FAKE CLOUD ENVIRONMENT
os.environ["HOME"] = "/tmp"
os.environ["HERMES_HOME"] = "/tmp/.hermes"
os.makedirs("/tmp/.hermes", exist_ok=True)

# 2. GRAB THE KEY FROM VERCEL
GROQ_KEY = os.environ.get("GROQ_API_KEY") or os.environ.get("ASSISTANT_API_KEY", "")
os.environ["GROQ_API_KEY"] = GROQ_KEY.strip()

# 3. SIMULATE RUNNING `hermes model`
# This physically writes the config file so the agent stops complaining
config_yaml_path = "/tmp/.hermes/config.yaml"
config_content = f"""
provider: groq
api_key: {GROQ_KEY.strip()}
model: llama-3.1-8b-instant
"""
with open(config_yaml_path, "w") as f:
    f.write(config_content)

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
    try:
        # Fetch properties from DB
        res = supabase.table('properties').select('*').limit(5).execute()
        prop_data = "\n".join([f"- {p.get('title')}: {p.get('price')}" for p in res.data]) if res.data else "No properties."

        # Import Hermes
        from run_agent import AIAgent

        # Initialize Hermes (It will now read the config.yaml we generated!)
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
EOF~
cat > ~/lalarente-agent/api/index.py << 'EOF'
import os
import sys
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# 1. SETUP THE FAKE CLOUD ENVIRONMENT
os.environ["HOME"] = "/tmp"
os.environ["HERMES_HOME"] = "/tmp/.hermes"
os.makedirs("/tmp/.hermes", exist_ok=True)

# 2. GRAB THE KEY FROM VERCEL
GROQ_KEY = os.environ.get("GROQ_API_KEY") or os.environ.get("ASSISTANT_API_KEY", "")
os.environ["GROQ_API_KEY"] = GROQ_KEY.strip()

# 3. SIMULATE RUNNING `hermes model`
# This physically writes the config file so the agent stops complaining
config_yaml_path = "/tmp/.hermes/config.yaml"
config_content = f"""
provider: groq
api_key: {GROQ_KEY.strip()}
model: llama-3.1-8b-instant
"""
with open(config_yaml_path, "w") as f:
    f.write(config_content)

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
    try:
        # Fetch properties from DB
        res = supabase.table('properties').select('*').limit(5).execute()
        prop_data = "\n".join([f"- {p.get('title')}: {p.get('price')}" for p in res.data]) if res.data else "No properties."

        # Import Hermes
        from run_agent import AIAgent

        # Initialize Hermes (It will now read the config.yaml we generated!)
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
