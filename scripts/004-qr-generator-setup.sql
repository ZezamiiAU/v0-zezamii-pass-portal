-- QR Generator Setup
-- This script creates the necessary database objects for QR code generation

-- 1. Add qr_instance_id column to devices table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'core' 
    AND table_name = 'devices' 
    AND column_name = 'qr_instance_id'
  ) THEN
    ALTER TABLE core.devices 
    ADD COLUMN qr_instance_id UUID DEFAULT gen_random_uuid();
    
    CREATE INDEX idx_devices_qr_instance_id ON core.devices(qr_instance_id);
  END IF;
END $$;

-- 2. Create configuration table for PWA base URL
CREATE TABLE IF NOT EXISTS core.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default PWA base URL (update this to your production domain)
INSERT INTO core.system_config (key, value, description)
VALUES (
  'pwa_base_url', 
  'zezamii-pass.vercel.app',
  'Base URL for PWA QR codes (without https://)'
)
ON CONFLICT (key) DO NOTHING;

-- 3. Create view with computed QR URLs
DROP VIEW IF EXISTS core.qr_ready_devices CASCADE;

CREATE OR REPLACE VIEW core.qr_ready_devices AS
SELECT 
  -- Device fields
  d.id as device_id,
  d.name as device_name,
  d.slug as device_slug,
  d.qr_instance_id,
  d.slug_is_active,
  d.custom_name as device_custom_name,
  d.custom_description as device_custom_description,
  d.custom_logo_url as device_custom_logo_url,
  d.category,
  
  -- Organization fields
  o.id as org_id,
  o.name as org_name,
  o.slug as org_slug,
  o.brand_settings as org_brand_settings,
  o.billing_email as org_support_email,
  o.is_active as org_is_active,
  
  -- Site fields
  s.id as site_id,
  s.name as site_name,
  
  -- Building fields
  b.id as building_id,
  b.name as building_name,
  
  -- Floor fields
  f.id as floor_id,
  f.name as floor_name,
  f.level_rank as floor_level,
  
  -- Computed QR URL (reads base URL from config table)
  CASE 
    WHEN d.slug IS NOT NULL 
      AND d.slug_is_active = true 
      AND d.qr_instance_id IS NOT NULL 
      AND o.slug IS NOT NULL
    THEN CONCAT(
      'https://', 
      (SELECT value FROM core.system_config WHERE key = 'pwa_base_url'), 
      '/p/', 
      o.slug, 
      '/', 
      d.slug, 
      '?qr=', 
      d.qr_instance_id::text,
      '&source=qr'
    )
    ELSE NULL
  END as qr_url,
  
  -- Health checks
  (d.slug IS NOT NULL) as has_slug,
  (d.slug_is_active = true) as is_active,
  (d.qr_instance_id IS NOT NULL) as has_qr_instance,
  (o.slug IS NOT NULL) as org_has_slug,
  (d.custom_name IS NOT NULL OR d.name IS NOT NULL) as has_name,
  
  -- Overall readiness with detailed status
  CASE 
    WHEN d.slug IS NULL THEN 'missing_slug'
    WHEN NOT d.slug_is_active THEN 'inactive_slug'
    WHEN NOT o.is_active THEN 'inactive_org'
    WHEN o.slug IS NULL THEN 'missing_org_slug'
    WHEN d.qr_instance_id IS NULL THEN 'missing_qr_instance'
    WHEN d.org_id IS NULL OR d.floor_id IS NULL THEN 'invalid_hierarchy'
    ELSE 'ready'
  END as health_status,
  
  -- Simple boolean for filtering
  (
    d.slug IS NOT NULL 
    AND d.slug_is_active = true 
    AND d.qr_instance_id IS NOT NULL
    AND o.slug IS NOT NULL
    AND o.is_active = true
  ) as is_qr_ready,
  
  -- Timestamps
  d.created_at,
  d.updated_at

FROM core.devices d
LEFT JOIN core.organisations o ON o.id = d.org_id
LEFT JOIN core.floors f ON f.id = d.floor_id
LEFT JOIN core.buildings b ON b.id = f.building_id
LEFT JOIN core.sites s ON s.id = b.site_id
ORDER BY o.name, s.name, b.name, f.level_rank, d.custom_name;

COMMENT ON VIEW core.qr_ready_devices IS 
'View for QR-ready devices with computed QR URLs. 
Update base URL with: UPDATE core.system_config SET value = ''yourdomain.com'' WHERE key = ''pwa_base_url'';';

-- 4. Create analytics schema and qr_scans table (if not exists)
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES core.devices(id) ON DELETE SET NULL,
  qr_instance_id UUID,
  slug TEXT NOT NULL,
  org_id UUID REFERENCES core.organisations(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET,
  source TEXT DEFAULT 'qr',
  converted_to_purchase BOOLEAN DEFAULT FALSE,
  pass_id UUID REFERENCES pass.passes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_qr_scans_device_id ON analytics.qr_scans(device_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_instance_id ON analytics.qr_scans(qr_instance_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON analytics.qr_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_org_id ON analytics.qr_scans(org_id);

-- Verification queries
SELECT 
  'Configuration' as check_type,
  key,
  value,
  description
FROM core.system_config
WHERE key = 'pwa_base_url'

UNION ALL

SELECT 
  'QR Ready Devices' as check_type,
  COUNT(*)::text as key,
  COUNT(CASE WHEN is_qr_ready THEN 1 END)::text as value,
  'Total devices / QR ready devices' as description
FROM core.qr_ready_devices;
