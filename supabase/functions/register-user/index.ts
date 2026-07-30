import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password, fullName, role, businessName } = await req.json();
    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ⚠️ SECURITY: only allowlisted roles — anyone can call this public edge function
    const allowedRoles = ['owner', 'tenant', 'vendor'] as const;
    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Invalid role '${role}'. Allowed: ${allowedRoles.join(', ')}.` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Create user via admin API (auto-confirmed)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

    if (createError || !userData.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create profile
    const profileInsert: Record<string, unknown> = {
      id: userData.user.id,
      full_name: fullName,
      email,
      role,
    };
    if (role === 'vendor' && businessName) {
      profileInsert.business_name = businessName;
    }

    const { error: profileError } = await supabase.from('profiles').insert(profileInsert);
    if (profileError) {
      // Auth user created but profile insert failed — clean up the orphan auth user
      await supabase.auth.admin.deleteUser(userData.user.id).catch(() => {});
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sign in to get session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return new Response(JSON.stringify({ error: signInError?.message || 'Sign in failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      user: userData.user,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
