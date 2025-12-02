-- ============================================================================
-- Migration: QR Passes System and Device Site ID
-- Description: 
--   1. Create qr_passes table to support multiple QR codes per device
--   2. Add site_id directly to devices table (building/floor optional)
--   3. Update views for new structure
--   4. Grant necessary permissions
-- Date: 2025-11-28
-- ============================================================================

-- ============================================================================
-- PART 1: Create QR Passes Table
-- ============================================================================

-- Create qr_passes table to support multiple QR codes per device
CREATE TABLE IF NOT EXISTS core.qr_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES core.devices(id) ON DELETE CASCADE,
  qr_instance_id UUID NOT NULL DEFAULT gen_random_uuid(),
  pass_label TEXT, -- Optional label like "Gate A", "Entrance 1", etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT qr_passes_unique_instance UNIQUE(qr_instance_id)
);

-- Create indexes for qr_passes
CREATE INDEX IF NOT EXISTS idx_qr_passes_device_id ON core.qr_passes(device_id);
CREATE INDEX IF NOT EXISTS idx_qr_passes_qr_instance_id ON core.qr_passes(qr_instance_id);
CREATE INDEX IF NOT EXISTS idx_qr_passes_active ON core.qr_passes(is_active) WHERE is_active = true;

-- Migrate existing qr_instance_id from devices to qr_passes
INSERT INTO core.qr_passes (device_id, qr_instance_id, pass_label, is_active, created_at)
SELECT 
  id as device_id,
  qr_instance_id,
  'Default Pass' as pass_label,
  slug_is_active as is_active,
  created_at
FROM core.devices
WHERE qr_instance_id IS NOT NULL
ON CONFLICT (qr_instance_id) DO NOTHING;

-- ============================================================================
-- PART 2: Add site_id to Devices Table
-- ============================================================================

-- Add site_id column to devices table
ALTER TABLE core.devices 
ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES core.sites(id) ON DELETE CASCADE;

-- Populate site_id from existing floor relationships
UPDATE core.devices d
SET site_id = b.site_id
FROM core.floors f
JOIN core.buildings b ON b.id = f.building_id
WHERE d.floor_id = f.id
AND d.site_id IS NULL;

-- Make floor_id nullable (building and floor are now optional)
ALTER TABLE core.devices 
ALTER COLUMN floor_id DROP NOT NULL;

-- Removed the constraint that requires site_id - all location fields are now optional
-- Note: site_id, floor_id, and building_id are ALL optional now
-- Devices can exist at organization level without specific location

-- ============================================================================
-- PART 3: Update Views
-- ============================================================================

-- Update devices with passes view to use new structure
CREATE OR REPLACE VIEW core.v_devices_with_passes AS
SELECT 
  d.id as device_id,
  d.name as device_name,
  d.slug as device_slug,
  d.custom_name as device_custom_name,
  d.custom_description as device_custom_description,
  d.custom_logo_url as device_custom_logo_url,
  d.category,
  d.slug_is_active,
  d.status as device_status,
  d.org_id,
  o.name as org_name,
  o.slug as org_slug,
  d.site_id,
  s.name as site_name,
  f.building_id,
  b.name as building_name,
  d.floor_id,
  f.name as floor_name,
  f.level_rank as floor_level,
  d.created_at as device_created_at,
  d.updated_at as device_updated_at,
  -- QR Passes as JSON array
  COALESCE(
    json_agg(
      json_build_object(
        'pass_id', qp.id,
        'qr_instance_id', qp.qr_instance_id,
        'pass_label', qp.pass_label,
        'is_active', qp.is_active,
        'created_at', qp.created_at,
        'qr_url', 
        CASE 
          WHEN d.slug IS NOT NULL 
            AND o.slug IS NOT NULL 
            AND qp.qr_instance_id IS NOT NULL 
            AND qp.is_active = true
            AND d.slug_is_active = true
          THEN (
            SELECT value FROM core.system_config WHERE key = 'pwa_base_url'
          ) || '/p/' || o.slug || '/' || d.slug || '?qr=' || qp.qr_instance_id || '&source=qr'
          ELSE NULL
        END
      )
      ORDER BY qp.created_at ASC
    ) FILTER (WHERE qp.id IS NOT NULL),
    '[]'::json
  ) as qr_passes,
  COUNT(qp.id) as pass_count
FROM core.devices d
JOIN core.organisations o ON o.id = d.org_id
-- Changed to LEFT JOIN to support devices without site/floor/building
LEFT JOIN core.sites s ON s.id = d.site_id
LEFT JOIN core.floors f ON f.id = d.floor_id
LEFT JOIN core.buildings b ON b.id = f.building_id
LEFT JOIN core.qr_passes qp ON qp.device_id = d.id
GROUP BY 
  d.id, d.name, d.slug, d.custom_name, d.custom_description, d.custom_logo_url,
  d.category, d.slug_is_active, d.status, d.org_id, o.name, o.slug,
  d.site_id, s.name, f.building_id, b.name, d.floor_id, f.name, f.level_rank,
  d.created_at, d.updated_at;

-- ============================================================================
-- PART 4: Grant Permissions
-- ============================================================================

-- Grant permissions on new qr_passes table
GRANT SELECT ON core.qr_passes TO authenticated;

-- Grant permissions on updated view
GRANT SELECT ON core.v_devices_with_passes TO authenticated;

-- Grant permissions on pass.v_accesspoint_details view for PWA access
GRANT SELECT ON pass.v_accesspoint_details TO anon;
GRANT SELECT ON pass.v_accesspoint_details TO authenticated;

-- ============================================================================
-- PART 5: Verification Queries
-- ============================================================================

-- Verify qr_passes migration
SELECT 
  'QR Passes Migration' as check_name,
  COUNT(*) as total_passes,
  COUNT(DISTINCT device_id) as unique_devices,
  COUNT(*) FILTER (WHERE is_active = true) as active_passes
FROM core.qr_passes;

-- Verify devices site_id population
SELECT 
  'Devices with site_id' as check_name,
  COUNT(*) as total_devices,
  COUNT(site_id) as devices_with_site_id,
  COUNT(floor_id) as devices_with_floor_id,
  COUNT(*) FILTER (WHERE floor_id IS NULL) as devices_without_floor
FROM core.devices;

-- Verify view works correctly
SELECT 
  device_name,
  org_name,
  site_name,
  building_name,
  floor_name,
  pass_count
FROM core.v_devices_with_passes
LIMIT 5;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
