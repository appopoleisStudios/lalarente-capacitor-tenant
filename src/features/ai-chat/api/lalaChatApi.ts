import { FunctionsHttpError } from '@supabase/supabase-js';
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

async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error('Could not load your session. Please sign in again.');
  }
  if (session?.access_token) {
    return session.access_token;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session?.access_token) {
    throw new Error('Please sign in again to use Lala.');
  }
  return refreshed.session.access_token;
}

async function parseInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string' && body.error.length > 0) {
        return body.error;
      }
    } catch {
      /* ignore parse failures */
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'AI assistant unavailable';
}

export async function sendLalaChatMessage(req: LalaChatRequest): Promise<LalaChatResponse> {
  const accessToken = await getAccessToken();
  const history = (req.history ?? []).slice(-MAX_HISTORY);

  const { data, error } = await supabase.functions.invoke<LalaChatResponse>('lala-ai-chat', {
    body: {
      text: req.text,
      role: req.role,
      property_id: req.property_id ?? null,
      history,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const message = await parseInvokeError(error);
    console.error('lala-ai-chat invoke error:', message, error);
    throw new Error(message);
  }

  if (!data?.reply || typeof data.reply !== 'string') {
    throw new Error('AI response was missing reply text');
  }

  return data;
}
