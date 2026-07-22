// ============================================================================
// SUPABASE EDGE FUNCTION: Admin API Proxy
// ============================================================================
// Proxies Sentry, Plane, GitHub, and Supabase Management API calls from the
// admin panel, bypassing CORS restrictions and keeping credentials server-side.
//
// SECURITY: Requires a valid admin JWT with role='admin' AND dev_admin=true.
// Anyone calling this function without admin credentials is rejected at the
// auth gate (before any proxy target code runs).
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Auth guard ──────────────────────────────────────────────────────────
// Requires the caller to have role='admin' AND dev_admin=true.
// Both checks are enforced here (not just one) because this function proxies
// sensitive tokens (GitHub, Sentry, Plane, Supabase Management).

async function verifyAdminProxy(
  authHeader: string
): Promise<{ user: any; error: Response | null }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return { user: null, error: new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )};
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { user: null, error: new Response(
      JSON.stringify({ error: 'Authorization header required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )};
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, error: new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )};
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dev_admin')
    .eq('id', user.id)
    .single();

  // Require BOTH role='admin' AND dev_admin=true for proxy access
  if (!profile || (profile as any).role !== 'admin' || !(profile as any).dev_admin) {
    return { user: null, error: new Response(
      JSON.stringify({ error: 'Forbidden: dev admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )};
  }

  return { user, error: null };
}

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

  // ── AUTH GATE ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const { error: authError } = await verifyAdminProxy(authHeader);
  if (authError) return authError;

  const t0 = Date.now();

  try {
    const { target, path, method, body: requestBody, projectId: reqProjectId, resource: resourceParam, issueId: issueIdParam, ...payload } = await req.json();

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
      const projectId = Deno.env.get('PLANE_PROJECT_ID') || reqProjectId;
      const planeBase = Deno.env.get('PLANE_URL') || Deno.env.get('PLANE_BASE_URL') || 'http://100.79.34.78:8082';

      if (!apiKey || !workspaceSlug || !projectId) {
        return new Response(
          JSON.stringify({ error: 'Plane credentials not configured. Set PLANE_API_KEY and PLANE_WORKSPACE_SLUG in Supabase edge function secrets.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resource = resourceParam || requestBody?.resource || 'issues';
      const issueId = issueIdParam || requestBody?.issueId;
      const resourcePath = resource.includes('/') ? resource : (issueId ? `${resource}/${issueId}` : resource);
      const url = `${planeBase}/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/${resourcePath}/`;

      let sendBody;
      if (payload && Object.keys(payload).length > 0) {
        sendBody = payload;
      } else if (requestBody) {
        sendBody = requestBody;
      }

      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: sendBody && method !== 'GET' ? JSON.stringify(sendBody) : undefined,
      });

      const text = await res.text();
      const durationMs = Date.now() - t0;
      devLog('admin-proxy:plane', res.ok ? 'info' : 'warn', `${method || 'GET'} ${resourcePath}`, { resourcePath, status: res.status, durationMs });

      if (res.status === 204) {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      if (!res.ok) {
        let detail = text;
        try { detail = JSON.parse(text)?.detail ?? JSON.parse(text)?.error ?? text; } catch { /* */ }
        return new Response(
          JSON.stringify({ error: `Plane ${res.status}: ${detail}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(text, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── GitHub proxy ──────────────────────────────────────────
    if (target === 'github') {
      const token = Deno.env.get('GITHUB_TOKEN');
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'GitHub token not configured. Set GITHUB_TOKEN in Supabase edge function secrets.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = `https://api.github.com/${path}`;
      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'lalarente-admin-proxy',
        },
        body: requestBody && method !== 'GET' ? JSON.stringify(requestBody) : undefined,
      });

      const text = await res.text();
      const durationMs = Date.now() - t0;

      if (!res.ok) {
        let detail = text;
        try { detail = JSON.parse(text)?.message ?? text; } catch { /* */ }
        devLog('admin-proxy:github', 'warn', `GitHub ${res.status}: ${path}`, { path, status: res.status, durationMs });
        return new Response(
          JSON.stringify({ error: `GitHub ${res.status}: ${detail}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      devLog('admin-proxy:github', 'info', `GET ${path}`, { path, status: res.status, durationMs });
      return new Response(text, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Supabase Management API proxy ──────────────────────────────────────────
    if (target === 'supabase-mgmt') {
      const token = Deno.env.get('ADMIN_MGMT_TOKEN');
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Supabase management token not configured. Set ADMIN_MGMT_TOKEN in Supabase edge function secrets.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = `https://api.supabase.com/${path}`;
      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: requestBody && method !== 'GET' ? JSON.stringify(requestBody) : undefined,
      });

      const text = await res.text();
      const durationMs = Date.now() - t0;

      if (!res.ok) {
        let detail = text;
        try { detail = JSON.parse(text)?.message ?? text; } catch { /* */ }
        devLog('admin-proxy:supabase-mgmt', 'warn', `Supabase ${res.status}: ${path}`, { path, status: res.status, durationMs });
        return new Response(
          JSON.stringify({ error: `Supabase API ${res.status}: ${detail}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      devLog('admin-proxy:supabase-mgmt', 'info', `${method || 'GET'} ${path}`, { path, status: res.status, durationMs });
      return new Response(text, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid target. Use "sentry", "plane", "github", or "supabase-mgmt".' }),
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
