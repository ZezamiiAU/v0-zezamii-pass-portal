-- Create helpful views for querying

-- View for access point details with full hierarchy
CREATE OR REPLACE VIEW pass.v_accesspoint_details AS
SELECT 
  d.id AS device_id,
  aps.slug,
  aps.slug AS accesspoint_slug,
  aps.is_active AS slug_is_active,
  COALESCE(aps.custom_name, d.name) AS custom_name,
  aps.custom_description,
  COALESCE(aps.custom_logo_url, o.logo_url) AS custom_logo_url,
  o.id AS organization_id,
  o.name AS organization_name,
  o.logo_url AS organization_logo_url,
  o.primary_color AS organization_primary_color,
  o.secondary_color AS organization_secondary_color,
  s.id AS site_id,
  s.name AS site_name,
  b.id AS building_id,
  b.name AS building_name,
  f.id AS floor_id,
  f.name AS floor_name,
  f.level AS floor_level,
  d.name AS device_name,
  d.device_type,
  d.lock_id
FROM core.devices d
JOIN core.floors f ON d.floor_id = f.id
JOIN core.buildings b ON f.building_id = b.id
JOIN core.sites s ON b.site_id = s.id
-- Changed to organisations
JOIN core.organisations o ON s.organization_id = o.id
LEFT JOIN pass.accesspoint_slugs aps ON aps.device_id = d.id
WHERE d.is_active = true;

-- View for organization summary stats
CREATE OR REPLACE VIEW core.v_organization_stats AS
SELECT 
  o.id AS organization_id,
  o.name AS organization_name,
  COUNT(DISTINCT s.id) AS site_count,
  COUNT(DISTINCT b.id) AS building_count,
  COUNT(DISTINCT d.id) AS device_count,
  COUNT(DISTINCT pt.id) AS pass_type_count,
  COUNT(DISTINCT p.id) AS total_passes,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_passes
-- Changed to organisations
FROM core.organisations o
LEFT JOIN core.sites s ON s.organization_id = o.id
LEFT JOIN core.buildings b ON b.site_id = s.id
LEFT JOIN core.floors f ON f.building_id = b.id
LEFT JOIN core.devices d ON d.floor_id = f.id
LEFT JOIN pass.pass_types pt ON pt.organization_id = o.id
LEFT JOIN pass.passes p ON p.pass_type_id = pt.id
WHERE o.is_active = true
GROUP BY o.id, o.name;
