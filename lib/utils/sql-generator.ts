import type { TenantConfig } from "@/lib/schemas/tenant-config"

// Format SQL value
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "boolean") return value.toString()
  if (typeof value === "number") return value.toString()
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  // String - escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`
}

function prepareOrganisationForDB(org: Record<string, unknown>): Record<string, unknown> {
  const dbOrg: Record<string, unknown> = {}

  // Only keep fields that actually exist in core.organisations table
  const validFields = [
    "id",
    "name",
    "slug",
    "timezone",
    "locale",
    "is_active",
    "billing_email",
    "brand_settings",
    "created_at",
    "updated_at",
    "tier_id",
    "subscription_status",
    "subscription_ends_at",
    "usage_limits",
    "current_usage",
    "custom_domain",
    "parent_organisation_id",
    "default_partner_org_id",
    "default_partner_tier",
    "agent_settings",
    "zezamii_property_id",
  ]

  // Copy valid fields directly
  validFields.forEach((field) => {
    if (org[field] !== undefined) {
      dbOrg[field] = org[field]
    }
  })

  // Handle special mappings
  // If contact_email is provided but billing_email isn't, use it
  if (org.contact_email && !dbOrg.billing_email) {
    dbOrg.billing_email = org.contact_email
  }

  // Build brand_settings jsonb from separate logo/color fields if provided
  const brandSettings: Record<string, unknown> = {}

  if (org.logo_url) {
    brandSettings.logo_url = org.logo_url
  }

  if (org.primary_color) {
    brandSettings.primary_color = org.primary_color
  }

  if (org.secondary_color) {
    brandSettings.secondary_color = org.secondary_color
  }

  // Merge with existing brand_settings or create new
  if (Object.keys(brandSettings).length > 0) {
    if (dbOrg.brand_settings && typeof dbOrg.brand_settings === "object") {
      dbOrg.brand_settings = { ...dbOrg.brand_settings, ...brandSettings }
    } else {
      dbOrg.brand_settings = brandSettings
    }
  }

  // Set defaults for required fields
  if (!dbOrg.is_active) {
    dbOrg.is_active = true
  }

  return dbOrg
}

function prepareSiteForDB(site: Record<string, unknown>): Record<string, unknown> {
  const dbSite: Record<string, unknown> = {}

  // Only keep fields that actually exist in core.sites table
  const validFields = [
    "id",
    "name",
    "org_id",
    "address",
    "city",
    "state",
    "country",
    "postal_code",
    "created_at",
    "updated_at",
  ]

  validFields.forEach((field) => {
    if (site[field] !== undefined) {
      dbSite[field] = site[field]
    }
  })

  return dbSite
}

function prepareBuildingForDB(building: Record<string, unknown>): Record<string, unknown> {
  const dbBuilding: Record<string, unknown> = {}

  // Only keep fields that actually exist in core.buildings table
  const validFields = ["id", "name", "org_id", "site_id", "type", "created_at", "updated_at"]

  validFields.forEach((field) => {
    if (building[field] !== undefined) {
      dbBuilding[field] = building[field]
    }
  })

  return dbBuilding
}

function prepareFloorForDB(floor: Record<string, unknown>): Record<string, unknown> {
  const dbFloor: Record<string, unknown> = {}

  // Only keep fields that actually exist in core.floors table
  const validFields = [
    "id",
    "name",
    "building_id",
    "org_id",
    "level_rank", // Note: use level_rank not level
    "width_meters",
    "height_meters",
    "width_pixels",
    "height_pixels",
    "orientation",
    "floor_plan_image",
    "metadata",
    "created_at",
    "updated_at",
  ]

  validFields.forEach((field) => {
    if (floor[field] !== undefined) {
      dbFloor[field] = floor[field]
    }
  })

  // Map 'level' to 'level_rank' if present
  if (floor.level !== undefined && dbFloor.level_rank === undefined) {
    dbFloor.level_rank = floor.level
  }

  return dbFloor
}

