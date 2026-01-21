import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Webhook payload from Rooms API
interface RoomsPinWebhookPayload {
  reservationId: string // Maps to pass_id in our system
  pinCode: string
  validFrom?: string // ISO timestamp
  validUntil?: string // ISO timestamp
  roomId?: string // Zezamii room ID
  status?: "active" | "revoked"
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
    const payload: RoomsPinWebhookPayload = await request.json()

    // Validate required fields
    if (!payload.reservationId || !payload.pinCode) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "reservationId and pinCode are required",
        },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServiceClient()

    // Update lock_codes table with the PIN
    // reservationId maps to pass_id
    const { data: lockCodeData, error: lockCodeError } = await supabase
      .from("lock_codes")
      .update({
        code: payload.pinCode,
        status: payload.status || "active",
        valid_from: payload.validFrom || null,
        valid_until: payload.validUntil || null,
        webhook_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("pass_id", payload.reservationId)
      .select()

    if (lockCodeError) {
      console.error("[Rooms Webhook] Error updating lock_codes:", lockCodeError)

      // If no matching lock_code exists, try to create one
      if (lockCodeError.code === "PGRST116") {
        const { error: insertError } = await supabase.from("lock_codes").insert({
          pass_id: payload.reservationId,
          code: payload.pinCode,
          status: payload.status || "active",
          valid_from: payload.validFrom || null,
          valid_until: payload.validUntil || null,
          webhook_received_at: new Date().toISOString(),
        })

        if (insertError) {
          console.error("[Rooms Webhook] Error inserting lock_code:", insertError)
          return NextResponse.json(
            { error: "Database Error", message: "Failed to store PIN code" },
            { status: 500 }
          )
        }
      } else {
        return NextResponse.json(
          { error: "Database Error", message: "Failed to update PIN code" },
          { status: 500 }
        )
      }
    }

    // Also update the pass status to active if it was pending
    const { error: passError } = await supabase
      .from("passes")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
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

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "Rooms PIN Webhook",
    version: "1.0.0",
  })
}
