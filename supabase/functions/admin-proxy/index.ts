// Supabase Edge Function: Admin API Proxy
// Proxies Sentry and Plane API calls from the admin panel,
// bypassing CORS restrictions (Sentry) and private network issues (Plane).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fire-and-forget: insert a row into dev_function_logs via Supabase REST
async function devLog(source: string, level: string, message: string, metadata: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/dev_function_logs`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ source, level, message, metadata }),
    });
  } catch { /* never let logging break the proxy */ }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = Date.now();

  try {
    const { target, path, method, body: requestBody, projectId: reqProjectId, resource: resourceParam, issueId: issueIdParam } = await req.json();

    // ── Sentry proxy ──────────────────────────────────────────
    if (target === 'sentry') {
      const token = Deno.env.get('SENTRY_TOKEN');
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Sentry token not configured. Set SENTRY_TOKEN in Supabase edge function secrets.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = `https://sentry.io/api/0/${path}`;
      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      });

      const text = await res.text();
      const durationMs = Date.now() - t0;

      // Always return 200 — wrap Sentry errors in body so supabase.functions.invoke never throws
      if (!res.ok) {
        let detail = text;
        try { detail = JSON.parse(text)?.detail ?? text; } catch { /* */ }
        devLog('admin-proxy:sentry', 'warn', `Sentry ${res.status}: ${path}`, { path, status: res.status, durationMs });
        return new Response(
          JSON.stringify({ error: `Sentry ${res.status}: ${detail}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      devLog('admin-proxy:sentry', 'info', `GET ${path}`, { path, status: res.status, durationMs });
      return new Response(text, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Plane proxy ──────────────────────────────────────────
    if (target === 'plane') {
      const apiKey = Deno.env.get('PLANE_API_KEY');
      const workspaceSlug = Deno.env.get('PLANE_WORKSPACE_SLUG');
      // projectId: prefer Supabase secret, fall back to value sent from frontend
      const projectId = Deno.env.get('PLANE_PROJECT_ID') || reqProjectId;
      const planeBase = Deno.env.get('PLANE_URL') || Deno.env.get('PLANE_BASE_URL') || 'http://100.79.34.78:8082';

      if (!apiKey || !workspaceSlug || !projectId) {
        return new Response(
          JSON.stringify({ error: 'Plane credentials not configured. Set PLANE_API_KEY and PLANE_WORKSPACE_SLUG in Supabase edge function secrets.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // resource sent as top-level key — supports nested paths like 'issues/{id}/comments'
      const resource = resourceParam || requestBody?.resource || 'issues';
      const issueId = issueIdParam || requestBody?.issueId;
      // If resource already contains slashes it's a full sub-path; otherwise append issueId
      const resourcePath = resource.includes('/') ? resource : (issueId ? `${resource}/${issueId}` : resource);
      const url = `${planeBase}/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/${resourcePath}/`;

      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: requestBody && method !== 'GET' ? JSON.stringify(requestBody) : undefined,
      });

      const data = await res.text();
      const durationMs = Date.now() - t0;
      const level = res.ok ? 'info' : 'warn';
      devLog('admin-proxy:plane', level, `${method || 'GET'} ${resourcePath}`, { resourcePath, status: res.status, durationMs });

      return new Response(data, {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid target. Use "sentry" or "plane".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const durationMs = Date.now() - t0;
    devLog('admin-proxy', 'error', err.message || 'Internal error', { durationMs });
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
