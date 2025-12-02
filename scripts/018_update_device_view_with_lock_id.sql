-- Update v_devices_with_passes view to include lock_id field
-- This allows the QR generator to display lock_id for integration with lock systems

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
  d.lock_id, -- Added lock_id field for lock system integration
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
LEFT JOIN core.sites s ON s.id = d.site_id
LEFT JOIN core.floors f ON f.id = d.floor_id
LEFT JOIN core.buildings b ON b.id = f.building_id
LEFT JOIN core.qr_passes qp ON qp.device_id = d.id
GROUP BY 
  d.id, d.name, d.slug, d.custom_name, d.custom_description, d.custom_logo_url,
  d.category, d.slug_is_active, d.status, d.lock_id, d.org_id, o.name, o.slug,
  d.site_id, s.name, f.building_id, b.name, d.floor_id, f.name, f.level_rank,
  d.created_at, d.updated_at;

COMMENT ON VIEW core.v_devices_with_passes IS 'Devices with their QR passes and location hierarchy including lock_id for lock system integration';
