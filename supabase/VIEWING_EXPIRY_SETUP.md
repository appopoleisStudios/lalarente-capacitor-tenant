# Viewing Request Auto-Expiry Setup Guide

## Overview

This guide explains how to set up automatic expiry for viewing requests in LaLarente. The system automatically expires viewing requests that:

1. **Date passed**: Viewing date/time has passed without owner response
2. **24-hour deadline**: Less than 24 hours before viewing and owner hasn't responded
3. **Auto-complete**: Approved viewings where the date has passed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client-Side (Phase 1)                    │
│  ✓ Immediate UI feedback                                     │
│  ✓ Disable expired request buttons                           │
│  ✓ Show "Expired" / "Urgent" badges                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Server-Side (Phase 2)                     │
│  → Supabase Edge Function (hourly cron)                      │
│  → Database function: auto_expire_viewing_requests()          │
│  → Updates database status to 'expired'                      │
│  → Auto-completes past viewings                              │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Client-Side (✅ COMPLETED)

Already implemented in the app:
- `viewingHelpers.ts` - Expiry logic and helper functions
- `OwnerViewingDetailScreen.tsx` - Expired banners and disabled buttons
- `OwnerViewingsScreen.tsx` - Expired badges on list items

## Phase 2: Server-Side Setup

### Step 1: Execute Database Migration

Run the SQL migration to add expiry tracking and the auto-expire function:

```bash
# Option A: Via Supabase Dashboard
# 1. Go to https://app.supabase.com/project/[your-project-id]/sql
# 2. Paste the contents of supabase/viewing-expiry-migration.sql
# 3. Click "Run"

# Option B: Via Supabase CLI
npx supabase db push --file supabase/viewing-expiry-migration.sql
```

**What this does:**
- Adds `expired_at` and `expiry_reason` columns to `viewing_requests` table
- Adds 'expired' status to `viewing_status` enum
- Creates `auto_expire_viewing_requests()` function
- Creates performance index for faster lookups
- Grants necessary permissions

### Step 2: Test the Database Function

Before setting up automation, test that the function works:

```sql
-- Run this in Supabase SQL Editor
SELECT * FROM auto_expire_viewing_requests();
```

Expected output:
```
expired_count | completed_count | message
--------------+-----------------+----------------------------------------
            2 |               1 | Expired 2 requests, completed 1 viewings
```

### Step 3: Set Up Automated Cron Job

You have **two options** for automating the expiry:

#### Option A: Using pg_cron (Recommended - Simpler)

Run this SQL in Supabase Dashboard:

```sql
-- Schedule function to run every hour at minute 0
SELECT cron.schedule(
  'auto-expire-viewing-requests',  -- Job name
  '0 * * * *',                     -- Cron expression (every hour)
  $$SELECT auto_expire_viewing_requests()$$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'auto-expire-viewing-requests';
```

#### Option B: Using Supabase Edge Function with HTTP Cron

1. **Deploy the Edge Function:**
   ```bash
   npx supabase functions deploy auto-expire-viewings
   ```

2. **Set up HTTP Cron Trigger:**
   ```sql
   SELECT cron.schedule(
     'auto-expire-viewings-http',
     '0 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://[your-project-id].supabase.co/functions/v1/auto-expire-viewings',
       headers := jsonb_build_object(
         'Authorization', 'Bearer [your-service-role-key]',
         'Content-Type', 'application/json'
       )
     )
     $$
   );
   ```

3. **Replace placeholders:**
   - `[your-project-id]`: Your Supabase project ID (from project URL)
   - `[your-service-role-key]`: Get from Project Settings → API → service_role key

### Step 4: Verify Cron is Running

Check cron job status:

```sql
-- View all cron jobs
SELECT * FROM cron.job;

-- View recent cron runs
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-expire-viewing-requests')
ORDER BY start_time DESC
LIMIT 10;
```

### Step 5: Manual Testing

Test the cron manually to ensure it works:

