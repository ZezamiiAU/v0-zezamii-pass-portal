-- ============================================================================
-- Migration: Update QR Pass URLs to Include Site Slug
-- Description: 
--   Update v_devices_with_passes view to generate QR URLs with the new
--   three-level structure: /p/{org}/{site}/{device} instead of /p/{org}/{device}
--   This fixes the PWA error where old URLs without site slugs cannot be resolved.
-- Date: 2025-12-02
-- ============================================================================

-- Recreate the view with updated QR URL generation
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
  s.slug as site_slug, -- Added site_slug for URL generation
  d.lock_id,
  f.building_id,
  b.name as building_name,
  d.floor_id,
  f.name as floor_name,
  f.level_rank as floor_level,
  d.created_at as device_created_at,
  d.updated_at as device_updated_at,
  -- QR Passes as JSON array with updated URL structure
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
            AND s.slug IS NOT NULL  -- Require site slug
            AND qp.qr_instance_id IS NOT NULL 
            AND qp.is_active = true
            AND d.slug_is_active = true
          THEN (
            SELECT value FROM core.system_config WHERE key = 'pwa_base_url'
          ) || '/p/' || o.slug || '/' || s.slug || '/' || d.slug || '?qr=' || qp.qr_instance_id || '&source=qr'
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
LEFT JOIN core.sites s ON s.id = d.site_id
LEFT JOIN core.floors f ON f.id = d.floor_id
LEFT JOIN core.buildings b ON b.id = f.building_id
LEFT JOIN core.qr_passes qp ON qp.device_id = d.id
GROUP BY 
  d.id, d.name, d.slug, d.custom_name, d.custom_description, d.custom_logo_url,
  d.category, d.slug_is_active, d.status, d.org_id, o.name, o.slug,
  d.site_id, s.name, s.slug, d.lock_id, f.building_id, b.name, d.floor_id, f.name, f.level_rank,
  d.created_at, d.updated_at;

-- Grant permissions
GRANT SELECT ON core.v_devices_with_passes TO authenticated;
GRANT SELECT ON core.v_devices_with_passes TO anon;

-- ============================================================================
-- Verification: Check that URLs now include site slug
-- ============================================================================

SELECT 
  device_name,
  org_slug,
  site_slug,
  device_slug,
  qr_passes
FROM core.v_devices_with_passes
WHERE site_slug IS NOT NULL
LIMIT 5;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
