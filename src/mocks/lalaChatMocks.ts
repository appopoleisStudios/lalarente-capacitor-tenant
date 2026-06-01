const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const MOCK_REPLIES = [
  "Your rent payment of ₹15,000 is due on May 25th.",
  "The maintenance request for the water heater has been logged. Technician will visit within 48 hours.",
  "Your lease is valid until December 31, 2026. Would you like to discuss renewal options?",
  "The society meeting is scheduled for next Sunday at 10 AM in the community hall.",
];

export async function sendChatMessage(message: string): Promise<{ reply: string; conversation_id: string }> {
  await delay(1200);
  const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
  return { reply, conversation_id: "mock-conv-" + Date.now() };
}