function preparePassTypeForDB(passType: Record<string, unknown>): Record<string, unknown> {
  const dbPassType: Record<string, unknown> = {}

  // Only keep fields that actually exist in pass.pass_types table
  const validFields = [
    "id",
    "org_id",
    "name",
    "code",
    "description",
    "price_cents",
    "currency",
    "duration_minutes",
    "is_active",
    "created_at",
    "updated_at",
  ]

  validFields.forEach((field) => {
    if (passType[field] !== undefined) {
      dbPassType[field] = passType[field]
    }
  })

  // Set defaults for required fields
  if (dbPassType.is_active === undefined) {
    dbPassType.is_active = true
  }

  if (dbPassType.currency === undefined) {
    dbPassType.currency = "AUD"
  }

  return dbPassType
}

function prepareIntegrationForDB(integration: Record<string, unknown>): Record<string, unknown> {
  const dbIntegration: Record<string, unknown> = {}

  // Only keep fields that actually exist in core.integrations table
  const validFields = [
    "id",
    "organisation_id", // Note: integrations uses organisation_id not org_id
    "name",
    "integration_type",
    "status",
    "config",
    "credentials",
    "last_used_at",
    "created_at",
    "updated_at",
  ]

  validFields.forEach((field) => {
    if (integration[field] !== undefined) {
      dbIntegration[field] = integration[field]
    }
  })

  // Map org_id to organisation_id if present
  if (integration.org_id && !dbIntegration.organisation_id) {
    dbIntegration.organisation_id = integration.org_id
  }

  // Set defaults
  if (!dbIntegration.status) {
    dbIntegration.status = "active"
  }

  return dbIntegration
}

// Generate INSERT statement with UPSERT capability
function generateInsert(
  tableName: string,
  schemaName: string,
  rows: Record<string, unknown>[],
  conflictColumn = "id",
): string {
  if (!rows || rows.length === 0) return ""

  const allKeys = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => allKeys.add(key)))
  const columns = Array.from(allKeys)

  const valueRows = rows.map((row) => {
    const values = columns.map((col) => formatValue(row[col]))
    return `  (${values.join(", ")})`
  })

  const updateColumns = columns.filter((col) => col !== conflictColumn && col !== "id")
  const updateSet = updateColumns.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")

  return `-- Insert into ${schemaName}.${tableName}
INSERT INTO ${schemaName}.${tableName} (
  ${columns.join(",\n  ")}
) VALUES
${valueRows.join(",\n")}
ON CONFLICT (${conflictColumn}) DO UPDATE SET
${updateSet};

`
}