```bash
# If using Edge Function (Option B):
curl -X POST https://[your-project-id].supabase.co/functions/v1/auto-expire-viewings \
  -H "Authorization: Bearer [your-service-role-key]" \
  -H "Content-Type: application/json"

# If using pg_cron (Option A):
# Run this SQL:
SELECT auto_expire_viewing_requests();
```

## Expiry Rules

| Scenario | Condition | Action | Expiry Reason |
|----------|-----------|--------|---------------|
| **No response, date passed** | Status = pending, viewing date/time < now | Status → expired | `viewing_date_passed_no_response` |
| **24h deadline missed** | Status = pending, <24h until viewing | Status → expired | `response_deadline_missed` |
| **Viewing completed** | Status = approved, viewing date/time < now | Status → completed | N/A (auto-complete) |

## Monitoring

### Check Expired Requests

```sql
-- View all expired requests
SELECT
  id,
  property_id,
  tenant_id,
  requested_date,
  requested_time,
  expired_at,
  expiry_reason,
  status
FROM viewing_requests
WHERE status = 'expired'
ORDER BY expired_at DESC;
```

### Check Cron Performance

```sql
-- View cron execution history
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-expire-viewing-requests')
ORDER BY start_time DESC
LIMIT 20;
```

## Troubleshooting

### Issue: Cron job not running

**Check if cron is enabled:**
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-expire-viewing-requests';
```

**Check for errors:**
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-expire-viewing-requests')
AND status = 'failed'
ORDER BY start_time DESC;
```

### Issue: Function not expiring requests

**Verify index exists:**
```sql
SELECT * FROM pg_indexes WHERE indexname = 'idx_viewing_requests_expiry_lookup';
```

**Check for requests that should be expired:**
```sql
-- Find pending requests with passed dates
SELECT
  id,
  requested_date,
  requested_time,
  (requested_date + requested_time::TIME) as viewing_datetime,
  NOW() as current_time,
  status
FROM viewing_requests
WHERE status = 'pending'
AND (requested_date + requested_time::TIME) < NOW();
```

### Issue: Permission errors

**Grant execute permission:**
```sql
GRANT EXECUTE ON FUNCTION auto_expire_viewing_requests() TO service_role;
GRANT EXECUTE ON FUNCTION auto_expire_viewing_requests() TO authenticated;
```

## Maintenance

### Disable Cron Job

```sql
-- Disable the cron job (keeps it in database but stops execution)
SELECT cron.unschedule('auto-expire-viewing-requests');
```

### Re-enable Cron Job

```sql
-- Re-create the cron job
SELECT cron.schedule(
  'auto-expire-viewing-requests',
  '0 * * * *',
  $$SELECT auto_expire_viewing_requests()$$
);
```

### Change Cron Schedule

```sql
-- Unschedule old job
SELECT cron.unschedule('auto-expire-viewing-requests');

-- Create new job with different schedule (e.g., every 30 minutes)
SELECT cron.schedule(
  'auto-expire-viewing-requests',
  '*/30 * * * *',  -- Every 30 minutes
  $$SELECT auto_expire_viewing_requests()$$
);
```

## Performance Considerations

- **Index**: The migration creates `idx_viewing_requests_expiry_lookup` for fast lookups
- **Execution time**: Typically <100ms for small datasets, <1s for 10,000+ requests
- **Load**: Minimal - only updates requests that meet expiry criteria
- **Frequency**: Hourly is sufficient; more frequent runs waste resources

## Security

- Function uses `SECURITY DEFINER` to run with elevated privileges
- Only `service_role` and `authenticated` roles have execute permission
- No user input - function is fully automated
- Logs all actions for audit trail

## Next Steps

1. ✅ Execute database migration (Step 1)
2. ✅ Test function manually (Step 2)
3. ✅ Set up cron job (Step 3)
4. ✅ Verify cron is running (Step 4)
5. 🔄 Monitor for 24-48 hours
6. 📊 Check metrics and adjust if needed

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Supabase logs: Database → Logs
3. Review cron execution history (SQL provided above)
4. Check GitHub issues or create new issue

---

**Last Updated:** January 31, 2026
**Status:** Ready for deployment
