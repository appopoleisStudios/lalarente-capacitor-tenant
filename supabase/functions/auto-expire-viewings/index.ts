// ============================================================================
// SUPABASE EDGE FUNCTION: Auto-Expire Viewing Requests
// ============================================================================
// This function automatically expires old viewing requests and completes
// past viewings. It should be triggered via cron every hour.
//
// Cron Schedule: 0 * * * * (every hour at minute 0)
//
// Author: LaLarente Team
// Date: 2026-01-31
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🕐 Auto-expire viewings function triggered');

    // Create Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the database function to expire viewings
    const { data, error } = await supabase.rpc('auto_expire_viewing_requests');

    if (error) {
      console.error('❌ Error calling auto_expire_viewing_requests:', error);
      throw error;
    }

    // Extract results
    const result = data?.[0] || { expired_count: 0, completed_count: 0, message: 'No action taken' };

    console.log('✅ Auto-expire completed:', result);

    // ========================================================================
    // OPTIONAL: Send notifications to affected users
    // ========================================================================
    // This section can be uncommented when notification system is ready

    /*
    if (result.expired_count > 0 || result.completed_count > 0) {
      // Get expired requests to send notifications
      const { data: expiredRequests } = await supabase
        .from('viewing_requests')
        .select(`
          id,
          tenant_id,
          property_id,
          expiry_reason,
          property:properties(title),
          tenant:profiles!viewing_requests_tenant_id_fkey(email, full_name)
        `)
        .eq('status', 'expired')
        .not('expired_at', 'is', null)
        .gte('expired_at', new Date(Date.now() - 3600000).toISOString()); // Last hour

      // Send expiry notifications
      for (const request of expiredRequests || []) {
        try {
          await supabase.rpc('send_notification', {
            user_id: request.tenant_id,
            notification_type: 'viewing_expired',
            data: {
              propertyTitle: request.property?.title,
              reason: request.expiry_reason,
            },
          });
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          // Don't fail the whole function if notification fails
        }
      }
    }
    */

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        expired_count: result.expired_count,
        completed_count: result.completed_count,
        message: result.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// ============================================================================
// DEPLOYMENT INSTRUCTIONS
// ============================================================================
/*

1. Deploy this function:
   npx supabase functions deploy auto-expire-viewings

2. Set up cron trigger in Supabase Dashboard:
   - Go to Database → Cron Jobs
   - Create new job:
     * Name: Auto-expire viewing requests
     * Schedule: 0 * * * * (every hour)
     * Command: SELECT net.http_post(
                  url := 'https://[your-project-id].supabase.co/functions/v1/auto-expire-viewings',
                  headers := jsonb_build_object('Authorization', 'Bearer [your-service-role-key]')
                );

3. Or use pg_cron SQL directly:
   SELECT cron.schedule(
     'auto-expire-viewings',
     '0 * * * *',
     $$SELECT auto_expire_viewing_requests()$$
   );

4. Test manually:
   curl -X POST https://[your-project-id].supabase.co/functions/v1/auto-expire-viewings \
     -H "Authorization: Bearer [your-service-role-key]"

*/
