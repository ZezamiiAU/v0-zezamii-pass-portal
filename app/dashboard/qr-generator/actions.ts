"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteQRPass(passId: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.schema("core").from("qr_passes").delete().eq("id", passId)

    if (error) {
      console.error("[v0] Error deleting QR pass:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/qr-generator")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error in deleteQRPass action:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function createQRPass(deviceId: string, passLabel = "Default Pass") {
  try {
    const supabase = await createClient()

    // Insert new QR pass
    const { data, error } = await supabase
      .schema("core")
      .from("qr_passes")
      .insert({
        device_id: deviceId,
        pass_label: passLabel,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating QR pass:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/qr-generator")

    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error in createQRPass action:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