// Main SQL generator
export function generateSQL(config: TenantConfig): string {
  const timestamp = new Date().toISOString()

  let output = `-- Tenant Setup SQL
-- Generated from JSON template on ${timestamp}
-- 
-- Instructions:
--   1. Review all values carefully
--   2. Replace placeholder UUIDs and API keys
--   3. Run against your Supabase database
--
-- NOTE: Slugs are now stored directly on core.devices table
-- NOTE: This uses UPSERT logic - existing records with matching IDs will be updated.
--       New records will be inserted.
-- NOTE: If organization slug already exists, child records will use the existing org ID.

BEGIN;

-- Create temporary tables to store actual IDs after upserts
CREATE TEMP TABLE IF NOT EXISTS site_id_map (config_id uuid, actual_id uuid);
CREATE TEMP TABLE IF NOT EXISTS building_id_map (config_id uuid, actual_id uuid);
CREATE TEMP TABLE IF NOT EXISTS floor_id_map (config_id uuid, actual_id uuid);
CREATE TEMP TABLE IF NOT EXISTS device_id_map (config_id uuid, actual_id uuid);

`

  const preparedOrg = prepareOrganisationForDB(config.organisation as unknown as Record<string, unknown>)
  const allKeys = Object.keys(preparedOrg)
  const columns = allKeys.join(",\n  ")
  const values = allKeys.map((key) => formatValue(preparedOrg[key])).join(", ")
  const updateColumns = allKeys.filter((col) => col !== "slug" && col !== "id")
  const updateSet = updateColumns.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")

  output += `-- Upsert organization and capture its actual ID
WITH upserted_org AS (
  INSERT INTO core.organisations (
    ${columns}
  ) VALUES (
    ${values}
  )
  ON CONFLICT (slug) DO UPDATE SET
  ${updateSet}
  RETURNING id
)
SELECT id INTO TEMP org_id_var FROM upserted_org;

`

  const preparedSites = (config.sites || []).map((site) => prepareSiteForDB(site as unknown as Record<string, unknown>))
  if (preparedSites.length > 0) {
    preparedSites.forEach((site) => {
      const siteKeys = Object.keys(site).filter((k) => k !== "org_id")
      const siteCols = ["org_id", ...siteKeys].join(",\n  ")
      const siteVals = ["(SELECT * FROM org_id_var)", ...siteKeys.map((k) => formatValue(site[k]))].join(", ")
      const siteUpdateCols = siteKeys.filter((c) => c !== "id" && c !== "name")
      const siteUpdateSet =
        siteUpdateCols.length > 0
          ? siteUpdateCols.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")
          : "  updated_at = NOW()"

      output += `-- Insert/Update site: ${site.name}
WITH upserted_site AS (
  INSERT INTO core.sites (
    ${siteCols}
  ) VALUES (
    ${siteVals}
  )
  ON CONFLICT (org_id, name) DO UPDATE SET
  ${siteUpdateSet}
  RETURNING id
), site_map AS (
  INSERT INTO site_id_map (config_id, actual_id)
  SELECT ${formatValue(site.id)}::uuid, id FROM upserted_site
  RETURNING actual_id
)
SELECT * FROM site_map;

`
    })
  }

  const preparedBuildings = (config.buildings || []).map((building) =>
    prepareBuildingForDB(building as unknown as Record<string, unknown>),
  )
  if (preparedBuildings.length > 0) {
    preparedBuildings.forEach((building) => {
      const buildingKeys = Object.keys(building).filter((k) => k !== "org_id" && k !== "site_id")
      const buildingCols = ["org_id", "site_id", ...buildingKeys].join(",\n  ")
      const buildingVals = [
        "(SELECT * FROM org_id_var)",
        `(SELECT actual_id FROM site_id_map WHERE config_id = ${formatValue(building.site_id)}::uuid)`,
        ...buildingKeys.map((k) => formatValue(building[k])),
      ].join(", ")
      const buildingUpdateCols = buildingKeys.filter((c) => c !== "id" && c !== "name")
      const buildingUpdateSet =
        buildingUpdateCols.length > 0
          ? buildingUpdateCols.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")
          : "  updated_at = NOW()"

      output += `-- Insert/Update building: ${building.name}
WITH upserted_building AS (
  INSERT INTO core.buildings (
    ${buildingCols}
  ) VALUES (
    ${buildingVals}
  )
  ON CONFLICT (site_id, name) DO UPDATE SET
  ${buildingUpdateSet}
  RETURNING id
), building_map AS (
  INSERT INTO building_id_map (config_id, actual_id)
  SELECT ${formatValue(building.id)}::uuid, id FROM upserted_building
  RETURNING actual_id
)
SELECT * FROM building_map;

`
    })
  }

  const preparedFloors = (config.floors || []).map((floor) =>
    prepareFloorForDB(floor as unknown as Record<string, unknown>),
  )
  if (preparedFloors.length > 0) {
    preparedFloors.forEach((floor) => {
      const floorKeys = Object.keys(floor).filter((k) => k !== "org_id" && k !== "building_id")
      const floorCols = ["org_id", "building_id", ...floorKeys].join(",\n  ")
      const floorVals = [
        "(SELECT * FROM org_id_var)",
        `(SELECT actual_id FROM building_id_map WHERE config_id = ${formatValue(floor.building_id)}::uuid)`,
        ...floorKeys.map((k) => formatValue(floor[k])),
      ].join(", ")
      const floorUpdateCols = floorKeys.filter((c) => c !== "id" && c !== "name")
      const floorUpdateSet =
        floorUpdateCols.length > 0
          ? floorUpdateCols.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")
          : "  updated_at = NOW()"

      output += `-- Insert/Update floor: ${floor.name}
WITH upserted_floor AS (
  INSERT INTO core.floors (
    ${floorCols}
  ) VALUES (
    ${floorVals}
  )
  ON CONFLICT (building_id, name) DO UPDATE SET
  ${floorUpdateSet}
  RETURNING id
), floor_map AS (
  INSERT INTO floor_id_map (config_id, actual_id)
  SELECT ${formatValue(floor.id)}::uuid, id FROM upserted_floor
  RETURNING actual_id
)
SELECT * FROM floor_map;

`
    })
  }

  if (config.devices.length > 0) {
    config.devices.forEach((device) => {
      if (!device.site_id && !device.floor_id) {
        throw new Error(`Device "${device.name}" must have either site_id or floor_id to satisfy database constraint`)
      }

      const deviceKeys = Object.keys(device).filter(
        (k) => k !== "org_id" && k !== "site_id" && k !== "floor_id" && k !== "lock_id",
      )
      const deviceCols = ["org_id", "site_id", "floor_id", ...deviceKeys].join(",\n  ")
      const deviceVals = [
        "(SELECT * FROM org_id_var)",
        device.site_id
          ? `(SELECT actual_id FROM site_id_map WHERE config_id = ${formatValue(device.site_id)}::uuid)`
          : "NULL",
        device.floor_id
          ? `(SELECT id FROM floor_id_map WHERE config_id = ${formatValue(device.floor_id)}::uuid)`
          : "NULL",
        ...deviceKeys.map((k) => formatValue(device[k])),
      ].join(", ")

      const deviceUpdateCols = deviceKeys.filter((c) => c !== "id" && c !== "slug")
      const deviceUpdateSet =
        deviceUpdateCols.length > 0
          ? deviceUpdateCols.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")
          : "  updated_at = NOW()"

      output += `-- Insert/Update device: ${device.name}
INSERT INTO core.devices (
  ${deviceCols}
) VALUES (
  ${deviceVals}
)
ON CONFLICT (slug) DO UPDATE SET
${deviceUpdateSet};

`
    })

    output += `
-- Auto-create default QR passes for devices with slugs
-- This ensures every device is immediately ready with a QR code
INSERT INTO core.qr_passes (device_id, pass_label, qr_instance_id, is_active)
SELECT 
  d.id as device_id,
  'Default Pass' as pass_label,
  gen_random_uuid() as qr_instance_id,
  true as is_active
FROM core.devices d
WHERE d.org_id = (SELECT * FROM org_id_var)
  AND d.slug IS NOT NULL
  AND d.slug_is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM core.qr_passes qp WHERE qp.device_id = d.id
  );

`
  }

  const preparedPassTypes = (config.passTypes || []).map((passType) =>
    preparePassTypeForDB(passType as unknown as Record<string, unknown>),
  )
  if (preparedPassTypes.length > 0) {
    preparedPassTypes.forEach((passType) => {
      const ptKeys = Object.keys(passType).filter((k) => k !== "org_id")
      const ptCols = ["org_id", ...ptKeys].join(",\n  ")
      const ptVals = ["(SELECT * FROM org_id_var)", ...ptKeys.map((k) => formatValue(passType[k]))].join(", ")
      const ptUpdateCols = ptKeys.filter((c) => c !== "id" && c !== "code")
      const ptUpdateSet =
        ptUpdateCols.length > 0
          ? ptUpdateCols.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")
          : "  updated_at = NOW()"

      output += `-- Insert/Update pass type: ${passType.name}
INSERT INTO pass.pass_types (
  ${ptCols}
) VALUES (
  ${ptVals}
)
ON CONFLICT (org_id, code) DO UPDATE SET
${ptUpdateSet};

`
    })
  }

  const preparedIntegrations = (config.integrations || []).map((integration) =>
    prepareIntegrationForDB(integration as unknown as Record<string, unknown>),
  )
  if (preparedIntegrations.length > 0) {
    preparedIntegrations.forEach((integration) => {
      const intKeys = Object.keys(integration).filter((k) => k !== "organisation_id")
      const intCols = ["organisation_id", ...intKeys].join(",\n  ")
      const intVals = ["(SELECT * FROM org_id_var)", ...intKeys.map((k) => formatValue(integration[k]))].join(", ")
      const intUpdateCols = intKeys.filter((c) => c !== "id" && c !== "integration_type" && c !== "name")
      const intUpdateSet =
        intUpdateCols.length > 0
          ? intUpdateCols.map((col) => `  ${col} = EXCLUDED.${col}`).join(",\n")
          : "  updated_at = NOW()"

      output += `-- Insert/Update integration: ${integration.name}
INSERT INTO core.integrations (
  ${intCols}
) VALUES (
  ${intVals}
)
ON CONFLICT (organisation_id, integration_type, name) DO UPDATE SET
${intUpdateSet};

`
    })
  }

  if (config.passTypes && config.passTypes.length > 0) {
    output += `-- Enable pass module license for organisation
INSERT INTO licensing.org_module_licenses (
  org_id,
  module_key,
  site_id,
  granted_at,
  expires_at,
  org_module_answers
) VALUES
  ((SELECT * FROM org_id_var), 'pass', NULL, NOW(), NULL, '{}'::jsonb)
ON CONFLICT (org_id, module_key, site_id) DO UPDATE SET
  granted_at = EXCLUDED.granted_at;

`
  }

  // This ensures QR codes generate proper URLs with org/site/device slugs
  const devicesWithSlugs = (config.devices || []).filter((device) => device.slug && config.organisation.slug)

  if (devicesWithSlugs.length > 0) {
    output += `-- ============================================
-- ACCESSPOINT SLUGS (for QR code URL generation)
-- ============================================
-- These entries enable the QR system to generate proper URLs like:
-- {NEXT_PUBLIC_PWA_BASE_URL}/p/{org_slug}/{site_slug}/{device_slug}

`
    devicesWithSlugs.forEach((device) => {
      // Find the site for this device to get site_slug
      const deviceSite = (config.sites || []).find((s) => s.id === device.site_id)
      // Generate site_slug from site name if not already set
      const siteSlug = deviceSite?.name
        ? deviceSite.name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
        : "default"
      const orgSlug = config.organisation.slug
      const deviceSlug = device.slug
      const fullSlug = `${orgSlug}/${siteSlug}/${deviceSlug}`

      output += `-- Accesspoint slug for device: ${device.name}
INSERT INTO pass.accesspoint_slugs (
  slug,
  org_slug,
  site_slug,
  accesspoint_slug,
  org_id,
  site_id,
  device_id,
  is_active
) VALUES (
  ${formatValue(fullSlug)},
  ${formatValue(orgSlug)},
  ${formatValue(siteSlug)},
  ${formatValue(deviceSlug)},
  (SELECT * FROM org_id_var),
  (SELECT id FROM site_id_map WHERE config_id = ${formatValue(device.site_id)}::uuid),
  (SELECT id FROM device_id_map WHERE config_id = ${formatValue(device.id)}::uuid),
  true
)
ON CONFLICT (slug) DO UPDATE SET
  org_slug = EXCLUDED.org_slug,
  site_slug = EXCLUDED.site_slug,
  accesspoint_slug = EXCLUDED.accesspoint_slug,
  site_id = EXCLUDED.site_id,
  device_id = EXCLUDED.device_id,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

`
    })
  }

  if (config.accesspointSlugs && config.accesspointSlugs.length > 0) {
    output += `-- Update devices with slug information (from legacy accesspointSlugs)\n`
    config.accesspointSlugs.forEach((slug) => {
      output += `UPDATE core.devices SET 
  slug = ${formatValue(slug.slug)},
  slug_is_active = ${formatValue(slug.is_active)},
  custom_name = ${formatValue(slug.custom_name || null)},
  custom_description = ${formatValue(slug.custom_description || null)},
  custom_logo_url = ${formatValue(slug.custom_logo_url || null)}
WHERE id = ${formatValue(slug.device_id)}::uuid;

`
    })
  }

  output += `COMMIT;

-- Verification Queries
-- Run these to verify your data was inserted correctly

SELECT 
  o.name as organisation,
  o.slug as org_slug,
  o.id as org_id,
  COUNT(DISTINCT s.id) as sites,
  COUNT(DISTINCT d.id) as devices,
  COUNT(DISTINCT pt.id) as pass_types,
  COUNT(DISTINCT CASE WHEN d.slug IS NOT NULL THEN d.id END) as devices_with_slugs,
  COUNT(DISTINCT oml.id) as enabled_modules
FROM core.organisations o
LEFT JOIN core.sites s ON s.org_id = o.id
LEFT JOIN core.devices d ON d.org_id = o.id
LEFT JOIN pass.pass_types pt ON pt.org_id = o.id
LEFT JOIN licensing.org_module_licenses oml ON oml.org_id = o.id
WHERE o.slug = '${config.organisation.slug}'
GROUP BY o.id, o.name, o.slug;

-- Check enabled modules
SELECT 
  oml.module_key,
  oml.granted_at,
  oml.expires_at,
  CASE 
    WHEN oml.expires_at IS NULL THEN 'Never expires'
    WHEN oml.expires_at > NOW() THEN 'Active'
    ELSE 'Expired'
  END as status
FROM licensing.org_module_licenses oml
WHERE oml.org_id = (SELECT id FROM core.organisations WHERE slug = '${config.organisation.slug}');
`

  return output
}

