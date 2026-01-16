import type { TenantConfig } from "@/lib/schemas/tenant-config"
import { generateId, ensureValidId } from "./id-generator"

export interface ExcelRow {
  [key: string]: string | number | boolean | null
}

export interface SetupData {
  // Organisation defaults
  organisation_name: string
  organisation_slug: string
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  contact_email: string
  contact_phone?: string
  support_email?: string
  billing_email?: string

  // Address defaults (will propagate to sites unless overridden)
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string

  // Common settings
  timezone: string

  // Stripe
  stripe_account_id?: string

  // Instructions
  _instructions?: string
}

export function jsonToExcelData(config: TenantConfig): { [sheetName: string]: ExcelRow[] } {
  const sheets: { [sheetName: string]: ExcelRow[] } = {}

  // Sheet 1: Organisation (with sites, buildings, floors)
  const orgData: ExcelRow[] = []

  // Add organisation row
  orgData.push({
    type: "Organisation",
    id: config.organisation.id,
    parent_id: "",
    name: config.organisation.name,
    slug: config.organisation.slug,
    address: config.organisation.address || "",
    city: config.organisation.city || "",
    state: config.organisation.state || "",
    country: config.organisation.country || "",
    postal_code: config.organisation.postal_code || "",
    timezone: config.organisation.timezone,
    is_active: config.organisation.is_active,
    notes: config.organisation.notes || "",
  })

  // Add sites
  config.sites.forEach((site) => {
    orgData.push({
      type: "Site",
      id: site.id,
      parent_id: site.org_id,
      name: site.name,
      slug: site.slug || "",
      address: site.address || "",
      city: site.city || "",
      state: site.state || "",
      country: site.country || "",
      postal_code: site.postal_code || "",
      timezone: site.timezone,
      is_active: site.is_active !== false,
      notes: site.notes || "",
    })
  })

  // Add buildings
  if (config.buildings && config.buildings.length > 0) {
    config.buildings.forEach((building) => {
      orgData.push({
        type: "Building",
        id: building.id,
        parent_id: building.site_id,
        name: building.name,
        slug: "",
        address: building.address || "",
        city: "",
        state: "",
        country: "",
        postal_code: "",
        timezone: "",
        is_active: building.is_active !== false,
        notes: building.notes || "",
      })
    })
  }

  // Add floors
  if (config.floors && config.floors.length > 0) {
    config.floors.forEach((floor) => {
      orgData.push({
        type: "Floor",
        id: floor.id,
        parent_id: floor.building_id,
        name: floor.name,
        slug: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postal_code: "",
        timezone: "",
        is_active: floor.is_active !== false,
        notes: floor.notes || "",
      })
    })
  }

  sheets["Organisation"] = orgData

  // Sheet 2: Contacts
  sheets["Contacts"] = [
    {
      org_id: config.organisation.id,
      contact_email: config.organisation.contact_email,
      contact_phone: config.organisation.contact_phone || "",
      support_email: config.organisation.support_email || "",
      billing_email: config.organisation.billing_email,
    },
  ]

  // Sheet 3: Branding
  sheets["Branding"] = [
    {
      org_id: config.organisation.id,
      logo_url: config.organisation.logo_url || "",
      primary_color: config.organisation.primary_color || "",
      secondary_color: config.organisation.secondary_color || "",
      stripe_account_id: config.organisation.stripe_account_id || "",
    },
  ]

  // Sheet 4: Devices
  sheets["Devices"] = config.devices.map((device) => ({
    id: device.id,
    org_id: device.org_id,
    floor_id: device.floor_id,
    name: device.name,
    slug: device.slug || "",
    slug_is_active: device.slug_is_active !== false,
    category: device.category,
    status: device.status || "active",
    code: device.code || "",
    serial: device.serial || "",
    lock_id: device.lock_id || "",
    custom_name: device.custom_name || "",
    custom_description: device.custom_description || "",
    custom_logo_url: device.custom_logo_url || "",
  }))

  // Sheet 5: Passes
  sheets["Passes"] = config.passTypes.map((passType) => ({
    id: passType.id,
    org_id: passType.org_id,
    name: passType.name,
    code: passType.code,
    description: passType.description || "",
    duration_minutes: Number(passType.duration_minutes || 0),
    price_cents: Number(passType.price_cents),
    stripe_product_id: passType.stripe_product_id || "",
    stripe_price_id: passType.stripe_price_id || "",
    max_uses: passType.max_uses ? Number(passType.max_uses) : "",
    is_active: passType.is_active !== false,
    display_order: passType.display_order ? Number(passType.display_order) : "",
    notes: passType.notes || "",
  }))

  return sheets
}

