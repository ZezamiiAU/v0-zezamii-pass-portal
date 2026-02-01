"use server"

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Create Supabase client with service role for API operations
function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables not configured")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * GET /api/v1/pass-types
 * 
 * Returns pass types with optional profile object when profile_id is linked.
 * Backwards compatible - legacy clients receive unchanged response structure.
 * 
 * Query params:
 * - site_id (optional): Filter by site
 * - device_id (optional): Filter by device
 * - organization_id (optional): Filter by organization
 * - slug (optional): Filter by accesspoint slug
 * 
 * Response format:
 * {
 *   "id": "uuid",
 *   "name": "Entry Pass",
 *   "price_cents": 2000,
 *   "profile": {                        // Only present when profile_id is linked
 *     "profile_code": "end_of_day",
 *     "required_inputs": ["date"],
 *     "future_booking_enabled": false,
 *     "availability_enforcement": false,
 *     "buffer_before_minutes": 15,
 *     "buffer_after_minutes": 15
 *   }
 * }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("site_id")
    const deviceId = searchParams.get("device_id")
    const organizationId = searchParams.get("organization_id")
    const slug = searchParams.get("slug")

    const supabase = getSupabaseServiceClient()

    // Build query with optional profile join
    let query = supabase
      .schema("pass")
      .from("pass_types")
      .select(`
        id,
        name,
        description,
        duration_hours,
        price_cents,
        stripe_product_id,
        stripe_price_id,
        max_uses,
        is_active,
        display_order,
        org_id,
        profile_id,
        created_at,
        updated_at,
        pass_profiles:profile_id (
          id,
          code,
          name,
          profile_type,
          duration_minutes,
          duration_options,
          checkout_time,
          entry_buffer_minutes,
          exit_buffer_minutes,
          reset_buffer_minutes,
          required_inputs,
          future_booking_enabled,
          availability_enforcement
        )
      `)
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })

    // Apply filters
    if (organizationId) {
      query = query.eq("org_id", organizationId)
    }

    if (siteId) {
      // Get organization for site and filter
      const { data: site } = await supabase
        .schema("core")
        .from("sites")
        .select("org_id")
        .eq("id", siteId)
        .single()
      
      if (site) {
        query = query.eq("org_id", site.org_id)
      }
    }

    // If slug is provided, look up the device and filter by its organization
    if (slug) {
      const { data: accesspoint } = await supabase
        .schema("pass")
        .from("accesspoint_slugs")
        .select(`
          device_id,
          devices:device_id (
            site_id,
            sites:site_id (
              org_id
            )
          )
        `)
        .eq("slug", slug)
        .eq("is_active", true)
        .single()

      if (accesspoint?.devices?.sites?.org_id) {
        query = query.eq("org_id", accesspoint.devices.sites.org_id)
      }
    }

    const { data: passTypes, error } = await query

    if (error) {
      console.error("[Pass Types API] Error fetching pass types:", error)
      return NextResponse.json(
        { error: "Database Error", message: "Failed to fetch pass types" },
        { status: 500 }
      )
    }

    // Transform response to match locked API contract
    const transformedPassTypes = passTypes.map((pt) => {
      const result = {
        id: pt.id,
        name: pt.name,
        description: pt.description,
        duration_hours: pt.duration_hours,
        price_cents: pt.price_cents,
        stripe_product_id: pt.stripe_product_id,
        stripe_price_id: pt.stripe_price_id,
        max_uses: pt.max_uses,
        is_active: pt.is_active,
        display_order: pt.display_order,
        org_id: pt.org_id,
        created_at: pt.created_at,
        updated_at: pt.updated_at,
      }

      // Add profile object only when profile_id is linked and profile exists
      // Fallback safely if profile row missing unexpectedly
      if (pt.profile_id && pt.pass_profiles) {
        result.profile = {
          profile_code: pt.pass_profiles.code,
          profile_type: pt.pass_profiles.profile_type,
          required_inputs: pt.pass_profiles.required_inputs || [],
          future_booking_enabled: pt.pass_profiles.future_booking_enabled || false,
          availability_enforcement: pt.pass_profiles.availability_enforcement || false,
          // Map DB field names to API field names
          buffer_before_minutes: pt.pass_profiles.entry_buffer_minutes || 0,
          buffer_after_minutes: pt.pass_profiles.exit_buffer_minutes || 0,
          reset_buffer_minutes: pt.pass_profiles.reset_buffer_minutes || 0,
          // Additional profile fields for PWA
          duration_minutes: pt.pass_profiles.duration_minutes,
          duration_options: pt.pass_profiles.duration_options || [],
          checkout_time: pt.pass_profiles.checkout_time,
        }
      }
      // If profile_id is NULL or profile row missing → omit profile entirely (legacy behavior)

      return result
    })

    return NextResponse.json({
      success: true,
      data: transformedPassTypes,
      count: transformedPassTypes.length,
    })
  } catch (error) {
    console.error("[Pass Types API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
