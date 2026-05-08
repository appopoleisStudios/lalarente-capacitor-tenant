import os
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
supabase = create_client(os.getenv("SUPABASE_URL").strip(), os.getenv("SUPABASE_KEY").strip())
groq_client = Groq(api_key=os.getenv("ASSISTANT_API_KEY").strip())

# Models for structured communication
class ChatRequest(BaseModel):
    text: str
    tenant_id: str

class ChatResponse(BaseModel):
    reply: str
    properties: List[dict] = [] # This allows the app to show images

def fetch_property_data() -> List[dict]:
    """Fetches full property records including image_url from Supabase."""
    try:
        # Ensure your Supabase table has a column named 'image_url' or similar
        res = supabase.table('properties').select('*').limit(3).execute()
        return res.data if res.data else []
    except Exception as e:
        print(f"Database error: {e}")
        return []

@app.post("/agent", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    # 1. Get the raw data from Supabase
    property_list = fetch_property_data()
    
    # 2. Convert data to a string for the AI's "eyes"
    context_data = "\n".join([
        f"- {p.get('title', 'Property')}: ${p.get('price', 'N/A')}. Location: {p.get('location', 'N/A')}" 
        for p in property_list
    ])

    system_instruction = (
        "You are the Lalarente Executive Assistant. "
        "Your tone is professional, sophisticated, minimalist, and humanzie. "
        "Mention specific properties from the data provided if relevant. "
        f"AVAILABLE PROPERTIES:\n{context_data}"
    )

    # 3. Get the AI's sophisticated reply
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": req.text}
        ]
    )
    
    # 4. Return the Text AND the Data (which includes image URLs)
    return {
        "reply": response.choices[0].message.content,
        "properties": property_list
    }

@app.get("/health")
async def health_check():
    return {"status": "ok", "vercel": True, "ai": "groq"}
