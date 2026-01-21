import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Webhook payload from Rooms API
// Supports both flat format and nested event format
interface RoomsPinWebhookPayload {
  // Flat format (simple)
  reservationId?: string // Maps to pass_id in our system
  pinCode?: string
  validFrom?: string // ISO timestamp
  validUntil?: string // ISO timestamp
  roomId?: string // Zezamii room ID
  status?: string // active, revoked, or pending
  
  // Nested event format (from Rooms PRD)
  event?: string // pin.created
  timestamp?: string
  data?: {
    reservationId: string
    propertyId?: string
    roomId?: string
    pinCode: string
    validFrom: string
    validUntil: string
    guestName?: string
  }
}

// Normalized payload after parsing
interface NormalizedPayload {
  reservationId: string
  pinCode: string
  validFrom?: string
  validUntil?: string
  roomId?: string
  status: string
}

// Parse webhook payload - supports both flat and nested formats
function normalizePayload(payload: RoomsPinWebhookPayload): NormalizedPayload | null {
  // Nested event format
  if (payload.event === "pin.created" && payload.data) {
    return {
      reservationId: payload.data.reservationId,
      pinCode: payload.data.pinCode,
      validFrom: payload.data.validFrom,
      validUntil: payload.data.validUntil,
      roomId: payload.data.roomId,
      status: "active",
    }
  }
  
  // Flat format
  if (payload.reservationId && payload.pinCode) {
    return {
      reservationId: payload.reservationId,
      pinCode: payload.pinCode,
      validFrom: payload.validFrom,
      validUntil: payload.validUntil,
      roomId: payload.roomId,
      status: payload.status || "active",
    }
  }
  
  return null
}

// Create Supabase client with service role for webhook operations
function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables not configured")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

// Validate webhook authorization
function validateWebhookAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const webhookSecret = process.env.ROOMS_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error("[Rooms Webhook] ROOMS_WEBHOOK_SECRET not configured")
    return false
  }

  if (!authHeader) {
    console.error("[Rooms Webhook] No authorization header provided")
    return false
  }

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader

  return token === webhookSecret
}

