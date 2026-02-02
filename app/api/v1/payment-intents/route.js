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
 * Calculate valid_from and valid_until based on profile type and inputs
 * 
 * Profile types:
 * - instant: valid now for duration_hours
 * - end_of_day: valid until checkout_time (23:59 default) on selected date
 * - nights_checkout: valid until checkout_time (10:00 default) after N nights
 * - date_select: user selects date, valid until end of day or checkout_time
 * - datetime_select: user selects exact start/end times
 * - duration_select: user selects duration from options
 * 
 * @param {object} params
 * @param {Date|null} params.bookedFrom - User-selected booking start
 * @param {Date|null} params.bookedTo - User-selected booking end (for datetime_select)
 * @param {number|null} params.nights - Number of nights (for nights_checkout)
 * @param {number} params.durationHours - Pass type duration in hours (fallback)
 * @param {object|null} params.profile - Profile object
 * @returns {object} { validFrom: Date, validUntil: Date }
 */
function calculateAccessWindow({ bookedFrom, bookedTo, nights, durationHours, profile }) {
  const now = new Date()
  
  // Get buffers from profile
  const bufferBefore = profile?.entry_buffer_minutes || 0
  const bufferAfter = profile?.exit_buffer_minutes || 0
  
  // No profile = legacy instant access
  if (!profile) {
    const validFrom = now
    const validUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000)
    return { validFrom, validUntil }
  }
  
  const profileType = profile.profile_type
  const profileCode = profile.code
  
  // Parse checkout_time (e.g., "23:59:00" or "10:00:00")
  const checkoutTime = profile.checkout_time || "23:59:00"
  const [checkoutHour, checkoutMinute] = checkoutTime.split(":").map(Number)
  
  // Helper: set time on a date
  function setTimeOnDate(date, hour, minute) {
    const result = new Date(date)
    result.setUTCHours(hour, minute, 0, 0)
    return result
  }
  
  // Helper: get end of day for a date
  function getEndOfDay(date) {
    return setTimeOnDate(date, checkoutHour, checkoutMinute)
  }
  
  // Helper: add days to a date
  function addDays(date, days) {
    const result = new Date(date)
    result.setUTCDate(result.getUTCDate() + days)
    return result
  }

  let validFrom
  let validUntil
  
  switch (profileCode) {
    case "end_of_day":
      // Day pass: valid from now (or bookedFrom) until end of that day
      validFrom = bookedFrom || now
      validUntil = getEndOfDay(validFrom)
      break
      
    case "nights_checkout":
      // Camping: valid from bookedFrom until checkout_time after N nights
      validFrom = bookedFrom || now
      const numNights = nights || 1
      const checkoutDate = addDays(validFrom, numNights)
      validUntil = setTimeOnDate(checkoutDate, checkoutHour, checkoutMinute)
      break
      
    case "instant_access":
      // Instant: valid from now for duration_hours (or profile duration_minutes)
      validFrom = now
      const durationMins = profile.duration_minutes || (durationHours * 60)
      validUntil = new Date(now.getTime() + durationMins * 60 * 1000)
      break
      
    default:
      // For other profile types (datetime_select, duration_select)
      // Use booked times if provided, otherwise fallback to duration
      if (bookedFrom && bookedTo) {
        validFrom = new Date(bookedFrom.getTime() - bufferBefore * 60 * 1000)
        validUntil = new Date(bookedTo.getTime() + bufferAfter * 60 * 1000)
      } else {
        validFrom = now
        const defaultDuration = profile.duration_minutes || (durationHours * 60)
        validUntil = new Date(now.getTime() + defaultDuration * 60 * 1000)
      }
      break
  }
  
  // Apply entry buffer (allow early access)
  const finalValidFrom = new Date(validFrom.getTime() - bufferBefore * 60 * 1000)
  
  // Apply exit buffer (allow late exit) - but not for end_of_day/nights_checkout as checkout is fixed
  let finalValidUntil = validUntil
  if (profileCode !== "end_of_day" && profileCode !== "nights_checkout") {
    finalValidUntil = new Date(validUntil.getTime() + bufferAfter * 60 * 1000)
  }
  
  return { validFrom: finalValidFrom, validUntil: finalValidUntil }
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
          duration_minutes,
          checkout_time,
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

    // Extract nights from request body (for camping passes)
    const nights = body.nights ? parseInt(body.nights, 10) : null

    // Calculate access window using profile-driven computation
    const { validFrom, validUntil } = calculateAccessWindow({
      bookedFrom: parsedBookedFrom,
      bookedTo: parsedBookedTo,
      nights,
      durationHours: passType.duration_hours,
      profile,
    })

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
      valid_until: validUntil.toISOString(),
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
      valid_until: pass.valid_until,
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
        valid_until: pass.valid_until,
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
