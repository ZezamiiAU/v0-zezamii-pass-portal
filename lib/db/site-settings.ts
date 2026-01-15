import { createClient } from "@/lib/supabase/server"

/**
 * Site Settings Database Operations
 */

export interface SiteSettings {
  id: string
  site_id: string
  pincode_digit_length: number
  created_at: string
  updated_at: string
}

/**
 * Get site settings by site ID
 */
export async function getSiteSettings(siteId: string): Promise<SiteSettings | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("site_settings").select("*").eq("site_id", siteId).single()

  if (error) {
    console.error("[v0] Error fetching site settings:", error)
    return null
  }

  return data
}

/**
 * Update site settings
 */
export async function updateSiteSettings(
  siteId: string,
  settings: Partial<Omit<SiteSettings, "id" | "site_id" | "created_at" | "updated_at">>,
): Promise<SiteSettings | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("site_settings").update(settings).eq("site_id", siteId).select().single()

  if (error) {
    console.error("[v0] Error updating site settings:", error)
    return null
  }

  return data
}

/**
 * Create or update site settings (upsert)
 */
export async function upsertSiteSettings(siteId: string, pincodeDigitLength: number): Promise<SiteSettings | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("site_settings")
    .upsert(
      {
        site_id: siteId,
        pincode_digit_length: pincodeDigitLength,
      },
      {
        onConflict: "site_id",
      },
    )
    .select()
    .single()

  if (error) {
    console.error("[v0] Error upserting site settings:", error)
    return null
  }

  return data
}

/**
 * Get effective pincode settings for a pass
 */
export async function getEffectivePincodeSettings(passId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.from("v_effective_pincode_settings").select("*").eq("pass_id", passId).single()

  if (error) {
    console.error("[v0] Error fetching effective pincode settings:", error)
    return null
  }

  return data
}
