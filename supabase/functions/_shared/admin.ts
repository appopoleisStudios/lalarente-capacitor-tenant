// ============================================================================
// SHARED: Admin authentication helper
// ============================================================================
// Verifies the JWT from the Authorization header and checks that the caller
// has admin role or dev_admin flag. Import in any Edge Function that requires
// admin-only access.
//
// Usage:
//   import { verifyAdmin } from '../_shared/admin.ts';
//   const { user, error } = await verifyAdmin(supabase, authHeader);
//   if (error) return error;
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function verifyAdmin(
  supabase: ReturnType<typeof createClient>,
  authHeader: string
): Promise<{ user: any; error: Response | null }> {
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })};
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, dev_admin')
    .eq('id', user.id)
    .single();

  // Require role='admin'. dev_admin is a sub-flag for dev tools access only.
  if (!profile || (profile as any).role !== 'admin') {
    return { user: null, error: new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })};
  }

  return { user, error: null };
}
