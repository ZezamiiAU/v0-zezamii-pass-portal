-- Add lock_id field to devices table for lock system integration
-- This field will store the external lock system's device identifier

ALTER TABLE core.devices 
ADD COLUMN IF NOT EXISTS lock_id TEXT;

COMMENT ON COLUMN core.devices.lock_id IS 'External lock system device identifier for integration with lock providers (e.g., Duvan PWA)';

-- Add index for faster lookups by lock_id
CREATE INDEX IF NOT EXISTS idx_devices_lock_id ON core.devices(lock_id) WHERE lock_id IS NOT NULL;
