import os
from dotenv import load_dotenv
from supabase import create_client

# Load the credentials from your .env file
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

print(f"Connecting to: {url}")
supabase = create_client(url, key)

try:
    # We are guessing this table exists based on standard property apps
    response = supabase.table('maintenance_requests').select('*').limit(1).execute()
    print("✅ Success! Data found:", response.data)
except Exception as e:
    print("❌ Error fetching data:", e)
