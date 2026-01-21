-- Migration: Create backup_code_pool table for dynamic backup code management
-- Run this script to create the new backup code pool system

-- Create backup_code_pool table in pass schema
CREATE TABLE IF NOT EXISTS pass.backup_code_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location
  site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES core.devices(id) ON DELETE CASCADE,
  
  -- Code details
  code VARCHAR(10) NOT NULL,                    -- The actual PIN code
  category TEXT NOT NULL,                        -- 'day', 'camping_3d', 'camping_7d', 'camping_14d'
  validity_hours INTEGER NOT NULL,               -- 24, 72, 168, 336
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'available',      -- 'available', 'assigned', 'pending_removal', 'removed'
  
  -- Assignment (NULL if unassigned)
  pass_id UUID REFERENCES pass.passes(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Validity window
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Rooms API tracking
  rooms_ref TEXT,                                -- Reference ID from Rooms API
  rooms_synced_at TIMESTAMPTZ,                   -- When last synced with Rooms
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_backup_pool_device_status 
  ON pass.backup_code_pool(device_id, status);

CREATE INDEX IF NOT EXISTS idx_backup_pool_device_category 
  ON pass.backup_code_pool(device_id, category, status);

CREATE INDEX IF NOT EXISTS idx_backup_pool_expires 
  ON pass.backup_code_pool(expires_at) 
  WHERE status IN ('available', 'assigned');

CREATE INDEX IF NOT EXISTS idx_backup_pool_pass 
  ON pass.backup_code_pool(pass_id) 
  WHERE pass_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE pass.backup_code_pool IS 
'Dynamic backup code pool for fallback when Rooms PIN generation times out. 
Codes are pre-generated daily and assigned on-demand. 
Reserve goals: day=30, camping_3d=10, camping_7d=5, camping_14d=5 per device.
Hardware limit: 150 codes per lock.';

COMMENT ON COLUMN pass.backup_code_pool.category IS 
'Code category determining validity period: day (24h), camping_3d (72h), camping_7d (168h), camping_14d (336h)';

COMMENT ON COLUMN pass.backup_code_pool.status IS 
'available = ready to assign, assigned = in use by a pass, pending_removal = queued for Rooms DELETE, removed = deleted from Rooms';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION pass.update_backup_pool_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_backup_pool_updated_at
  BEFORE UPDATE ON pass.backup_code_pool
  FOR EACH ROW
  EXECUTE FUNCTION pass.update_backup_pool_timestamp();

-- Grant permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON pass.backup_code_pool TO service_role;
