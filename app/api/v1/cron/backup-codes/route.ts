import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Reserve goals per device per category
const RESERVE_GOALS: Record<string, { count: number; validityHours: number }> = {
  day: { count: 30, validityHours: 24 },
  camping_3d: { count: 10, validityHours: 72 },
  camping_7d: { count: 5, validityHours: 168 },
  camping_14d: { count: 5, validityHours: 336 },
}

const HARDWARE_LIMIT = 150 // Max codes per lock

// Supabase service client
function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Validate cron secret (for Vercel Cron)
function validateCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true
  }
  // Also allow Vercel's cron header
  if (request.headers.get("x-vercel-cron") === "true") {
    return true
  }
  return false
}

// Daily Backup Code Pool Management Cron
// Runs at 00:05 AEST daily
// Phase 1: Cleanup - Remove expired codes from Rooms
// Phase 2: Replenish - Create new codes to meet reserve goals
export async function GET(request: Request) {
  // Validate cron authorization
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const results = {
    phase1_cleanup: { processed: 0, errors: [] as string[] },
    phase2_replenish: { created: 0, errors: [] as string[] },
  }

  try {
    // PHASE 1: Cleanup expired codes
    const now = new Date().toISOString()

    // Find expired codes that need removal from Rooms
    const { data: expiredCodes, error: expiredError } = await supabase
      .from("backup_code_pool")
      .select("id, device_id, code, rooms_ref")
      .lt("expires_at", now)
      .in("status", ["available", "assigned"])

    if (expiredError) {
      results.phase1_cleanup.errors.push(`Query error: ${expiredError.message}`)
    } else if (expiredCodes?.length) {
      for (const code of expiredCodes) {
        try {
          // TODO: Call Rooms API to delete code
          // Mark as pending_removal
          await supabase
            .from("backup_code_pool")
            .update({ status: "pending_removal", updated_at: now })
            .eq("id", code.id)

          results.phase1_cleanup.processed++
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error"
          results.phase1_cleanup.errors.push(`Code ${code.id}: ${message}`)
        }
      }
    }

    // PHASE 2: Replenish backup code pools
    const { data: devices, error: devicesError } = await supabase
      .from("devices")
      .select("id, site_id, name")
      .eq("status", "active")
      .eq("type", "lock")

    if (devicesError) {
      results.phase2_replenish.errors.push(`Devices query error: ${devicesError.message}`)
    } else if (devices?.length) {
      for (const device of devices) {
        try {
          await replenishDevicePool(supabase, device, results)
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error"
          results.phase2_replenish.errors.push(`Device ${device.id}: ${message}`)
        }
      }
    }

    console.log("[Backup Code Cron] Completed:", results)

    return NextResponse.json({
      success: true,
      timestamp: now,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Backup Code Cron] Fatal error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    )
  }
}

// Replenish backup codes for a single device
async function replenishDevicePool(
  supabase: ReturnType<typeof createClient>,
  device: { id: string; site_id: string; name: string },
  results: { phase2_replenish: { created: number; errors: string[] } }
) {
  const now = new Date()

  // Count current available codes by category
  const { data: currentCounts } = await supabase
    .from("backup_code_pool")
    .select("category")
    .eq("device_id", device.id)
    .eq("status", "available")
    .gte("expires_at", now.toISOString())

  // Count by category
  const countsByCategory: Record<string, number> = {}
  for (const row of currentCounts || []) {
    countsByCategory[row.category] = (countsByCategory[row.category] || 0) + 1
  }

  // Count total active codes (for hardware limit)
  const { count: totalActive } = await supabase
    .from("backup_code_pool")
    .select("*", { count: "exact", head: true })
    .eq("device_id", device.id)
    .in("status", ["available", "assigned"])

  let availableSlots = HARDWARE_LIMIT - (totalActive || 0)

  // Replenish each category
  for (const [category, config] of Object.entries(RESERVE_GOALS)) {
    const currentCount = countsByCategory[category] || 0
    const needed = config.count - currentCount

    if (needed > 0 && availableSlots > 0) {
      const toCreate = Math.min(needed, availableSlots)

      for (let i = 0; i < toCreate; i++) {
        try {
          // Calculate validity window
          const startsAt = now
          const expiresAt = new Date(now.getTime() + config.validityHours * 60 * 60 * 1000)

          // TODO: Call Rooms API to create code and get the actual code + rooms_ref
          const tempCode = `TEMP${Math.random().toString().slice(2, 7)}`

          // Insert into pool
          await supabase
            .from("backup_code_pool")
            .insert({
              site_id: device.site_id,
              device_id: device.id,
              code: tempCode,
              category,
              validity_hours: config.validityHours,
              status: "available",
              starts_at: startsAt.toISOString(),
              expires_at: expiresAt.toISOString(),
              rooms_ref: null,
              rooms_synced_at: null,
            })

          results.phase2_replenish.created++
          availableSlots--
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error"
          results.phase2_replenish.errors.push(
            `Device ${device.id} category ${category}: ${message}`
          )
        }
      }
    }
  }
}

// TODO: Rooms API Integration (shape TBD)
// callRoomsCreateCode(deviceId, startsAt, expiresAt) - Creates backup code, returns pinCode and codeId
// callRoomsDeleteCode(deviceId, roomsRef) - Deletes backup code from Rooms