export function excelDataToJson(sheets: { [sheetName: string]: ExcelRow[] }): TenantConfig {
  const normalizedSheets: { [sheetName: string]: ExcelRow[] } = {}

  Object.keys(sheets).forEach((sheetName) => {
    normalizedSheets[sheetName] = sheets[sheetName].map((row) => {
      const normalizedRow: ExcelRow = {}
      Object.keys(row).forEach((key) => {
        normalizedRow[key.toLowerCase().replace(/\s+/g, "_")] = row[key]
      })
      return normalizedRow
    })
  })

  const config: any = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
  }

  // Parse Organisation sheet (new multi-worksheet format)
  const orgSheet = normalizedSheets["Organisation"] || []

  if (orgSheet.length > 0) {
    // Extract organisation
    const orgRow = orgSheet.find((row) => row.type === "Organisation" || row.type === "organisation")
    if (!orgRow) throw new Error("Organisation row is required in Organisation sheet")

    // Parse Contacts sheet
    const contactRow = normalizedSheets["Contacts"]?.[0] || {}

    // Parse Branding sheet
    const brandRow = normalizedSheets["Branding"]?.[0] || {}

    // Generate organisation ID
    const orgId = generateId()

    config.organisation = {
      id: orgId,
      name: orgRow.name,
      slug: orgRow.slug,
      logo_url: brandRow.logo_url || null,
      primary_color: brandRow.primary_color || undefined,
      secondary_color: brandRow.secondary_color || undefined,
      contact_email: contactRow.contact_email || orgRow.name,
      contact_phone: contactRow.contact_phone || undefined,
      support_email: contactRow.support_email || undefined,
      billing_email: contactRow.billing_email || contactRow.contact_email,
      address: orgRow.address || undefined,
      city: orgRow.city || undefined,
      state: orgRow.state || undefined,
      country: orgRow.country || undefined,
      postal_code: orgRow.postal_code ? String(orgRow.postal_code) : undefined,
      timezone: orgRow.timezone,
      is_active: orgRow.is_active !== false,
      stripe_account_id: brandRow.stripe_account_id || null,
      notes: orgRow.notes || undefined,
    }

    // Create ID lookup maps
    const siteIdMap = new Map<string, string>() // site name -> ID
    const buildingIdMap = new Map<string, string>() // building name -> ID
    const floorIdMap = new Map<string, string>() // floor name -> ID

    // Extract sites and generate IDs
    config.sites = orgSheet
      .filter((row) => row.type === "Site" || row.type === "site")
      .map((row) => {
        const siteId = generateId()
        siteIdMap.set(row.name as string, siteId)

        return {
          id: siteId,
          org_id: orgId,
          name: row.name,
          slug: row.slug || undefined,
          address: row.address || undefined,
          city: row.city || undefined,
          state: row.state || undefined,
          country: row.country || undefined,
          postal_code: row.postal_code ? String(row.postal_code) : undefined,
          timezone: row.timezone || config.organisation.timezone,
          is_active: row.is_active !== false,
          notes: row.notes || undefined,
        }
      })

    // Extract buildings and match to sites by parent name
    config.buildings = orgSheet
      .filter((row) => (row.type === "Building" || row.type === "building") && row.name)
      .map((row) => {
        const buildingId = generateId()
        buildingIdMap.set(row.name as string, buildingId)

        const parentSiteName = row.parent_name || row.site_name
        const siteId = siteIdMap.get(parentSiteName as string) || config.sites[0]?.id || orgId

        return {
          id: buildingId,
          site_id: siteId,
          name: row.name,
          address: row.address || undefined,
          is_active: row.is_active !== false,
          notes: row.notes || undefined,
        }
      })

    // Extract floors and match to buildings by parent name
    config.floors = orgSheet
      .filter((row) => (row.type === "Floor" || row.type === "floor") && row.name)
      .map((row) => {
        const floorId = generateId()
        floorIdMap.set(row.name as string, floorId)

        const parentBuildingName = row.parent_name || row.building_name
        const buildingId = buildingIdMap.get(parentBuildingName as string) || config.buildings[0]?.id

        return {
          id: floorId,
          building_id: buildingId,
          org_id: orgId,
          name: row.name,
          level: 0,
          is_active: row.is_active !== false,
          notes: row.notes || undefined,
        }
      })

    // Parse Devices sheet and match to floors by name
    config.devices = (normalizedSheets["Devices"] || []).map((row) => {
      console.log("[v0] Device row keys:", Object.keys(row))
      console.log("[v0] Device row:", JSON.stringify(row))
      console.log("[v0] Available sites in map:", Array.from(siteIdMap.entries()))

      const locationName = (row.parent_location_name ||
        row.parent_location ||
        row.parentlocation ||
        row.parent_name ||
        row.floor_name ||
        row.floor ||
        row.site_name ||
        row.site ||
        "") as string

      console.log("[v0] Location name found:", locationName)

      // Case-insensitive lookup - try to find in floor map first, then site map
      const locationLower = locationName.toLowerCase().trim()
      let floorId: string | undefined
      let siteId: string | undefined

      // Check floor map (case-insensitive)
      for (const [key, value] of floorIdMap.entries()) {
        if (key.toLowerCase().trim() === locationLower) {
          floorId = value
          console.log("[v0] Found floor match:", key, "->", value)
          break
        }
      }

      // If not found in floors, check site map (case-insensitive)
      if (!floorId) {
        for (const [key, value] of siteIdMap.entries()) {
          if (key.toLowerCase().trim() === locationLower) {
            siteId = value
            console.log("[v0] Found site match:", key, "->", value)
            break
          }
        }
      }

      console.log("[v0] Final result - siteId:", siteId, "floorId:", floorId)

      return {
        id: generateId(),
        org_id: orgId,
        site_id: siteId || undefined,
        floor_id: floorId || undefined,
        area_id: null,
        name: row.name,
        category: row.category,
        status: row.status || "active",
        code: row.code || undefined,
        serial: row.serial || undefined,
        lock_id: row.lock_id || undefined,
        slug: row.slug || undefined,
        slug_is_active: row.slug_is_active !== false,
        custom_name: row.custom_name || undefined,
        custom_description: row.custom_description || undefined,
        custom_logo_url: row.custom_logo_url || null,
        rotation: 0,
      }
    })

    // Parse Passes sheet
    config.passTypes = (normalizedSheets["Passes"] || []).map((row) => ({
      id: generateId(),
      org_id: orgId,
      name: row.name,
      code: row.code,
      description: row.description || undefined,
      duration_minutes: Number(row.duration_minutes || 0),
      price_cents: Number(row.price_cents),
      stripe_product_id: row.stripe_product_id || null,
      stripe_price_id: row.stripe_price_id || null,
      max_uses: row.max_uses ? Number(row.max_uses) : undefined,
      is_active: row.is_active !== false,
      display_order: row.display_order ? Number(row.display_order) : undefined,
      notes: row.notes || undefined,
    }))
  } else {
    const configSheet = normalizedSheets["Configuration"] || []

    const configData: ExcelRow[] = []

    // Add organisation data
    configData.push({
      type: "Organisation",
      id: configSheet[0].id,
      org_id: "",
      site_id: "",
      building_id: "",
      floor_id: "",
      name: configSheet[0].name,
      slug: configSheet[0].slug,
      category: "",
      status: "",
      address: configSheet[0].address || "",
      city: configSheet[0].city || "",
      state: configSheet[0].state || "",
      country: configSheet[0].country || "",
      postal_code: configSheet[0].postal_code || "",
      timezone: configSheet[0].timezone,
      contact_email: configSheet[0].contact_email,
      contact_phone: configSheet[0].contact_phone || "",
      support_email: configSheet[0].support_email || "",
      billing_email: configSheet[0].billing_email || "",
      logo_url: configSheet[0].logo_url || "",
      primary_color: configSheet[0].primary_color || "",
      secondary_color: configSheet[0].secondary_color || "",
      is_active: configSheet[0].is_active,
      stripe_account_id: configSheet[0].stripe_account_id || "",
      code: "",
      serial: "",
      lock_id: "",
      custom_name: "",
      custom_description: "",
      custom_logo_url: "",
      slug_is_active: "",
      notes: configSheet[0].notes || "",
    })

    // Add sites data
    config.sites = configSheet
      .filter((row) => row.type === "Site")
      .map((row) => ({
        id: row.id,
        org_id: row.org_id,
        site_id: "",
        building_id: "",
        floor_id: "",
        name: row.name,
        slug: row.slug || "",
        category: "",
        status: "",
        address: row.address || "",
        city: row.city || "",
        state: row.state || "",
        country: row.country || "",
        postal_code: row.postal_code || "",
        timezone: row.timezone,
        contact_email: "",
        contact_phone: "",
        support_email: "",
        billing_email: "",
        logo_url: "",
        primary_color: "",
        secondary_color: "",
        is_active: row.is_active !== false,
        stripe_account_id: "",
        code: "",
        serial: "",
        lock_id: "",
        custom_name: "",
        custom_description: "",
        custom_logo_url: "",
        slug_is_active: "",
        notes: row.notes || "",
      }))

    // Add buildings data
    config.buildings = configSheet
      .filter((row) => row.type === "Building")
      .map((row) => ({
        id: row.id,
        site_id: row.site_id,
        name: row.name,
        address: row.address || "",
        is_active: row.is_active !== false,
        notes: row.notes || "",
      }))

    // Add floors data
    config.floors = configSheet
      .filter((row) => row.type === "Floor")
      .map((row) => ({
        id: row.id,
        building_id: row.building_id,
        name: row.name,
        is_active: row.is_active !== false,
        notes: row.notes || "",
      }))

    // If no floors provided but buildings exist, create default "Ground" floor for each building
    if (config.floors.length === 0 && config.buildings && config.buildings.length > 0) {
      config.floors = config.buildings.map((building, index) => ({
        id: generateId(),
        building_id: building.id,
        name: "Ground",
        level: 0,
        is_active: true,
        notes: "Auto-generated default floor",
      }))
    }

    // Extract devices
    config.devices = configSheet
      .filter((row) => row.type === "Device")
      .map((row) => ({
        id: row.id,
        org_id: row.org_id,
        floor_id: row.floor_id,
        name: row.name,
        slug: row.slug || "",
        slug_is_active: row.slug_is_active !== false,
        category: row.category,
        status: row.status || "active",
        code: row.code || "",
        serial: row.serial || "",
        lock_id: row.lock_id || "",
        customer_name: row.customer_name || "",
        work_order_ref: row.work_order_ref || "",
        customer_id: row.customer_id || null,
        notes: row.notes || "",
      }))

    // Parse Passes sheet
    config.passTypes = (normalizedSheets["Passes"] || []).map((row) => ({
      id: ensureValidId(row.id),
      org_id: ensureValidId(row.org_id) || config.organisation.id,
      name: row.name,
      code: row.code,
      description: row.description || undefined,
      duration_minutes: Number(row.duration_minutes || row.duration_hours * 60 || 0),
      price_cents: Number(row.price_cents),
      stripe_product_id: row.stripe_product_id || null,
      stripe_price_id: row.stripe_price_id || null,
      max_uses: row.max_uses ? Number(row.max_uses) : undefined,
      is_active: row.is_active !== false,
      display_order: row.display_order ? Number(row.display_order) : undefined,
      notes: row.notes || undefined,
    }))

    // Parse Integrations sheet (optional)
    config.integrations = (normalizedSheets["Integrations"] || []).map((row) => ({
      id: ensureValidId(row.id),
      org_id: ensureValidId(row.org_id) || config.organisation.id,
      integration_type: row.integration_type,
      name: row.name,
      base_url: row.base_url || undefined,
      api_key: row.api_key || undefined,
      property_id: row.property_id || undefined,
      webhook_secret: row.webhook_secret || undefined,
      config_json: row.config_json ? JSON.parse(row.config_json as string) : undefined,
      is_active: row.is_active !== false,
      notes: row.notes || undefined,
    }))
  }

  config.accesspointSlugs = []

  return config as TenantConfig
}
