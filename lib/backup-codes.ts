import { SupabaseClient } from "@supabase/supabase-js"

// Backup Code System - Configurable Modes
// 
// Modes:
// - fortnightly (legacy): Static codes that rotate every 2 weeks from pass.backup_pincodes
// - pool (new): Dynamic daily pool with category-based codes from pass.backup_code_pool
// 
// Configuration:
// - Environment variable: BACKUP_CODE_MODE (fortnightly or pool)
// - Site-level override: core.sites.backup_code_mode column
// - PWA can pass mode preference in request

// Waterfall order for pool mode: shortest validity first
const CATEGORY_PRIORITY = ["day", "camping_3d", "camping_7d", "camping_14d"]

// Default mode from environment (fallback to fortnightly for safety)
const DEFAULT_MODE = process.env.BACKUP_CODE_MODE || "fortnightly"

// Get the backup code mode for a site
// Priority: explicit mode param > site setting > env default
export async function getBackupCodeMode(
  supabase: SupabaseClient,
  siteId: string,
  modeOverride?: string
): Promise<string> {
  // 1. Explicit override takes priority
  if (modeOverride === "fortnightly" || modeOverride === "pool") {
    return modeOverride
  }

  // 2. Check site-level setting on core.sites table
  const { data: site } = await supabase
    .from("sites")
    .select("backup_code_mode")
    .eq("id", siteId)
    .maybeSingle()

  if (site?.backup_code_mode) {
    return site.backup_code_mode
  }

  // 3. Fall back to environment default
  return DEFAULT_MODE
}

// Get a backup code - automatically routes to correct mode
export async function getBackupCode(
  supabase: SupabaseClient,
  passId: string,
  siteId: string,
  deviceId: string,
  options: { mode?: string } = {}
) {
  const mode = await getBackupCodeMode(supabase, siteId, options.mode)

  if (mode === "pool") {
    const result = await assignBackupCodeFromPool(supabase, passId, deviceId)
    return { ...result, mode: "pool" }
  } else {
    const result = await getFortnightlyBackupCode(supabase, siteId, deviceId)
    return { ...result, mode: "fortnightly" }
  }
}

// Get fortnightly backup code (legacy mode)
export async function getFortnightlyBackupCode(
  supabase: SupabaseClient,
  siteId: string,
  deviceId?: string
) {
  const now = new Date().toISOString()

  let query = supabase
    .from("backup_pincodes")
    .select("pincode, period_end")
    .eq("site_id", siteId)
    .lte("period_start", now)
    .gte("period_end", now)

  // Filter by device if provided
  if (deviceId) {
    query = query.eq("device_id", deviceId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error("[Backup Code] Error fetching fortnightly code:", error)
    return { success: false, error: "Failed to fetch backup code" }
  }

  if (!data) {
    return { success: false, error: "No backup code available for this period" }
  }

  return {
    success: true,
    code: data.pincode,
    periodEnd: data.period_end,
  }
}

// Assign an available backup code from the pool (new mode)
// Uses waterfall logic: tries shortest validity first, falls back to longer
async function assignBackupCodeFromPool(
  supabase: SupabaseClient,
  passId: string,
  deviceId: string
) {
  const now = new Date().toISOString()

  // Try each category in priority order (waterfall)
  for (const category of CATEGORY_PRIORITY) {
    // Find an available code in this category
    const { data: availableCode, error: selectError } = await supabase
      .from("backup_code_pool")
      .select("id, code, category, expires_at")
      .eq("device_id", deviceId)
      .eq("status", "available")
      .eq("category", category)
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle()

    if (selectError) {
      console.error(`[Backup Code Pool] Error querying category ${category}:`, selectError)
      continue
    }

    if (availableCode) {
      // Assign the code to this pass
      const { error: updateError } = await supabase
        .from("backup_code_pool")
        .update({
          status: "assigned",
          pass_id: passId,
          assigned_at: now,
        })
        .eq("id", availableCode.id)
        .eq("status", "available")

      if (updateError) {
        console.error(`[Backup Code Pool] Failed to assign code ${availableCode.id}:`, updateError)
        continue
      }

      console.log(`[Backup Code Pool] Assigned ${category} code to pass ${passId}`)

      return {
        success: true,
        code: availableCode.code,
        category: availableCode.category,
        expiresAt: availableCode.expires_at,
      }
    }
  }

  // No codes available - fall back to fortnightly as last resort
  console.warn(`[Backup Code Pool] No pool codes for device ${deviceId}, trying fortnightly fallback`)
  
  // Get site_id from device
  const { data: device } = await supabase
    .from("devices")
    .select("site_id")
    .eq("id", deviceId)
    .maybeSingle()

  if (device?.site_id) {
    const fortnightlyResult = await getFortnightlyBackupCode(supabase, device.site_id, deviceId)
    if (fortnightlyResult.success) {
      return { ...fortnightlyResult, category: "fortnightly_fallback" }
    }
  }

  return {
    success: false,
    error: "No backup codes available. Please contact support.",
  }
}

// Get the currently assigned backup code for a pass (pool mode only)
export async function getAssignedBackupCode(supabase: SupabaseClient, passId: string) {
  const { data, error } = await supabase
    .from("backup_code_pool")
    .select("code, category, expires_at")
    .eq("pass_id", passId)
    .eq("status", "assigned")
    .maybeSingle()

  if (error) {
    console.error(`[Backup Code Pool] Error fetching assigned code:`, error)
    return null
  }

  return data
    ? { code: data.code, category: data.category, expiresAt: data.expires_at }
    : null
}

// Release a backup code back to the pool (e.g., if pass is cancelled)
export async function releaseBackupCode(supabase: SupabaseClient, passId: string) {
  const { error } = await supabase
    .from("backup_code_pool")
    .update({
      status: "available",
      pass_id: null,
      assigned_at: null,
    })
    .eq("pass_id", passId)
    .eq("status", "assigned")

  if (error) {
    console.error(`[Backup Code Pool] Error releasing code for pass ${passId}:`, error)
  }
}

// Check if pool mode is enabled for a site
export async function checkBackupCodeMode(supabase: SupabaseClient, siteId: string) {
  const mode = await getBackupCodeMode(supabase, siteId)
  return {
    mode,
    isPoolEnabled: mode === "pool",
  }
}
