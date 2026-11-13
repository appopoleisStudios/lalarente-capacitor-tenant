-- F10: completeInspection writes pending_signatures and cancelInspection
-- writes cancelled; inspections_status_check allowed neither. Keep the
-- existing values and add both.
ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_status_check;
ALTER TABLE inspections ADD CONSTRAINT inspections_status_check CHECK (status IN (
  'scheduled',
  'in_progress',
  'pending_signatures',
  'completed',
  'cancelled'
));
