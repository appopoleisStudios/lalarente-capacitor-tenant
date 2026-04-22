-- Migration 021: SA Public Holidays Reference Table
-- Used by business day calculations for legal compliance deadlines.
-- Source: Public Holidays Act 36 of 1994, Department of Labour

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sa_public_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  year INTEGER NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR FROM holiday_date)::INTEGER) STORED,
  is_observed BOOLEAN DEFAULT FALSE, -- True when shifted from weekend
  original_date DATE, -- Original date if observed on different day
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one entry per date
ALTER TABLE sa_public_holidays
  ADD CONSTRAINT uq_sa_public_holidays_date UNIQUE (holiday_date);

-- Index for year-based lookups
CREATE INDEX idx_sa_public_holidays_year ON sa_public_holidays (year);
CREATE INDEX idx_sa_public_holidays_date ON sa_public_holidays (holiday_date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE sa_public_holidays ENABLE ROW LEVEL SECURITY;

-- Public holidays are read-only reference data, visible to all authenticated users
CREATE POLICY "sa_public_holidays_read_all"
  ON sa_public_holidays FOR SELECT
  TO authenticated
  USING (true);

-- ─── Seed Data: 2025–2028 ───────────────────────────────────────────────────

INSERT INTO sa_public_holidays (holiday_date, holiday_name, is_observed, original_date) VALUES
  -- 2025
  ('2025-01-01', 'New Year''s Day', FALSE, NULL),
  ('2025-03-21', 'Human Rights Day', FALSE, NULL),
  ('2025-04-18', 'Good Friday', FALSE, NULL),
  ('2025-04-21', 'Family Day', FALSE, NULL),
  ('2025-04-28', 'Freedom Day (observed)', TRUE, '2025-04-27'),
  ('2025-05-01', 'Workers'' Day', FALSE, NULL),
  ('2025-06-16', 'Youth Day', FALSE, NULL),
  ('2025-08-09', 'National Women''s Day', FALSE, NULL),
  ('2025-09-24', 'Heritage Day', FALSE, NULL),
  ('2025-12-16', 'Day of Reconciliation', FALSE, NULL),
  ('2025-12-25', 'Christmas Day', FALSE, NULL),
  ('2025-12-26', 'Day of Goodwill', FALSE, NULL),

  -- 2026
  ('2026-01-01', 'New Year''s Day', FALSE, NULL),
  ('2026-03-21', 'Human Rights Day', FALSE, NULL),
  ('2026-04-03', 'Good Friday', FALSE, NULL),
  ('2026-04-06', 'Family Day', FALSE, NULL),
  ('2026-04-27', 'Freedom Day', FALSE, NULL),
  ('2026-05-01', 'Workers'' Day', FALSE, NULL),
  ('2026-06-16', 'Youth Day', FALSE, NULL),
  ('2026-08-10', 'National Women''s Day (observed)', TRUE, '2026-08-09'),
  ('2026-09-24', 'Heritage Day', FALSE, NULL),
  ('2026-12-16', 'Day of Reconciliation', FALSE, NULL),
  ('2026-12-25', 'Christmas Day', FALSE, NULL),
  ('2026-12-26', 'Day of Goodwill', FALSE, NULL),

  -- 2027
  ('2027-01-01', 'New Year''s Day', FALSE, NULL),
  ('2027-03-22', 'Human Rights Day (observed)', TRUE, '2027-03-21'),
  ('2027-03-26', 'Good Friday', FALSE, NULL),
  ('2027-03-29', 'Family Day', FALSE, NULL),
  ('2027-04-27', 'Freedom Day', FALSE, NULL),
  ('2027-05-01', 'Workers'' Day', FALSE, NULL),
  ('2027-06-16', 'Youth Day', FALSE, NULL),
  ('2027-08-09', 'National Women''s Day', FALSE, NULL),
  ('2027-09-24', 'Heritage Day', FALSE, NULL),
  ('2027-12-16', 'Day of Reconciliation', FALSE, NULL),
  ('2027-12-25', 'Christmas Day', FALSE, NULL),
  ('2027-12-27', 'Day of Goodwill (observed)', TRUE, '2027-12-26'),

  -- 2028
  ('2028-01-01', 'New Year''s Day', FALSE, NULL),
  ('2028-03-21', 'Human Rights Day', FALSE, NULL),
  ('2028-04-14', 'Good Friday', FALSE, NULL),
  ('2028-04-17', 'Family Day', FALSE, NULL),
  ('2028-04-27', 'Freedom Day', FALSE, NULL),
  ('2028-05-01', 'Workers'' Day', FALSE, NULL),
  ('2028-06-16', 'Youth Day', FALSE, NULL),
  ('2028-08-09', 'National Women''s Day', FALSE, NULL),
  ('2028-09-25', 'Heritage Day (observed)', TRUE, '2028-09-24'),
  ('2028-12-16', 'Day of Reconciliation', FALSE, NULL),
  ('2028-12-25', 'Christmas Day', FALSE, NULL),
  ('2028-12-26', 'Day of Goodwill', FALSE, NULL)
ON CONFLICT (holiday_date) DO NOTHING;
