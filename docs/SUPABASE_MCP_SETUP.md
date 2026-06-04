# Supabase MCP (local only)

Per-repo MCP config is **not** committed. Each developer creates:

**File:** `.cursor/mcp.json` (gitignored)

```json
{
  "mcpServers": {
    "supabase-lalarente": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
    }
  }
}
```

Get `YOUR_PROJECT_REF` from the team vault or Supabase dashboard → Project Settings → General.

Use `read_only=true` for audits; omit only when a reviewed PR requires write access via MCP.
