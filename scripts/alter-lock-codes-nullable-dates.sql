-- Make starts_at and ends_at nullable in lock_codes table
-- These dates are redundant since they're already stored in pass.passes (valid_from, valid_to)

-- Remove NOT NULL constraints from starts_at and ends_at
ALTER TABLE pass.lock_codes 
ALTER COLUMN starts_at DROP NOT NULL;

ALTER TABLE pass.lock_codes 
ALTER COLUMN ends_at DROP NOT NULL;

-- Add comment explaining why these are nullable
COMMENT ON COLUMN pass.lock_codes.starts_at IS 
'Optional: PIN validity start. If null, use passes.valid_from';

COMMENT ON COLUMN pass.lock_codes.ends_at IS 
'Optional: PIN validity end. If null, use passes.valid_to';
