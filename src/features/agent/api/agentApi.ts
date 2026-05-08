import Constants from 'expo-constants';

const AGENT_URL =
  Constants.expoConfig?.extra?.agentUrl ||
  process.env.EXPO_PUBLIC_AGENT_URL ||
  'https://lalarente-backend.vercel.app';

export async function sendMessageToAgent(text: string, tenantId: string): Promise<string> {
  const response = await fetch(`${AGENT_URL}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, tenant_id: tenantId }),
  });

  if (!response.ok) {
    throw new Error(`Agent request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data?.reply || typeof data.reply !== 'string') {
    throw new Error('Agent response was missing reply text');
  }

  return data.reply;
}
