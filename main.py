import sys
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client

# Hermes Path
sys.path.insert(0, '/Users/aamirbehlim/.hermes/hermes-agent')
from run_agent import AIAgent

load_dotenv()
app = FastAPI()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
ASSISTANT_MODEL = os.getenv("ASSISTANT_MODEL") or os.getenv("HERMES_MODEL") or "minimax-m2.5:cloud"
ASSISTANT_PROVIDER = os.getenv("ASSISTANT_PROVIDER") or os.getenv("HERMES_PROVIDER") or "custom"
ASSISTANT_BASE_URL = os.getenv("ASSISTANT_BASE_URL") or os.getenv("OPENAI_BASE_URL") or "http://localhost:11434/v1"
ASSISTANT_API_KEY = (
    os.getenv("ASSISTANT_API_KEY")
    or os.getenv("OPENAI_API_KEY")
    or os.getenv("OLLAMA_API_KEY")
    or "no-key-required"
)

def get_properties() -> str:
    try:
        # Fetch properties - ensure your Supabase table has an 'image_url' or 'image' column
        res = supabase.table('properties').select('*').limit(5).execute()
        return str(res.data) if res.data else "No properties available."
    except Exception as e:
        return f"Database error: {e}"


def _is_local_base_url(base_url: str) -> bool:
    hostname = (urlparse(base_url).hostname or "").lower()
    return hostname in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def _models_probe_url(base_url: str) -> str:
    base = (base_url or "").rstrip("/")
    if base.endswith("/v1"):
        return f"{base}/models"
    return f"{base}/v1/models"


def assistant_backend_error() -> str | None:
    if not ASSISTANT_BASE_URL:
        return "Assistant base URL is not configured."
    if ASSISTANT_PROVIDER != "custom" and not _is_local_base_url(ASSISTANT_BASE_URL):
        return None

    probe_url = _models_probe_url(ASSISTANT_BASE_URL)
    try:
        request = Request(probe_url, headers={"Authorization": f"Bearer {ASSISTANT_API_KEY}"})
        with urlopen(request, timeout=2):
            return None
    except HTTPError as exc:
        if exc.code in {401, 403}:
            return (
                f"Assistant backend at {ASSISTANT_BASE_URL} is reachable, but the API key was rejected."
            )
        return (
            f"Assistant backend at {ASSISTANT_BASE_URL} returned HTTP {exc.code} during readiness check."
        )
    except URLError:
        return (
            f"Assistant backend is unavailable at {ASSISTANT_BASE_URL}. "
            f"Start the local model service and make sure `{ASSISTANT_MODEL}` is available."
        )


def format_assistant_error(exc: Exception) -> str:
    error_text = str(exc).strip() or exc.__class__.__name__
    if "Connection refused" in error_text or "Failed to initialize OpenAI client" in error_text:
        return (
            f"Assistant backend is unavailable at {ASSISTANT_BASE_URL}. "
            f"Start the local model service and make sure `{ASSISTANT_MODEL}` is available."
        )
    if "No LLM provider configured" in error_text:
        return (
            "Assistant provider is not configured. Set `ASSISTANT_BASE_URL`, "
            "`ASSISTANT_MODEL`, and `ASSISTANT_API_KEY` in `.env`."
        )
    return f"Assistant request failed: {error_text}"

class Message(BaseModel):
    text: str
    tenant_id: str = "unknown"

@app.post("/agent")
async def agent(msg: Message):
    backend_error = assistant_backend_error()
    if backend_error:
        return {"reply": backend_error}

    prop_data = get_properties()
    
    # Minimalist, clean context
    context = (
        "You are the Lalarente Executive Assistant. You provide high-end property management support. "
        "Your tone is professional, sophisticated, and minimalist. Use bolding for titles only.\n\n"
        "STRICT UI RULES:\n"
        "1. NO tables. NO ASCII boxes. NO excessive emojis.\n"
        "2. For each property, provide Name, Location, and Price on separate lines.\n"
        "3. If an image URL exists in the data, output it on its own line as: [IMG]URL\n"
        f"\nAVAILABLE DATA:\n{prop_data}"
    )
    
    try:
        hermes = AIAgent(
            model=ASSISTANT_MODEL,
            provider=ASSISTANT_PROVIDER,
            base_url=ASSISTANT_BASE_URL,
            api_key=ASSISTANT_API_KEY,
            ephemeral_system_prompt=context,
            quiet_mode=True,
            skip_memory=True,
            skip_context_files=True,
        )
        response = hermes.chat(msg.text)
        return {"reply": response}
    except Exception as exc:
        return {"reply": format_assistant_error(exc)}

@app.get("/health")
async def health():
    backend_error = assistant_backend_error()
    return {
        "status": "ok" if backend_error is None else "degraded",
        "assistant_ready": backend_error is None,
        "assistant_model": ASSISTANT_MODEL,
        "assistant_base_url": ASSISTANT_BASE_URL,
        "assistant_error": backend_error,
    }