export async function POST(request: Request) {
  try {
    // Validate authorization
    if (!validateWebhookAuth(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing authorization" },
        { status: 401 }
      )
    }

    // Parse request body
    const rawPayload: RoomsPinWebhookPayload = await request.json()
    
    // Normalize payload (supports both flat and nested formats)
    const payload = normalizePayload(rawPayload)

    // Validate required fields
    if (!payload) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "reservationId and pinCode are required",
        },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServiceClient()

    // Check if lock_code already exists for this pass (any provider)
    // Using pass.lock_codes schema
    const { data: existingCode } = await supabase
      .schema("pass")
      .from("lock_codes")
      .select("id, code, status, provider")
      .eq("pass_id", payload.reservationId)
      .maybeSingle()

    // If PIN already matches and status is active, skip update (idempotent)
    if (
      existingCode &&
      existingCode.code === payload.pinCode &&
      existingCode.status === "active" &&
      existingCode.provider === "rooms"
    ) {
      console.log(
        `[Rooms Webhook] Idempotent: PIN already set for pass ${payload.reservationId}`
      )
      return NextResponse.json({
        success: true,
        message: "PIN code already set (no changes made)",
        passId: payload.reservationId,
        idempotent: true,
      })
    }

    // Update or insert lock_code
    if (existingCode) {
      // Update existing lock_code (regardless of previous provider)
      const { error: updateError } = await supabase
        .schema("pass")
        .from("lock_codes")
        .update({
          code: payload.pinCode,
          status: "active",
          provider: "rooms",
          provider_ref: payload.reservationId,
          starts_at: payload.validFrom || null,
          ends_at: payload.validUntil || null,
        })
        .eq("id", existingCode.id)

      if (updateError) {
        console.error("[Rooms Webhook] Error updating lock_codes:", updateError)
        return NextResponse.json(
          { error: "Database Error", message: "Failed to update PIN code" },
          { status: 500 }
        )
      }

      console.log(
        `[Rooms Webhook] Updated existing lock_code (previous provider: ${existingCode.provider}) for pass ${payload.reservationId}`
      )
    } else {
      // Insert new lock_code (in case webhook arrives before PWA created pending record)
      const { error: insertError } = await supabase
        .schema("pass")
        .from("lock_codes")
        .insert({
          pass_id: payload.reservationId,
          code: payload.pinCode,
          status: "active",
          provider: "rooms",
          provider_ref: payload.reservationId,
          starts_at: payload.validFrom || null,
          ends_at: payload.validUntil || null,
        })

      if (insertError) {
        console.error("[Rooms Webhook] Error inserting lock_code:", insertError)
        return NextResponse.json(
          { error: "Database Error", message: "Failed to store PIN code" },
          { status: 500 }
        )
      }
    }

    // Also update the pass status to active if it was pending
    const { error: passError } = await supabase
      .schema("pass")
      .from("passes")
      .update({
        status: "active",
      })
      .eq("id", payload.reservationId)
      .eq("status", "pending") // Only update if currently pending

    if (passError) {
      console.error("[Rooms Webhook] Error updating pass status:", passError)
      // Don't fail the webhook - PIN was stored successfully
    }

    console.log(
      `[Rooms Webhook] PIN received for pass ${payload.reservationId}`
    )

    return NextResponse.json({
      success: true,
      message: "PIN code received and stored",
      passId: payload.reservationId,
    })
  } catch (error) {
    console.error("[Rooms Webhook] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

// DELETE endpoint to cancel/revoke a PIN request
// reason: "timeout" | "backup_used" | "payment_failed" | "user_cancelled"
export async function DELETE(request: Request) {
  try {
    // Validate authorization
    if (!validateWebhookAuth(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing authorization" },
        { status: 401 }
      )
    }

    // Parse request body
    const payload: {
      reservationId: string
      reason?: string // timeout, backup_used, payment_failed, user_cancelled
    } = await request.json()

    // Validate required fields
    if (!payload.reservationId) {
      return NextResponse.json(
        { error: "Bad Request", message: "reservationId is required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServiceClient()
    const reason = payload.reason || "user_cancelled"

    // Check current status for idempotency
    // Using pass.lock_codes schema - query by pass_id (any provider)
    const { data: existingCode } = await supabase
      .schema("pass")
      .from("lock_codes")
      .select("id, status, provider")
      .eq("pass_id", payload.reservationId)
      .maybeSingle()

    // If already revoked, return success (idempotent)
    if (existingCode && existingCode.status === "revoked") {
      console.log(
        `[Rooms Webhook] Idempotent: PIN already revoked for pass ${payload.reservationId}`
      )
      return NextResponse.json({
        success: true,
        message: "PIN already revoked (no changes made)",
        passId: payload.reservationId,
        idempotent: true,
      })
    }

    // If no lock_code exists, that's OK for timeout/backup scenarios
    // Just return success since there's nothing to revoke
    if (!existingCode) {
      if (reason === "timeout" || reason === "backup_used") {
        console.log(
          `[Rooms Webhook] No lock_code found for ${payload.reservationId}, reason: ${reason}`
        )
        return NextResponse.json({
          success: true,
          message: "No PIN to revoke (backup code in use)",
          passId: payload.reservationId,
          reason: reason,
        })
      }
      return NextResponse.json(
        { error: "Not Found", message: "No PIN found for this reservation" },
        { status: 404 }
      )
    }

    // Revoke the PIN (set status to revoked, keep code for audit)
    const { error: revokeError } = await supabase
      .schema("pass")
      .from("lock_codes")
      .update({
        status: "revoked",
      })
      .eq("id", existingCode.id)

    if (revokeError) {
      console.error("[Rooms Webhook] Error revoking lock_code:", revokeError)
      return NextResponse.json(
        { error: "Database Error", message: "Failed to revoke PIN code" },
        { status: 500 }
      )
    }

    // Determine pass status based on reason
    // - timeout/backup_used: Pass stays ACTIVE (user is using backup code)
    // - payment_failed/user_cancelled: Pass becomes CANCELLED
    const keepPassActive = reason === "timeout" || reason === "backup_used"

    if (!keepPassActive) {
      const { error: passError } = await supabase
        .schema("pass")
        .from("passes")
        .update({
          status: "cancelled",
        })
        .eq("id", payload.reservationId)

      if (passError) {
        console.error("[Rooms Webhook] Error updating pass status:", passError)
        // Don't fail - PIN was revoked successfully
      }
    }

    console.log(
      `[Rooms Webhook] PIN revoked for pass ${payload.reservationId}, reason: ${reason}, pass kept active: ${keepPassActive}`
    )

    return NextResponse.json({
      success: true,
      message: keepPassActive
        ? "PIN request cancelled (backup code in use)"
        : "PIN code revoked and pass cancelled",
      passId: payload.reservationId,
      reason: reason,
      passActive: keepPassActive,
    })
  } catch (error) {
    console.error("[Rooms Webhook] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET"
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasWebhookSecret = !!process.env.ROOMS_WEBHOOK_SECRET
  
  // Extract project ID from URL for verification
  const projectIdMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
  const projectId = projectIdMatch ? projectIdMatch[1] : "unknown"
  
  return NextResponse.json({
    status: "ok",
    endpoint: "Rooms PIN Webhook",
    version: "1.0.0",
    config: {
      supabaseProject: projectId,
      supabaseUrlSet: supabaseUrl !== "NOT_SET",
      serviceKeySet: hasServiceKey,
      webhookSecretSet: hasWebhookSecret,
    },
  })
}
