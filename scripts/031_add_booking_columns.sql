-- Migration: 031_add_booking_columns.sql
-- Description: Add booked_from/booked_to columns to passes table for booking mode
-- Backwards compatible: Both columns are nullable, legacy flow unaffected

-- 1) Add booking columns to passes table
ALTER TABLE pass.passes
ADD COLUMN IF NOT EXISTS booked_from TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS booked_to TIMESTAMPTZ;

-- 2) Add index for availability queries (when availability_enforcement is enabled)
CREATE INDEX IF NOT EXISTS idx_passes_booking_range 
ON pass.passes(pass_type_id, booked_from, booked_to) 
WHERE booked_from IS NOT NULL AND booked_to IS NOT NULL;

-- 3) Add comment for documentation
COMMENT ON COLUMN pass.passes.booked_from IS 'User-selected booking start time (nullable, only set when future_booking_enabled)';
COMMENT ON COLUMN pass.passes.booked_to IS 'User-selected booking end time (nullable, only set when future_booking_enabled)';

-- Note: valid_from / valid_to remain the authoritative access window
-- booked_from / booked_to are the user's requested time slot (may differ due to buffers)
