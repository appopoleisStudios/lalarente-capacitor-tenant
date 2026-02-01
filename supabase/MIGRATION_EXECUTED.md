# Viewing Expiry Migration - Execution Record

**Date Executed:** February 1, 2026 06:57 UTC
**Executed By:** Claude via Supabase MCP
**Project:** Lalarente (vvepwaolnkzfzhzgxlwr)
**Status:** ✅ COMPLETED SUCCESSFULLY

---

## Changes Applied

### 1. Database Schema Changes ✅

**Added Columns:**
- `viewing_requests.expired_at` (TIMESTAMP WITH TIME ZONE)
- `viewing_requests.expiry_reason` (TEXT)

**Updated Constraints:**
- Modified `viewing_requests_status_check` to include 'expired' status
- Previous values: pending, approved, declined, completed, cancelled
- New values: pending, approved, declined, completed, cancelled, **expired**

### 2. Database Function Created ✅

**Function:** `auto_expire_viewing_requests()`
- **Returns:** TABLE (expired_count INTEGER, completed_count INTEGER, message TEXT)
- **Security:** SECURITY DEFINER
- **Purpose:** Automatically expires old viewing requests and completes past viewings

**Business Logic:**
1. **Expire pending requests** where viewing date/time has passed
   - Reason: `viewing_date_passed_no_response`
2. **Expire pending requests** where <24 hours until viewing with no response
   - Reason: `response_deadline_missed`
3. **Auto-complete approved viewings** where viewing date/time has passed

### 3. Performance Optimization ✅

**Index Created:** `idx_viewing_requests_expiry_lookup`
- Columns: (status, requested_date, requested_time)
- Condition: WHERE status IN ('pending', 'approved') AND expired_at IS NULL
- Purpose: Optimize auto-expiry function performance

### 4. Extensions Enabled ✅

**pg_cron Extension:** Enabled
- Required for scheduled cron jobs

### 5. Cron Job Configured ✅

**Job Name:** auto-expire-viewing-requests
- **Schedule:** `0 * * * *` (every hour at minute 0)
- **Command:** `SELECT auto_expire_viewing_requests()`
- **Status:** Active ✅
- **Database:** postgres
- **User:** postgres

### 6. Permissions Granted ✅

**Execute Permissions:**
- `service_role` - Can execute auto_expire_viewing_requests()
- `authenticated` - Can execute auto_expire_viewing_requests()

---

## Test Results

### Initial Test (February 1, 2026 06:57 UTC)

**Function Execution:**
```sql
SELECT * FROM auto_expire_viewing_requests();
```

**Result:**
```
expired_count | completed_count | message
--------------+-----------------+----------------------------------------
            1 |               0 | Expired 1 requests, completed 0 viewings
```

**Expired Request Details:**
- **ID:** 687dff56-675b-4f7f-95d9-06d1e97a3a77
- **Requested Date:** 2026-01-25 at 14:40
- **Status:** expired (was: pending)
- **Expiry Reason:** viewing_date_passed_no_response
- **Expired At:** 2026-02-01 06:57:16.798853+00

✅ **Test Passed** - Function correctly identified and expired the past viewing request.

---

## Monitoring Commands

### Check Cron Job Status
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-expire-viewing-requests';
```

### View Recent Cron Executions
```sql
SELECT
    jobid,
    runid,
    job_pid,
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

### View All Expired Requests
```sql
SELECT
    id,
    requested_date,
    requested_time,
    status,
    expired_at,
    expiry_reason
FROM viewing_requests
WHERE status = 'expired'
ORDER BY expired_at DESC;
```

### Manually Run Expiry Function
```sql
SELECT * FROM auto_expire_viewing_requests();
```

---

## Next Automated Run

**Scheduled For:** Next hour at :00 minutes (e.g., 07:00, 08:00, 09:00, etc.)

The cron job will run automatically every hour and:
1. Find viewing requests that meet expiry criteria
2. Update their status to 'expired'
3. Set expiry_reason and expired_at timestamp
4. Auto-complete approved viewings that have passed

---

## Rollback Instructions (If Needed)

If you need to rollback this migration:

```sql
-- 1. Remove cron job
SELECT cron.unschedule('auto-expire-viewing-requests');

-- 2. Drop function
DROP FUNCTION IF EXISTS auto_expire_viewing_requests();

-- 3. Drop index
DROP INDEX IF EXISTS idx_viewing_requests_expiry_lookup;

-- 4. Remove columns
ALTER TABLE viewing_requests
DROP COLUMN IF EXISTS expired_at,
DROP COLUMN IF EXISTS expiry_reason;

-- 5. Revert constraint (optional - only if you want to disallow 'expired' status)
ALTER TABLE viewing_requests
DROP CONSTRAINT viewing_requests_status_check;

ALTER TABLE viewing_requests
ADD CONSTRAINT viewing_requests_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'completed'::text, 'cancelled'::text]));
```

---

## Files Modified in Repository

- ✅ `supabase/viewing-expiry-migration.sql` - Migration script (reference)
- ✅ `supabase/VIEWING_EXPIRY_SETUP.md` - Setup documentation
- ✅ `supabase/functions/auto-expire-viewings/index.ts` - Edge function (optional alternative)
- ✅ `supabase/MIGRATION_EXECUTED.md` - This file (execution record)

---

**Execution Time:** ~5 minutes
**No Downtime:** Migration executed with zero downtime
**Data Loss:** None

✅ **Migration Successful**
