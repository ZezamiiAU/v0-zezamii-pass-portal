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

// Validate UUID format
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Parse ISO timestamp string to Date (UTC)
function parseUTCTimestamp(timestamp) {
  if (!timestamp) return null
  const date = new Date(timestamp)
  return isNaN(date.getTime()) ? null : date
}

/**
 * GET /api/v1/availability
 * 
 * Check if a time slot is available for booking.
 * Only required when availability_enforcement === true for the pass type.
 * 
 * Query params:
 * - pass_type_id: string (required)
 * - booked_from: string (required, ISO timestamp)
 * - booked_to: string (required, ISO timestamp)
 * - device_id: string (optional, for resource-specific availability)
 * 
 * Response:
 * {
 *   available: boolean,
 *   reason?: string,           // Only present when not available
 *   conflicts?: number,        // Number of conflicting bookings
 *   enforcement_enabled: boolean
 * }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const passTypeId = searchParams.get("pass_type_id")
    const bookedFrom = searchParams.get("booked_from")
    const bookedTo = searchParams.get("booked_to")
    const deviceId = searchParams.get("device_id")

    // Validate required params
    if (!passTypeId) {
      return NextResponse.json(
        { error: "Bad Request", message: "pass_type_id is required" },
        { status: 400 }
      )
    }

    if (!isValidUUID(passTypeId)) {
      return NextResponse.json(
        { error: "Bad Request", message: "pass_type_id must be a valid UUID" },
        { status: 400 }
      )
    }

    if (!bookedFrom || !bookedTo) {
      return NextResponse.json(
        { error: "Bad Request", message: "booked_from and booked_to are required" },
        { status: 400 }
      )
    }

    const parsedFrom = parseUTCTimestamp(bookedFrom)
    const parsedTo = parseUTCTimestamp(bookedTo)

    if (!parsedFrom || !parsedTo) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid timestamp format" },
        { status: 400 }
      )
    }

    if (parsedFrom >= parsedTo) {
      return NextResponse.json(
        { error: "Bad Request", message: "booked_from must be before booked_to" },
        { status: 400 }
      )
    }

    if (deviceId && !isValidUUID(deviceId)) {
      return NextResponse.json(
        { error: "Bad Request", message: "device_id must be a valid UUID" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServiceClient()

    // Fetch pass type with profile to check if availability enforcement is enabled
    const { data: passType, error: passTypeError } = await supabase
      .schema("pass")
      .from("pass_types")
      .select(`
        id,
        name,
        profile_id,
        pass_profiles:profile_id (
          availability_enforcement
        )
      `)
      .eq("id", passTypeId)
      .single()

    if (passTypeError || !passType) {
      return NextResponse.json(
        { error: "Not Found", message: "Pass type not found" },
        { status: 404 }
      )
    }

    const enforcementEnabled = passType.pass_profiles?.availability_enforcement || false

    // If enforcement is not enabled, always return available
    if (!enforcementEnabled) {
      return NextResponse.json({
        available: true,
        enforcement_enabled: false,
        message: "Availability enforcement is not enabled for this pass type",
      })
    }

    // Check for conflicting bookings
    // A conflict exists if any existing booking overlaps with the requested time range
    // Overlap condition: existing.booked_from < requested.booked_to AND existing.booked_to > requested.booked_from
    let conflictQuery = supabase
      .schema("pass")
      .from("passes")
      .select("id, booked_from, booked_to, guest_name")
      .eq("pass_type_id", passTypeId)
      .in("status", ["active", "pending"]) // Only check active and pending passes
      .not("booked_from", "is", null) // Only check passes with booking times
      .not("booked_to", "is", null)
      .lt("booked_from", parsedTo.toISOString()) // existing.booked_from < requested.booked_to
      .gt("booked_to", parsedFrom.toISOString()) // existing.booked_to > requested.booked_from

    // If device_id provided, also filter by device (resource-specific availability)
    if (deviceId) {
      conflictQuery = conflictQuery.eq("device_id", deviceId)
    }

    const { data: conflicts, error: conflictError } = await conflictQuery

    if (conflictError) {
      console.error("[Availability API] Error checking conflicts:", conflictError)
      return NextResponse.json(
        { error: "Database Error", message: "Failed to check availability" },
        { status: 500 }
      )
    }

    const conflictCount = conflicts?.length || 0
    const isAvailable = conflictCount === 0

    const response = {
      available: isAvailable,
      enforcement_enabled: true,
      conflicts: conflictCount,
    }

    if (!isAvailable) {
      response.reason = `Time slot conflicts with ${conflictCount} existing booking(s)`
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Availability API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
