// Supabase Edge Function: Admin API Proxy
// Proxies Sentry and Plane API calls from the admin panel,
// bypassing CORS restrictions (Sentry) and private network issues (Plane).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target, path, method, body: requestBody, projectId: reqProjectId } = await req.json();

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

      const data = await res.text();
      return new Response(data, {
        status: res.status,
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

      // resource: 'issues' (default) | 'states'
      const resource = requestBody?.resource || 'issues';
      const baseUrl = `${planeBase}/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/${resource}`;
      const issueId = requestBody?.issueId;
      const url = issueId ? `${baseUrl}/${issueId}/` : `${baseUrl}/`;

      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: requestBody && method !== 'GET' ? JSON.stringify(requestBody) : undefined,
      });

      const data = await res.text();
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
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
