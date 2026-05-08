import sys
import os
import telebot
from telebot import apihelper
from dotenv import load_dotenv
from supabase import create_client

# 🛠️ THE FIX: Increase the underlying network timeout to 90 seconds
apihelper.READ_TIMEOUT = 90

# Add Hermes to path
sys.path.insert(0, '/Users/aamirbehlim/.hermes/hermes-agent')
from run_agent import AIAgent

# Load variables from .env
load_dotenv()

# Connect to Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

# Initialize Telegram Bot
bot = telebot.TeleBot(os.getenv("TELEGRAM_TOKEN"))

def get_properties() -> str:
    try:
        res = supabase.table('properties').select('*').limit(5).execute()
        return str(res.data) if res.data else "No properties available."
    except Exception as e:
        return f"Database error: {e}"

@bot.message_handler(func=lambda message: True)
def handle_message(message):
    print(f"\n📩 New Telegram message from {message.chat.first_name}: {message.text}")
    
    # Send a "typing..." indicator to the user
    bot.send_chat_action(message.chat.id, 'typing')
    
    prop_data = get_properties()
    
    # Clean, professional context
    context = (
        "You are the Lalarente Executive Assistant. You provide high-end property management support. "
        "Your tone is professional, sophisticated, and minimalist.\n\n"
        "STRICT UI RULES FOR TELEGRAM:\n"
        "1. NO tables. NO ASCII boxes. Use clean bullet points.\n"
        "2. Keep formatting simple. Use basic emojis.\n"
        f"\nAVAILABLE DATA:\n{prop_data}"
    )
    
    # Spin up Hermes
    hermes = AIAgent(
        model="minimax-m2.5:cloud",
        ephemeral_system_prompt=context,
        quiet_mode=True,
        skip_memory=True,
        skip_context_files=True,
    )
    
    # Get the AI's reply
    response = hermes.chat(message.text)
    
    # Send the reply back to Telegram
    bot.reply_to(message, response)

print("🚀 Lalarente Telegram Bot is online and waiting for messages...")
bot.infinity_polling(timeout=90)