export function validateRelationships(config: TenantConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  const orgId = config.organisation.id
  ;(config.sites || []).forEach((site, idx) => {
    if (site.org_id !== orgId) {
      errors.push(`Site ${idx} (${site.name}) references wrong org_id: ${site.org_id}`)
    }
  })

  const siteIds = new Set((config.sites || []).map((s) => s.id))
  ;(config.buildings || []).forEach((building, idx) => {
    if (!siteIds.has(building.site_id)) {
      errors.push(`Building ${idx} (${building.name}) references non-existent site_id: ${building.site_id}`)
    }
  })

  const buildingIds = new Set((config.buildings || []).map((b) => b.id))
  ;(config.floors || []).forEach((floor, idx) => {
    if (!buildingIds.has(floor.building_id)) {
      errors.push(`Floor ${idx} (${floor.name}) references non-existent building_id: ${floor.building_id}`)
    }
    if (floor.org_id !== orgId) {
      errors.push(`Floor ${idx} (${floor.name}) references wrong org_id: ${floor.org_id}`)
    }
  })

  const floorIds = new Set((config.floors || []).map((f) => f.id))

  // Only validate floor_id references if floors exist
  if (floorIds.size > 0) {
    ;(config.devices || []).forEach((device, idx) => {
      if (!floorIds.has(device.floor_id)) {
        errors.push(`Device ${idx} (${device.name}) references non-existent floor_id: ${device.floor_id}`)
      }
      if (device.org_id !== orgId) {
        errors.push(`Device ${idx} (${device.name}) references wrong org_id: ${device.org_id}`)
      }
    })
  }

  const passTypeCodes = new Set<string>()
  ;(config.passTypes || []).forEach((passType, idx) => {
    if (passType.org_id !== orgId) {
      errors.push(`Pass type ${idx} (${passType.name}) references wrong org_id: ${passType.org_id}`)
    }
    if (passTypeCodes.has(passType.code)) {
      errors.push(`Duplicate pass type code: ${passType.code}`)
    }
    passTypeCodes.add(passType.code)
  })

  const deviceSlugs = (config.devices || []).filter((d) => d.slug).map((d) => d.slug)
  const duplicateDeviceSlugs = deviceSlugs.filter((slug, idx) => deviceSlugs.indexOf(slug) !== idx)
  if (duplicateDeviceSlugs.length > 0) {
    errors.push(`Duplicate device slugs found: ${duplicateDeviceSlugs.join(", ")}`)
  }

  const deviceIds = new Set((config.devices || []).map((d) => d.id))
  ;(config.accesspointSlugs || []).forEach((slug, idx) => {
    if (!deviceIds.has(slug.device_id)) {
      errors.push(`Access point slug ${idx} (${slug.slug}) references non-existent device_id: ${slug.device_id}`)
    }
  })

  const slugs = (config.accesspointSlugs || []).map((s) => s.slug)
  const duplicateSlugs = slugs.filter((slug, idx) => slugs.indexOf(slug) !== idx)
  if (duplicateSlugs.length > 0) {
    errors.push(`Duplicate slugs found in accesspointSlugs: ${duplicateSlugs.join(", ")}`)
  }

  // Validate integrations
  const integrationOrgIds = new Set<string>()
  ;(config.integrations || []).forEach((integration, idx) => {
    if (integration.organisation_id !== orgId) {
      errors.push(
        `Integration ${idx} (${integration.name}) references wrong organisation_id: ${integration.organisation_id}`,
      )
    }
    integrationOrgIds.add(integration.organisation_id)
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
