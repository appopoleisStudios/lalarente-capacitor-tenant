import os
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
 
app = FastAPI(title="Lalarente Hermes Real Estate Backend")
 
# ✅ CORS — credentials=False is correct when using wildcard origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ─── INIT SUPABASE ────────────────────────────────────────────────────────────
supabase = None
try:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        print("SUPABASE INIT SKIPPED: Missing URL or KEY")
except Exception as e:
    print(f"SUPABASE INIT FAILED: {e}")
 
# ─── INIT GROQ ────────────────────────────────────────────────────────────────
groq_client = None
try:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip() or os.getenv("ASSISTANT_API_KEY", "").strip()
    if GROQ_API_KEY:
        groq_client = Groq(api_key=GROQ_API_KEY)
    else:
        print("GROQ INIT SKIPPED: Missing GROQ_API_KEY")
except Exception as e:
    print(f"GROQ INIT FAILED: {e}")
 
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
 
 
# ─── REQUEST MODEL ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    text: str
    tenant_id: str
    role: str = "tenant"            # "tenant" or "owner"
    property_id: str | None = None  # optional: scope to a single property
    history: list[dict] = []        # conversation memory for multi-turn chat
 
 
# ─── DATA HELPERS ─────────────────────────────────────────────────────────────
 
def fmt_property(p: dict) -> str:
    """Format a single property record into a readable block for the LLM."""
    title     = p.get("title")     or "Untitled Property"
    price     = p.get("price")     or "Contact for Price"
    location  = p.get("location")  or "Unknown Location"
    bedrooms  = p.get("bedrooms")  or "N/A"
    bathrooms = p.get("bathrooms") or "N/A"
    area      = p.get("area_sqft") or "N/A"
    status    = p.get("status")    or "Available"
 
    # Amenities — stored as array or comma string
    raw_amenities = p.get("amenities") or []
    if isinstance(raw_amenities, list):
        amenities = ", ".join(raw_amenities) if raw_amenities else "Not listed"
    else:
        amenities = str(raw_amenities) or "Not listed"
 
    # Photos — stored as URL array in 'photos' column
    raw_photos = p.get("photos") or []
    if isinstance(raw_photos, list) and raw_photos:
        photos = "\n    ".join(raw_photos[:4])  # cap at 4 photos
    else:
        photos = "No photos available"
 
    description = p.get("description") or ""
 
    return (
        f"Property: {title}\n"
        f"  Status    : {status}\n"
        f"  Price     : {price}\n"
        f"  Location  : {location}\n"
        f"  Bedrooms  : {bedrooms} | Bathrooms: {bathrooms} | Area: {area} sq ft\n"
        f"  Amenities : {amenities}\n"
        f"  Photos    :\n    {photos}\n"
        + (f"  Details   : {description}\n" if description else "")
    )
 
 
def fmt_maintenance(m: dict) -> str:
    """Format a maintenance request for the owner view."""
    mid      = m.get("id")          or "—"
    title    = m.get("title")       or "Untitled Request"
    status   = m.get("status")      or "Pending"
    priority = m.get("priority")    or "Normal"
    unit     = m.get("unit")        or "Unknown Unit"
    tenant   = m.get("tenant_name") or "Unknown Tenant"
    date     = m.get("created_at", "")[:10] if m.get("created_at") else "—"
    notes    = m.get("notes")       or ""
    return (
        f"[#{mid}] {title}\n"
        f"  Unit: {unit} | Tenant: {tenant} | Priority: {priority} | "
        f"Status: {status} | Submitted: {date}"
        + (f"\n  Notes: {notes}" if notes else "")
    )
 
 
# ─── CONTEXT BUILDERS ────────────────────────────────────────────────────────
 
def build_tenant_context(tenant_id: str, property_id: str | None) -> str:
    """Fetch properties (+ amenities, photos) visible to this tenant."""
    if not supabase:
        return "Database unavailable."
 
    query = supabase.table("properties").select("*").eq("tenant_id", tenant_id)
    if property_id:
        query = query.eq("id", property_id)
    res = query.limit(5).execute()
 
    if not res.data:
        return "No properties found for this account."
 
    return "\n\n".join(fmt_property(p) for p in res.data)
 
 
