-- Update QR-ready devices view to only show devices for orgs with pass module
DROP VIEW IF EXISTS core.qr_ready_devices CASCADE;

CREATE OR REPLACE VIEW core.qr_ready_devices AS
SELECT 
  d.id as device_id,
  d.name as device_name,
  d.slug as device_slug,
  d.qr_instance_id,
  d.slug_is_active,
  d.custom_name as device_custom_name,
  d.custom_description as device_custom_description,
  d.custom_logo_url as device_custom_logo_url,
  d.category,
  o.id as org_id,
  o.name as org_name,
  o.slug as org_slug,
  o.brand_settings as org_brand_settings,
  o.billing_email as org_support_email,
  o.is_active as org_is_active,
  s.id as site_id,
  s.name as site_name,
  b.id as building_id,
  b.name as building_name,
  f.id as floor_id,
  f.name as floor_name,
  f.level_rank as floor_level,
  
  -- Computed QR URL using system_config
  CASE 
    WHEN d.slug IS NOT NULL 
      AND d.slug_is_active = true 
      AND d.qr_instance_id IS NOT NULL 
      AND o.slug IS NOT NULL
    THEN CONCAT(
      'https://', 
      (SELECT value FROM core.system_config WHERE key = 'pwa_base_url' LIMIT 1), 
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
INNER JOIN core.organisations o ON o.id = d.org_id
INNER JOIN core.floors f ON f.id = d.floor_id
INNER JOIN core.buildings b ON b.id = f.building_id
INNER JOIN core.sites s ON s.id = b.site_id
-- Only show devices for orgs with active pass module
INNER JOIN licensing.org_module_licenses oml ON oml.org_id = o.id 
  AND oml.module_key = 'pass'
  AND (oml.expires_at IS NULL OR oml.expires_at > NOW())
-- Only show devices that have a slug
WHERE d.slug IS NOT NULL
ORDER BY o.name, s.name, b.name, f.level_rank, d.custom_name;

COMMENT ON VIEW core.qr_ready_devices IS 
'View for QR-ready devices with computed QR URLs. Only shows devices for orgs with active pass module license and devices that have a slug.';
