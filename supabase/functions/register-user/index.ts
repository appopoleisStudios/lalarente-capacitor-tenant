import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Action: revoke_sessions — invalidates all sessions for a user ─────
    // Strategy: change password (invalidates all sessions), then restore it.
    if (body.action === 'revoke_sessions') {
      const { email, originalPassword } = body;
      if (!email || !originalPassword) {
        return new Response(JSON.stringify({ error: 'Missing email or originalPassword' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify password is correct before any destructive action
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: originalPassword });
      if (verifyError) {
        return new Response(JSON.stringify({ error: 'Invalid originalPassword - cannot revoke sessions' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find user by email (explicit pagination to handle >50 users)
      const { data: users, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const user = users.users.find(u => u.email === email);
      if (!user) {
        return new Response(JSON.stringify({ error: `User not found: ${email}` }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 1: Generate random temp password (invalidates all existing sessions)
      const tempPassword = crypto.randomUUID();
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: tempPassword,
      });

      if (updateError) {
        return new Response(JSON.stringify({ error: `Failed to update password: ${updateError.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 2: Restore original password
      const { error: restoreError } = await supabase.auth.admin.updateUserById(user.id, {
        password: originalPassword,
      });

      if (restoreError) {
        return new Response(JSON.stringify({
          error: `Sessions revoked but password restore failed: ${restoreError.message}`,
          warning: `User ${email} has temp password. Contact support.`,
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        message: `Sessions revoked for ${email}`,
        user_id: user.id,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Default action: register_user — creates a new user ─────────────────
    const { email, password, fullName, role, businessName } = body;
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
