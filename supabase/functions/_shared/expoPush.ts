/** Server-side Expo push (LAL-134). No-ops when no tokens. */
export async function sendExpoPushToUser(
  supabase: { from: (t: string) => any },
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
  const messages = (tokens || [])
    .map((row: { token?: string }) => row.token)
    .filter((t: unknown) => typeof t === 'string' && String(t).startsWith('ExponentPushToken'))
    .map((to: string) => ({ to, title, body, data, sound: 'default' }));
  if (!messages.length) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  }).catch(() => undefined);
}
