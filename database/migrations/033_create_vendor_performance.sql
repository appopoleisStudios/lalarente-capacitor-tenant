-- Migration 033: Vendor Performance Tracking
-- Creates tables for vendor ratings (multi-dimension), no-show tracking, and warranty management.
-- A trigger keeps profiles.rating in sync with the rolling average from vendor_ratings.

-- =============================================================================
-- vendor_ratings: owner rates vendor after a job is closed
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendor_ratings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_id           UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  -- Dimension ratings (1-5)
  quality_rating       INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  speed_rating         INTEGER CHECK (speed_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  value_rating         INTEGER CHECK (value_rating BETWEEN 1 AND 5),
  -- Computed overall (average of provided dimensions)
  overall_rating       DECIMAL(3,2) GENERATED ALWAYS AS (
    (
      COALESCE(quality_rating, 0) + COALESCE(speed_rating, 0) +
      COALESCE(communication_rating, 0) + COALESCE(value_rating, 0)
    )::DECIMAL /
    NULLIF(
      (CASE WHEN quality_rating IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN speed_rating IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN communication_rating IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN value_rating IS NOT NULL THEN 1 ELSE 0 END), 0
    )
  ) STORED,
  comment              TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (request_id, owner_id)  -- one rating per completed job per owner
);

-- =============================================================================
-- vendor_no_shows: records when a vendor fails to arrive as scheduled
-- Three strikes (per owner) automatically deactivates dedicated vendor relationship
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendor_no_shows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_id     UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  reason         TEXT,
  re_routed      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- vendor_warranties: tracks warranty obligations on completed jobs
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendor_warranties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_id           UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  property_id          UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  description          TEXT NOT NULL,
  warranty_period_days INTEGER NOT NULL DEFAULT 90,
  start_date           DATE NOT NULL,
  expiry_date          DATE NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'claimed', 'resolved', 'expired')),
  claim_description    TEXT,
  claim_date           DATE,
  resolution           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Trigger: keep profiles.rating in sync with vendor_ratings average
-- =============================================================================
CREATE OR REPLACE FUNCTION update_vendor_rating_average()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET rating = (
    SELECT ROUND(AVG(overall_rating)::NUMERIC, 2)
    FROM vendor_ratings
    WHERE vendor_id = NEW.vendor_id
      AND overall_rating IS NOT NULL
  )
  WHERE id = NEW.vendor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendor_rating_avg ON vendor_ratings;
CREATE TRIGGER trg_vendor_rating_avg
  AFTER INSERT OR UPDATE ON vendor_ratings
  FOR EACH ROW EXECUTE FUNCTION update_vendor_rating_average();

-- =============================================================================
-- Trigger: auto-expire warranties past their expiry_date
-- =============================================================================
CREATE OR REPLACE FUNCTION expire_overdue_warranties()
RETURNS void AS $$
BEGIN
  UPDATE vendor_warranties
  SET status = 'expired'
  WHERE status = 'active'
    AND expiry_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE vendor_ratings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_no_shows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_warranties ENABLE ROW LEVEL SECURITY;

-- vendor_ratings
CREATE POLICY "Owners insert ratings"         ON vendor_ratings FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners and vendors view ratings" ON vendor_ratings FOR SELECT USING (owner_id = auth.uid() OR vendor_id = auth.uid());

-- vendor_no_shows
CREATE POLICY "Owners flag no-shows"          ON vendor_no_shows FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners and vendors view no-shows" ON vendor_no_shows FOR SELECT USING (owner_id = auth.uid() OR vendor_id = auth.uid());
CREATE POLICY "Owners update re_routed flag"  ON vendor_no_shows FOR UPDATE USING (owner_id = auth.uid());

-- vendor_warranties
CREATE POLICY "Vendors create warranties"     ON vendor_warranties FOR INSERT WITH CHECK (vendor_id = auth.uid());
CREATE POLICY "Owners and vendors view warranties" ON vendor_warranties FOR SELECT
  USING (vendor_id = auth.uid() OR property_id IN (
    SELECT id FROM properties WHERE owner_id = auth.uid()
  ));
CREATE POLICY "Owners and vendors update warranties" ON vendor_warranties FOR UPDATE
  USING (vendor_id = auth.uid() OR property_id IN (
    SELECT id FROM properties WHERE owner_id = auth.uid()
  ));

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_vendor    ON vendor_ratings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_owner     ON vendor_ratings(owner_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_request   ON vendor_ratings(request_id);
CREATE INDEX IF NOT EXISTS idx_vendor_no_shows_vendor   ON vendor_no_shows(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_warranties_vendor ON vendor_warranties(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_warranties_prop   ON vendor_warranties(property_id);
CREATE INDEX IF NOT EXISTS idx_vendor_warranties_status ON vendor_warranties(status);
