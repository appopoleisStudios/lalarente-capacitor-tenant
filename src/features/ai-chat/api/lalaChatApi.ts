import { supabase } from '@/src/lib/supabase';

export type ChatHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type LalaChatRequest = {
  text: string;
  role: 'tenant' | 'owner';
  property_id?: string | null;
  history?: ChatHistoryTurn[];
};

export type LalaChatResponse = {
  reply: string;
};

const MAX_HISTORY = 12;

export async function sendLalaChatMessage(req: LalaChatRequest): Promise<LalaChatResponse> {
  const history = (req.history ?? []).slice(-MAX_HISTORY);

  const { data, error } = await supabase.functions.invoke<LalaChatResponse>('lala-ai-chat', {
    body: {
      text: req.text,
      role: req.role,
      property_id: req.property_id ?? null,
      history,
    },
  });

  if (error) {
    console.error('lala-ai-chat invoke error:', error);
    throw new Error(error.message || 'AI assistant unavailable');
  }

  if (!data?.reply || typeof data.reply !== 'string') {
    throw new Error('AI response was missing reply text');
  }

  return data;
}
