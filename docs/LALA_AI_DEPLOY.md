# Lala AI Edge Function — deploy checklist

After PR merge, configure **Supabase project** `vvepwaolnkzfzhzgxlwr`:

## Secrets (Dashboard → Edge Functions → Secrets)

| Secret | Required |
|--------|----------|
| `GROQ_API_KEY` | Yes |
| `GROQ_MODEL` | Optional (default `llama-3.1-8b-instant`) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## Deploy

```bash
supabase functions deploy lala-ai-chat --project-ref vvepwaolnkzfzhzgxlwr
```

## Verify

```bash
# With a valid user JWT from the app:
curl -X POST "https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/lala-ai-chat" \
  -H "Authorization: Bearer USER_JWT" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","role":"tenant","history":[]}'
```

## SA notes

- JWT required; role checked against `profiles.role`
- Context loaded with service role (scoped to authenticated user id)
- Groq key never shipped in mobile app
