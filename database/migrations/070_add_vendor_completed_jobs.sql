-- Migration 070: Vendor directory completed-job + rating aggregates
-- Keeps public aggregates on vendor profiles without exposing maintenance rows
-- or vendor_ratings (those are owner/vendor-only). Migration 033 created
-- vendor_ratings and a profiles.rating trigger but never added the column,
-- so directory SELECT rating, completed_jobs 400s and the sim shows
-- "Failed to load vendors".

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS completed_jobs INTEGER NOT NULL DEFAULT 0
  CHECK (completed_jobs >= 0);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2)
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

-- Contact/email checks must not block aggregate column updates (or vendors with
-- empty contact would 400 the directory backfill and future job completions).
CREATE OR REPLACE FUNCTION public.enforce_vendor_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.phone IS NOT DISTINCT FROM OLD.phone
     AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;
  IF NEW.role = 'vendor'
     AND COALESCE(NEW.email, '') = ''
     AND COALESCE(NEW.phone, '') = '' THEN
    RAISE EXCEPTION 'Vendor must have at least one contact (email or phone)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_email_format()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.profiles AS profile
SET completed_jobs = (
  SELECT COUNT(*)::INTEGER
  FROM public.maintenance_requests AS request
  WHERE request.selected_vendor_id = profile.id
    AND request.status = 'completed'
)
WHERE profile.role = 'vendor';

CREATE OR REPLACE FUNCTION public.sync_vendor_completed_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.selected_vendor_id IS NOT NULL AND OLD.status = 'completed' THEN
      UPDATE public.profiles
      SET completed_jobs = GREATEST(completed_jobs - 1, 0)
      WHERE id = OLD.selected_vendor_id
        AND role = 'vendor';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.selected_vendor_id IS NOT NULL AND NEW.status = 'completed' THEN
      UPDATE public.profiles
      SET completed_jobs = completed_jobs + 1
      WHERE id = NEW.selected_vendor_id
        AND role = 'vendor';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.selected_vendor_id IS NOT NULL
    AND OLD.status = 'completed'
    AND (
      NEW.selected_vendor_id IS DISTINCT FROM OLD.selected_vendor_id
      OR NEW.status IS DISTINCT FROM OLD.status
    )
  THEN
    UPDATE public.profiles
    SET completed_jobs = GREATEST(completed_jobs - 1, 0)
    WHERE id = OLD.selected_vendor_id
      AND role = 'vendor';
  END IF;

  IF NEW.selected_vendor_id IS NOT NULL
    AND NEW.status = 'completed'
    AND (
      OLD.selected_vendor_id IS DISTINCT FROM NEW.selected_vendor_id
      OR OLD.status IS DISTINCT FROM NEW.status
    )
  THEN
    UPDATE public.profiles
    SET completed_jobs = completed_jobs + 1
    WHERE id = NEW.selected_vendor_id
      AND role = 'vendor';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_vendor_completed_jobs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_vendor_completed_jobs ON public.maintenance_requests;
CREATE TRIGGER trg_sync_vendor_completed_jobs
  AFTER INSERT OR UPDATE OR DELETE
  ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vendor_completed_jobs();

COMMENT ON COLUMN public.profiles.completed_jobs IS
  'Count of maintenance requests whose selected vendor is this profile and whose status is completed.';

UPDATE public.profiles AS profile
SET rating = sub.avg_rating
FROM (
  SELECT
    vendor_id,
    ROUND(AVG(overall_rating)::NUMERIC, 2) AS avg_rating
  FROM public.vendor_ratings
  WHERE overall_rating IS NOT NULL
  GROUP BY vendor_id
) AS sub
WHERE profile.id = sub.vendor_id
  AND profile.role = 'vendor';

-- 033 trigger wrote profiles.rating without adding the column. Recreate as DEFINER.
CREATE OR REPLACE FUNCTION public.update_vendor_rating_average()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor uuid;
BEGIN
  v_vendor := COALESCE(NEW.vendor_id, OLD.vendor_id);
  UPDATE public.profiles
  SET rating = (
    SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
    FROM public.vendor_ratings
    WHERE vendor_id = v_vendor
      AND overall_rating IS NOT NULL
  )
  WHERE id = v_vendor;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.update_vendor_rating_average() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vendor_rating_avg ON public.vendor_ratings;
CREATE TRIGGER trg_vendor_rating_avg
  AFTER INSERT OR UPDATE OR DELETE
  ON public.vendor_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_rating_average();

COMMENT ON COLUMN public.profiles.rating IS
  'Rolling average of vendor_ratings.overall_rating for directory cards.';
