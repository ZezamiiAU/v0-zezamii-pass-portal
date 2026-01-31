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

// Generate unique pass number
function generatePassNumber() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ZP-${timestamp}-${random}`
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
 * Calculate valid_from and valid_to based on booking times and buffers
 * 
 * @param {Date|null} bookedFrom - User-selected booking start (null for enter-now)
 * @param {Date|null} bookedTo - User-selected booking end (null for enter-now)
 * @param {number} durationHours - Pass type duration in hours
 * @param {object} profile - Profile object (may be null)
 * @returns {object} { validFrom: Date, validTo: Date }
 */
function calculateAccessWindow(bookedFrom, bookedTo, durationHours, profile) {
  const now = new Date()
  
  // Legacy "enter now" flow - no booking times
  if (!bookedFrom || !bookedTo) {
    const validFrom = now
    const validTo = new Date(now.getTime() + durationHours * 60 * 60 * 1000)
    return { validFrom, validTo }
  }

  // Booking mode - apply buffers
  const bufferBefore = profile?.entry_buffer_minutes || 0
  const bufferAfter = profile?.exit_buffer_minutes || 0

  // validFrom = bookedFrom - buffer_before
  const validFrom = new Date(bookedFrom.getTime() - bufferBefore * 60 * 1000)
  
  // validTo = bookedTo + buffer_after
  const validTo = new Date(bookedTo.getTime() + bufferAfter * 60 * 1000)

  return { validFrom, validTo }
}

/**
 * POST /api/v1/payment-intents
 * 
 * Creates a payment intent and pending pass.
 * Backwards compatible - existing payload continues working.
 * 
 * Request body:
 * {
 *   pass_type_id: string (required)
 *   device_id: string (optional)
 *   guest_name: string (required)
 *   guest_email: string (required)
 *   guest_phone: string (optional)
 *   booked_from: string (optional, ISO timestamp, only when future_booking_enabled)
 *   booked_to: string (optional, ISO timestamp, only when future_booking_enabled)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   pass_id: string,
 *   pass_number: string,
 *   valid_from: string,
 *   valid_to: string,
 *   booked_from: string (only if booking mode),
 *   booked_to: string (only if booking mode)
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json()

    // Validate required fields
    const { pass_type_id, device_id, guest_name, guest_email, guest_phone, booked_from, booked_to } = body

    if (!pass_type_id) {
      return NextResponse.json(
        { error: "Bad Request", message: "pass_type_id is required" },
        { status: 400 }
      )
    }

    if (!isValidUUID(pass_type_id)) {
      return NextResponse.json(
        { error: "Bad Request", message: "pass_type_id must be a valid UUID" },
        { status: 400 }
      )
    }

    if (!guest_name || !guest_email) {
      return NextResponse.json(
        { error: "Bad Request", message: "guest_name and guest_email are required" },
        { status: 400 }
      )
    }

    // Validate device_id if provided
    if (device_id && !isValidUUID(device_id)) {
      return NextResponse.json(
        { error: "Bad Request", message: "device_id must be a valid UUID" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServiceClient()

    // Fetch pass type with optional profile
    const { data: passType, error: passTypeError } = await supabase
      .schema("pass")
      .from("pass_types")
      .select(`
        id,
        name,
        duration_hours,
        price_cents,
        is_active,
        profile_id,
        pass_profiles:profile_id (
          id,
          code,
          profile_type,
          entry_buffer_minutes,
          exit_buffer_minutes,
          reset_buffer_minutes,
          future_booking_enabled,
          availability_enforcement,
          required_inputs
        )
      `)
      .eq("id", pass_type_id)
      .single()

    if (passTypeError || !passType) {
      return NextResponse.json(
        { error: "Not Found", message: "Pass type not found" },
        { status: 404 }
      )
    }

    if (!passType.is_active) {
      return NextResponse.json(
        { error: "Bad Request", message: "Pass type is not active" },
        { status: 400 }
      )
    }

    const profile = passType.pass_profiles

    // Parse booking times
    const parsedBookedFrom = parseUTCTimestamp(booked_from)
    const parsedBookedTo = parseUTCTimestamp(booked_to)

    // Validate booking times if provided
    const hasBookingTimes = parsedBookedFrom && parsedBookedTo

    if (hasBookingTimes) {
      // Check if future booking is enabled for this pass type
      const futureBookingEnabled = profile?.future_booking_enabled || false

      if (!futureBookingEnabled) {
        // Option 1: Ignore booking times (legacy-safe)
        // Option 2: Return 400 (explicit rejection)
        // We'll use Option 1 for backwards compatibility - just ignore
        console.log(
          `[Payment Intent API] Ignoring booking times - future_booking_enabled is false for pass type ${pass_type_id}`
        )
      }

      // Validate booked_from < booked_to
      if (parsedBookedFrom >= parsedBookedTo) {
        return NextResponse.json(
          { error: "Bad Request", message: "booked_from must be before booked_to" },
          { status: 400 }
        )
      }
    }

    // Determine if we should use booking mode
    const useBookingMode = hasBookingTimes && (profile?.future_booking_enabled || false)

    // Calculate access window (valid_from / valid_to)
    const { validFrom, validTo } = calculateAccessWindow(
      useBookingMode ? parsedBookedFrom : null,
      useBookingMode ? parsedBookedTo : null,
      passType.duration_hours,
      profile
    )

    // Generate pass number
    const passNumber = generatePassNumber()

    // Create the pass record
    const passData = {
      pass_number: passNumber,
      pass_type_id: pass_type_id,
      device_id: device_id || null,
      guest_name: guest_name,
      guest_email: guest_email,
      guest_phone: guest_phone || null,
      valid_from: validFrom.toISOString(),
      valid_until: validTo.toISOString(),
      status: "pending", // Will be activated after payment confirmation
    }

    // Add booking columns only if using booking mode
    if (useBookingMode) {
      passData.booked_from = parsedBookedFrom.toISOString()
      passData.booked_to = parsedBookedTo.toISOString()
    }

    const { data: pass, error: passError } = await supabase
      .schema("pass")
      .from("passes")
      .insert(passData)
      .select("id, pass_number, valid_from, valid_until, booked_from, booked_to")
      .single()

    if (passError) {
      console.error("[Payment Intent API] Error creating pass:", passError)
      return NextResponse.json(
        { error: "Database Error", message: "Failed to create pass" },
        { status: 500 }
      )
    }

    // Build response
    const response = {
      success: true,
      pass_id: pass.id,
      pass_number: pass.pass_number,
      valid_from: pass.valid_from,
      valid_to: pass.valid_until,
      price_cents: passType.price_cents,
    }

    // Include booking times in response only if booking mode was used
    if (useBookingMode) {
      response.booked_from = pass.booked_from
      response.booked_to = pass.booked_to
      response.booking_mode = true
    }

    console.log(
      `[Payment Intent API] Created pass ${pass.id}, booking_mode: ${useBookingMode}`
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Payment Intent API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/payment-intents
 * 
 * Get pass details by ID or pass_number
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const passId = searchParams.get("pass_id")
    const passNumber = searchParams.get("pass_number")

    if (!passId && !passNumber) {
      return NextResponse.json(
        { error: "Bad Request", message: "pass_id or pass_number is required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServiceClient()

    let query = supabase
      .schema("pass")
      .from("passes")
      .select(`
        id,
        pass_number,
        guest_name,
        guest_email,
        guest_phone,
        valid_from,
        valid_until,
        booked_from,
        booked_to,
        status,
        created_at,
        pass_types:pass_type_id (
          id,
          name,
          price_cents
        )
      `)

    if (passId) {
      if (!isValidUUID(passId)) {
        return NextResponse.json(
          { error: "Bad Request", message: "pass_id must be a valid UUID" },
          { status: 400 }
        )
      }
      query = query.eq("id", passId)
    } else {
      query = query.eq("pass_number", passNumber)
    }

    const { data: pass, error } = await query.single()

    if (error || !pass) {
      return NextResponse.json(
        { error: "Not Found", message: "Pass not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: pass.id,
        pass_number: pass.pass_number,
        guest_name: pass.guest_name,
        guest_email: pass.guest_email,
        guest_phone: pass.guest_phone,
        valid_from: pass.valid_from,
        valid_to: pass.valid_until,
        booked_from: pass.booked_from,
        booked_to: pass.booked_to,
        status: pass.status,
        created_at: pass.created_at,
        pass_type: pass.pass_types,
      },
    })
  } catch (error) {
    console.error("[Payment Intent API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
