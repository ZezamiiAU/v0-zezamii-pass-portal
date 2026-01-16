"use server"

import { tenantConfigSchema } from "@/lib/schemas/tenant-config"
import { generateSQL, validateRelationships } from "@/lib/utils/sql-generator"
import { generateId, ensureValidId } from "@/lib/utils/id-generator"

export type ValidationResult = {
  success: boolean
  errors?: string[]
  validatedConfig?: any
  generatedSQL?: string
  updatedJSON?: string
}

export async function validateConfiguration(jsonInput: string): Promise<ValidationResult> {
  try {
    if (!jsonInput.trim()) {
      return {
        success: false,
        errors: ["No JSON input provided. Please paste configuration data."],
      }
    }

    const parsed = JSON.parse(jsonInput)

    if (!parsed.organisation) {
      return {
        success: false,
        errors: ["Configuration must include an 'organisation' object."],
      }
    }

    if (!parsed.organisation.id) {
      parsed.organisation.id = generateId()
    } else {
      parsed.organisation.id = ensureValidId(parsed.organisation.id)
    }
    const orgId = parsed.organisation.id

    if (parsed.sites && Array.isArray(parsed.sites)) {
      parsed.sites = parsed.sites
        .map((site: any) => {
          if (!site) return null
          const siteId = site.id ? ensureValidId(site.id) : generateId()
          return {
            ...site,
            id: siteId,
            org_id: orgId,
          }
        })
        .filter(Boolean)
    }

    if (parsed.buildings && Array.isArray(parsed.buildings)) {
      parsed.buildings = parsed.buildings
        .map((building: any, idx: number) => {
          if (!building) return null
          const buildingId = building.id ? ensureValidId(building.id) : generateId()
          const matchingSite = parsed.sites?.[idx] || parsed.sites?.[0]
          return {
            ...building,
            id: buildingId,
            site_id: matchingSite?.id || building.site_id,
            org_id: orgId,
          }
        })
        .filter(Boolean)
    }

    if (parsed.floors && Array.isArray(parsed.floors)) {
      parsed.floors = parsed.floors
        .map((floor: any, idx: number) => {
          if (!floor) return null
          const floorId = floor.id ? ensureValidId(floor.id) : generateId()
          const matchingBuilding = parsed.buildings?.[idx] || parsed.buildings?.[0]
          return {
            ...floor,
            id: floorId,
            building_id: matchingBuilding?.id || floor.building_id,
            org_id: orgId,
          }
        })
        .filter(Boolean)
    }

    if (parsed.devices && Array.isArray(parsed.devices)) {
      parsed.devices = parsed.devices
        .map((device: any, idx: number) => {
          if (!device) return null
          const deviceId = device.id ? ensureValidId(device.id) : generateId()
          const matchingFloor = parsed.floors?.[idx] || parsed.floors?.[0]
          return {
            ...device,
            id: deviceId,
            floor_id: matchingFloor?.id || device.floor_id,
            org_id: orgId,
          }
        })
        .filter(Boolean)
    }

    if (parsed.passTypes && Array.isArray(parsed.passTypes)) {
      parsed.passTypes = parsed.passTypes
        .map((passType: any) => {
          if (!passType) return null
          const passTypeId = passType.id ? ensureValidId(passType.id) : generateId()
          return {
            ...passType,
            id: passTypeId,
            org_id: orgId,
          }
        })
        .filter(Boolean)
    }

    if (parsed.integrations && Array.isArray(parsed.integrations)) {
      parsed.integrations = parsed.integrations
        .map((integration: any) => {
          if (!integration) return null
          const integrationId = integration.id ? ensureValidId(integration.id) : generateId()
          return {
            ...integration,
            id: integrationId,
            organisation_id: orgId,
          }
        })
        .filter(Boolean)
    }

    const result = tenantConfigSchema.safeParse(parsed)

    if (!result.success) {
      const errors = result.error?.errors?.map((err) => `${err.path.join(".")}: ${err.message}`) || [
        "Schema validation failed",
      ]
      return {
        success: false,
        errors,
      }
    }

    const relationshipValidation = validateRelationships(parsed)

    if (!relationshipValidation.valid) {
      return {
        success: false,
        errors: relationshipValidation.errors,
      }
    }

    const sql = generateSQL(parsed as any)

    return {
      success: true,
      validatedConfig: parsed,
      generatedSQL: sql,
      updatedJSON: JSON.stringify(parsed, null, 2),
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        errors: [`JSON Parse Error: ${error.message}`],
      }
    }
    return {
      success: false,
      errors: [`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`],
    }
  }
}
