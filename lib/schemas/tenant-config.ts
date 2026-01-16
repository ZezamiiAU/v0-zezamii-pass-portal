import { z } from "zod"

const customIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID format")

// Define passTypeSchema here since it's used in tenantConfigSchema
const passTypeSchema = z.object({
  id: customIdSchema,
  org_id: customIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  duration_minutes: z.number().int().positive(),
  price_cents: z.number().int().min(0),
  code: z.string().min(1),
  stripe_product_id: z.string().nullable().optional(),
  stripe_price_id: z.string().nullable().optional(),
  max_uses: z.number().int().positive().optional(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().optional(),
  notes: z.string().optional(),
})

export const organisationSchema = z.object({
  id: customIdSchema,
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  billing_email: z.string().email(),
  timezone: z.string().default("Australia/Brisbane"),
  locale: z.string().default("en-AU").optional(),
  custom_domain: z.string().nullable().optional(),
  brand_settings: z.record(z.any()).optional().default({}),
  agent_settings: z.record(z.any()).optional().default({}),
  tier_id: customIdSchema.nullable().optional(),
  parent_organisation_id: customIdSchema.nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  support_email: z.string().email().optional(),
  // Address fields for template - not stored in organisations table
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  is_active: z.boolean().default(true),
  stripe_account_id: z.string().nullable().optional(),
  notes: z.string().optional(),
})

// Site schema
export const siteSchema = z.object({
  id: customIdSchema,
  org_id: customIdSchema,
  name: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  timezone: z.string(),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
})

// Building schema
export const buildingSchema = z.object({
  id: customIdSchema,
  site_id: customIdSchema,
  name: z.string().min(1),
  address: z.string().optional(),
  floor_count: z.number().int().min(1).optional(),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
})

// Floor schema
export const floorSchema = z.object({
  id: customIdSchema,
  building_id: customIdSchema,
  org_id: customIdSchema,
  name: z.string().min(1),
  level: z.number().int(),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
})

export const deviceSchema = z.object({
  id: customIdSchema,
  org_id: customIdSchema,
  floor_id: customIdSchema.nullable().optional(), // Made floor_id optional since not all devices need to be assigned to a floor
  area_id: customIdSchema.nullable().optional(),
  name: z.string().min(1),
  category: z.enum([
    "camera",
    "door",
    "lock",
    "reader",
    "intercom",
    "controller",
    "nvr_dvr",
    "switch",
    "psu",
    "wifi_ap",
    "gate",
    "other",
  ]),
  status: z.string().default("active"),
  position: z.record(z.any()).optional(), // JSONB for x, y coordinates
  rotation: z.number().int().default(0),
  code: z.string().optional(),
  serial: z.string().optional(),
  lock_id: z.union([z.number().int(), z.string()]).optional(), // Accept both string and number for lock_id
  customer_name: z.string().optional(),
  work_order_ref: z.string().optional(),
  customer_id: customIdSchema.nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  slug_is_active: z.boolean().default(true).optional(),
  custom_name: z.string().optional(),
  custom_description: z.string().optional(),
  custom_logo_url: z.string().url().nullable().optional(),
})

// Access point slug schema (if exists in actual DB)
export const accesspointSlugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  device_id: customIdSchema,
  custom_name: z.string().optional(),
  custom_description: z.string().optional(),
  custom_logo_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
})

// Integration schema
export const integrationSchema = z
  .object({
    id: customIdSchema,
    org_id: customIdSchema.optional(), // Template uses org_id
    organisation_id: customIdSchema.optional(), // Database uses organisation_id
    integration_type: z.enum(["rooms_event_hub", "lock_provider", "pms"]),
    name: z.string().min(1),
    status: z.enum(["active", "inactive", "error"]).default("active").optional(),
    credentials: z.record(z.any()).optional(), // Database uses credentials (jsonb)
    config: z.record(z.any()).optional(), // Database uses config (jsonb)
    // Legacy fields from old schema - optional for backward compatibility
    base_url: z.string().url().optional(),
    api_key: z.string().optional(),
    property_id: z.string().optional(),
    webhook_secret: z.string().optional(),
    config_json: z.record(z.any()).optional(), // Old field name
    last_used_at: z.string().datetime().optional(),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    is_active: z.boolean().default(true).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.org_id || data.organisation_id, {
    message: "Either org_id or organisation_id must be provided",
  })

// Full tenant configuration schema
export const tenantConfigSchema = z.object({
  version: z.string().optional(),
  generatedAt: z.string().datetime().optional(),
  organisation: organisationSchema,
  sites: z.array(siteSchema).min(1),
  buildings: z.array(buildingSchema).optional().default([]),
  floors: z.array(floorSchema).optional().default([]),
  devices: z.array(deviceSchema).min(1),
  passTypes: z.array(passTypeSchema).min(1),
  accesspointSlugs: z.array(accesspointSlugSchema).optional().default([]), // Deprecated but kept for compatibility
  integrations: z.array(integrationSchema).optional().default([]),
})

export type TenantConfig = z.infer<typeof tenantConfigSchema>
export type Organisation = z.infer<typeof organisationSchema>
export type Site = z.infer<typeof siteSchema>
export type Building = z.infer<typeof buildingSchema>
export type Floor = z.infer<typeof floorSchema>
export type Device = z.infer<typeof deviceSchema>
export type PassType = z.infer<typeof passTypeSchema>
export type AccesspointSlug = z.infer<typeof accesspointSlugSchema>
export type Integration = z.infer<typeof integrationSchema>
