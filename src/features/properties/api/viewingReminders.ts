import { supabase } from '../../../lib/supabase';
import { notificationsApi } from '../../notifications/api/notificationsApi';

/**
 * Viewing Reminder System
 *
 * This module handles automated reminders for upcoming viewing appointments.
 *
 * PRODUCTION IMPLEMENTATION:
 * This should be called by:
 * 1. Supabase Edge Function (serverless function triggered by cron)
 * 2. Background job scheduler (e.g., node-cron, bull queue)
 * 3. Cloud scheduler (AWS Lambda, Google Cloud Scheduler)
 *
 * SETUP INSTRUCTIONS:
 *
 * Option 1: Supabase Edge Function with pg_cron
 * -----------------------------------------------
 * 1. Create Edge Function: supabase/functions/send-viewing-reminders/index.ts
 * 2. Deploy: `supabase functions deploy send-viewing-reminders`
 * 3. Schedule with pg_cron in database:
 *    ```sql
 *    SELECT cron.schedule(
 *      'send-viewing-reminders',
 *      '0 9 * * *',  -- Run daily at 9 AM
 *      $$
 *      SELECT net.http_post(
 *        url := 'https://[PROJECT_REF].supabase.co/functions/v1/send-viewing-reminders',
 *        headers := '{"Authorization": "Bearer [ANON_KEY]", "Content-Type": "application/json"}'::jsonb,
 *        body := '{}'::jsonb
 *      ) AS request_id;
 *      $$
 *    );
 *    ```
 *
 * Option 2: Background Worker Process
 * ------------------------------------
 * 1. Create worker script that imports this module
 * 2. Use node-cron to schedule: `cron.schedule('0 9 * * *', sendViewingReminders)`
 * 3. Deploy as separate service (e.g., Heroku worker, AWS ECS task)
 *
 * Option 3: React Native Background Task (Limited)
 * -------------------------------------------------
 * 1. Use expo-task-manager with Background Fetch
 * 2. NOTE: Not reliable for exact timing, only for opportunistic updates
 * 3. Better for client-side notifications when app is in background
 */

/**
 * Send reminders for viewings happening tomorrow
 * Call this function daily (recommended time: 9 AM)
 */
export async function sendViewingReminders(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Get tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];

    console.log(`Checking for viewings on ${tomorrowStr}`);

    // Get all approved viewings for tomorrow that haven't had reminders sent
    const { data: viewings, error } = await supabase
      .from('viewing_requests')
      .select(`
        id,
        tenant_id,
        owner_id,
        property_id,
        confirmed_date,
        confirmed_time,
        reminder_sent_at,
        property:properties (
          title
        ),
        tenant:profiles!tenant_id (
          full_name
        ),
        owner:profiles!owner_id (
          full_name
        )
      `)
      .eq('status', 'approved')
      .gte('confirmed_date', tomorrowStr)
      .lt('confirmed_date', dayAfterTomorrowStr)
      .is('reminder_sent_at', null);

    if (error) {
      console.error('Error fetching viewings for reminders:', error);
      results.errors.push(error.message);
      return results;
    }

    if (!viewings || viewings.length === 0) {
      console.log('No viewings found for tomorrow');
      return results;
    }

    console.log(`Found ${viewings.length} viewings for tomorrow`);

    // Send reminder to both tenant and owner for each viewing
    for (const viewing of viewings) {
      try {
        const propertyTitle = viewing.property?.title || 'the property';
        const viewingTime = viewing.confirmed_time || 'the scheduled time';

        // Send to tenant
        await notificationsApi.sendNotification({
          user_id: viewing.tenant_id,
          type: 'viewing_reminder',
          priority: 'high',
          data: {
            viewingId: viewing.id,
            propertyId: viewing.property_id,
            propertyTitle,
            viewingDate: viewing.confirmed_date,
            viewingTime,
            ownerName: viewing.owner?.full_name,
          },
        });

        // Send to owner
        await notificationsApi.sendNotification({
          user_id: viewing.owner_id,
          type: 'viewing_reminder',
          priority: 'high',
          data: {
            viewingId: viewing.id,
            propertyId: viewing.property_id,
            propertyTitle,
            viewingDate: viewing.confirmed_date,
            viewingTime,
            tenantName: viewing.tenant?.full_name,
          },
        });

        // Mark reminder as sent
        await supabase
          .from('viewing_requests')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', viewing.id);

        results.success++;
        console.log(`✓ Sent reminder for viewing ${viewing.id}`);
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Viewing ${viewing.id}: ${errorMsg}`);
        console.error(`✗ Failed to send reminder for viewing ${viewing.id}:`, error);
      }
    }

    console.log(`Reminder job complete: ${results.success} sent, ${results.failed} failed`);
    return results;
  } catch (error) {
    console.error('Fatal error in sendViewingReminders:', error);
    results.errors.push(error instanceof Error ? error.message : 'Fatal error');
    return results;
  }
}

/**
 * Example Edge Function Implementation
 * Save this to: supabase/functions/send-viewing-reminders/index.ts
 *
 * ```typescript
 * import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
 * import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
 *
 * serve(async (req) => {
 *   // Verify this is a scheduled call (optional security)
 *   const authHeader = req.headers.get('Authorization')
 *   if (!authHeader) {
 *     return new Response('Unauthorized', { status: 401 })
 *   }
 *
 *   const supabaseClient = createClient(
 *     Deno.env.get('SUPABASE_URL') ?? '',
 *     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
 *   )
 *
 *   // Import and call the reminder function
 *   // Note: You'll need to adapt the function or recreate the logic here
 *   const results = await sendViewingReminders(supabaseClient)
 *
 *   return new Response(
 *     JSON.stringify(results),
 *     { headers: { 'Content-Type': 'application/json' } }
 *   )
 * })
 * ```
 */

/**
 * Example node-cron implementation
 * For a Node.js background worker
 *
 * ```typescript
 * import cron from 'node-cron';
 * import { sendViewingReminders } from './viewingReminders';
 *
 * // Run every day at 9 AM
 * cron.schedule('0 9 * * *', async () => {
 *   console.log('Running viewing reminders job...');
 *   const results = await sendViewingReminders();
 *   console.log('Results:', results);
 * });
 * ```
 */