def build_owner_context(owner_id: str) -> dict:
    """
    Fetch properties + maintenance requests + lease summary for the owner.
    """
    if not supabase:
        return {"properties": "Database unavailable.", "maintenance": "", "leases": ""}
 
    # Properties owned
    prop_res = supabase.table("properties").select("*").eq("owner_id", owner_id).limit(10).execute()
    properties = (
        "\n\n".join(fmt_property(p) for p in prop_res.data)
        if prop_res.data else "No properties found."
    )
 
    # Maintenance requests
    maint_res = (
        supabase.table("maintenance_requests")
        .select("*")
        .eq("owner_id", owner_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    maintenance = (
        "\n".join(fmt_maintenance(m) for m in maint_res.data)
        if maint_res.data else "No maintenance requests found."
    )
 
    # Lease summary
    lease_res = (
        supabase.table("leases")
        .select("unit, tenant_name, rent_amount, lease_end, status")
        .eq("owner_id", owner_id)
        .limit(10)
        .execute()
    )
    if lease_res.data:
        leases = "\n".join([
            f"  - Unit {l.get('unit','?')}: {l.get('tenant_name','?')} | "
            f"Rent: ${l.get('rent_amount','?')} | "
            f"Lease ends: {str(l.get('lease_end','?'))[:10]} | "
            f"Status: {l.get('status','?')}"
            for l in lease_res.data
        ])
    else:
        leases = "No active leases found."
 
    return {"properties": properties, "maintenance": maintenance, "leases": leases}
 
 
# ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
 
def build_tenant_prompt(prop_context: str) -> str:
    return f"""You are Hermes, the executive virtual assistant for Lalarente — a premium real estate platform.
You are currently speaking with a TENANT.
 
YOUR PERSONALITY:
- Professional, warm, and concise
- Never invent data; if something is missing, say so gracefully
- Maximum 3-4 sentences per response unless listing details
 
YOUR CAPABILITIES FOR THIS TENANT:
1. Show property details: price, location, bedrooms, bathrooms, floor area
2. List all amenities available at their property
3. Share photo URLs when asked — present them as a clean numbered list
4. Answer questions about lease terms, rent, and availability status
5. Guide tenants on how to submit a maintenance request
6. Provide move-in checklist and key contact information if asked
 
STRICT RULES:
- Only reference properties listed in AVAILABLE PROPERTIES below
- Never hallucinate prices, addresses, amenities, or photo URLs
- If photos are available, always mention them and share the URLs
- If any detail is missing, say: "I don't have that detail yet — please contact your property manager."
 
AVAILABLE PROPERTIES:
{prop_context}
"""
 
 
def build_owner_prompt(ctx: dict) -> str:
    return f"""You are Hermes, the executive virtual assistant for Lalarente — a premium real estate platform.
You are currently speaking with a PROPERTY OWNER / MANAGER.
 
YOUR PERSONALITY:
- Professional, data-driven, and to the point
- Proactively surface urgent items: high-priority maintenance, expiring leases
- Maximum 4-5 sentences per response unless presenting a structured list
 
YOUR CAPABILITIES FOR THIS OWNER:
1. Portfolio overview — all properties with status, price, and occupancy
2. Maintenance requests — filter or summarise by status (Pending / In Progress / Resolved) or priority
3. Lease information — active tenants, monthly rent, lease expiry dates
4. Urgent alerts — flag HIGH PRIORITY maintenance and leases expiring within 30 days
5. Tenant lookup — find which tenant is in which unit and their lease details
 
STRICT RULES:
- Only reference data in the sections below
- Never invent tenant names, rent amounts, or request IDs
- Always flag HIGH PRIORITY maintenance items at the top of your response
- If data is missing, say: "I don't have that on record — please check the dashboard."
 
PORTFOLIO:
{ctx['properties']}
 
MAINTENANCE REQUESTS (Latest 10):
{ctx['maintenance']}
 
ACTIVE LEASES:
{ctx['leases']}
"""
 
 
# ─── MAIN ENDPOINT ────────────────────────────────────────────────────────────
 
@app.post("/agent")
async def chat_endpoint(req: ChatRequest):
    if not groq_client:
        raise HTTPException(
            status_code=500,
            detail="Groq API key is missing. Add GROQ_API_KEY to Vercel environment variables."
        )
 
    role = req.role.lower().strip()
    if role not in ("tenant", "owner"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'tenant' or 'owner'.")
 
    try:
        # Build role-appropriate system prompt with live data
        if role == "tenant":
            prop_context  = build_tenant_context(req.tenant_id, req.property_id)
            system_prompt = build_tenant_prompt(prop_context)
        else:
            owner_ctx     = build_owner_context(req.tenant_id)
            system_prompt = build_owner_prompt(owner_ctx)
 
        # Assemble full message list with conversation history
        messages = [{"role": "system", "content": system_prompt}]
        for turn in req.history:
            if isinstance(turn, dict) and turn.get("role") in ("user", "assistant"):
                messages.append({
                    "role": turn["role"],
                    "content": str(turn.get("content", ""))
                })
        messages.append({"role": "user", "content": req.text})
 
        # Call Groq
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=400,
        )
 
        return {"reply": response.choices[0].message.content}
 
    except Exception as e:
        print(f"RUNTIME ERROR: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")
 
 
# ─── HEALTH ──────────────────────────────────────────────────────────────────
 
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "mode": "hermes-real-estate",
        "supabase": supabase is not None,
        "groq": groq_client is not None,
        "model": GROQ_MODEL,
    }
