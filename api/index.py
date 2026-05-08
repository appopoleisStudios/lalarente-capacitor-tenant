import os
import sys
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware

# Force look into the hermes-agent directory
base_path = os.path.dirname(os.path.abspath(__file__))
agent_path = os.path.join(base_path, "..", "hermes-agent")
sys.path.append(agent_path)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
supabase = create_client(os.getenv("SUPABASE_URL").strip(), os.getenv("SUPABASE_KEY").strip())

class ChatRequest(BaseModel):
    text: str
    tenant_id: str

@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    try:
        # Import inside the function to catch specific import errors
        from run_agent import AIAgent
        
        # Get properties for context
        res = supabase.table('properties').select('*').limit(5).execute()
        prop_data = str(res.data) if res.data else "No properties available."

        hermes = AIAgent(
            model=os.getenv("ASSISTANT_MODEL", "llama-3.1-8b-instant"),
            ephemeral_system_prompt=f"You are Hermes. Use this data: {prop_data}",
            quiet_mode=True
        )

        response = hermes.chat(req.text)
        return {"reply": response}

    except ImportError as e:
        print(f"IMPORT ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Hermes Layer Missing: {str(e)}")
    except Exception as e:
        print(f"RUNTIME ERROR: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Hermes Agent Crashed during execution.")

@app.get("/health")
async def health_check():
    return {"status": "ok", "agent_path": agent_path}
