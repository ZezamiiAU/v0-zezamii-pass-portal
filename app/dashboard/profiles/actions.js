"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * @typedef {Object} ActionResult
 * @property {boolean} success
 * @property {Object} [data]
 * @property {string} [error]
 */

/**
 * Create a new pass profile
 * @param {Object} formData
 * @returns {Promise<ActionResult>}
 */
export async function createProfile(formData) {
  try {
    const supabase = await createClient()

    // Validate required fields
    if (!formData.site_id || !formData.code || !formData.name || !formData.profile_type) {
      return {
        success: false,
        error: "Missing required fields: site_id, code, name, profile_type",
      }
    }

    // Prepare data with defaults
    const profileData = {
      site_id: formData.site_id,
      code: formData.code.toLowerCase().replace(/\s+/g, "_"),
      name: formData.name,
      profile_type: formData.profile_type,
      duration_minutes: formData.duration_minutes || null,
      duration_options: formData.duration_options || [],
      checkout_time: formData.checkout_time || null,
      entry_buffer_minutes: formData.entry_buffer_minutes || 0,
      exit_buffer_minutes: formData.exit_buffer_minutes || 0,
      reset_buffer_minutes: formData.reset_buffer_minutes || 0,
      required_inputs: formData.required_inputs || [],
      future_booking_enabled: formData.future_booking_enabled || false,
      availability_enforcement: formData.availability_enforcement || false,
    }

    const { data, error } = await supabase
      .from("pass_profiles")
      .insert(profileData)
      .select()
      .single()

    if (error) {
      console.error("[v0] Create profile error:", error)
      if (error.code === "23505") {
        return {
          success: false,
          error: `A profile with code "${formData.code}" already exists for this site.`,
        }
      }
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/profiles")
    return { success: true, data }
  } catch (err) {
    console.error("[v0] Unexpected error creating profile:", err)
    return { success: false, error: "An unexpected error occurred" }
  }
}

/**
 * Update an existing pass profile
 * @param {string} id
 * @param {Object} formData
 * @returns {Promise<ActionResult>}
 */
export async function updateProfile(id, formData) {
  try {
    const supabase = await createClient()

    if (!id) {
      return { success: false, error: "Profile ID is required" }
    }

    const updateData = {
      code: formData.code?.toLowerCase().replace(/\s+/g, "_"),
      name: formData.name,
      profile_type: formData.profile_type,
      duration_minutes: formData.duration_minutes || null,
      duration_options: formData.duration_options || [],
      checkout_time: formData.checkout_time || null,
      entry_buffer_minutes: formData.entry_buffer_minutes || 0,
      exit_buffer_minutes: formData.exit_buffer_minutes || 0,
      reset_buffer_minutes: formData.reset_buffer_minutes || 0,
      required_inputs: formData.required_inputs || [],
      future_booking_enabled: formData.future_booking_enabled || false,
      availability_enforcement: formData.availability_enforcement || false,
    }

    const { data, error } = await supabase
      .from("pass_profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Update profile error:", error)
      if (error.code === "23505") {
        return {
          success: false,
          error: `A profile with code "${formData.code}" already exists for this site.`,
        }
      }
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/profiles")
    revalidatePath(`/dashboard/profiles/${id}`)
    return { success: true, data }
  } catch (err) {
    console.error("[v0] Unexpected error updating profile:", err)
    return { success: false, error: "An unexpected error occurred" }
  }
}

/**
 * Delete a pass profile
 * @param {string} id
 * @returns {Promise<ActionResult>}
 */
export async function deleteProfile(id) {
  try {
    const supabase = await createClient()

    if (!id) {
      return { success: false, error: "Profile ID is required" }
    }

    const { error } = await supabase
      .from("pass_profiles")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] Delete profile error:", error)
      if (error.code === "23503") {
        return {
          success: false,
          error: "Cannot delete profile. It is assigned to one or more pass types.",
        }
      }
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard/profiles")
    return { success: true }
  } catch (err) {
    console.error("[v0] Unexpected error deleting profile:", err)
    return { success: false, error: "An unexpected error occurred" }
  }
}

/**
 * Get a single pass profile by ID
 * @param {string} id
 * @returns {Promise<ActionResult>}
 */
export async function getProfile(id) {
  try {
    const supabase = await createClient()

    if (!id || id === "new") {
      return { success: true, data: null }
    }

    const { data, error } = await supabase
      .from("pass_profiles")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("[v0] Get profile error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err) {
    console.error("[v0] Unexpected error getting profile:", err)
    return { success: false, error: "An unexpected error occurred" }
  }
}

/**
 * Get all sites for dropdown
 * @returns {Promise<ActionResult>}
 */
export async function getSites() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("sites")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("[v0] Get sites error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (err) {
    console.error("[v0] Unexpected error getting sites:", err)
    return { success: false, error: "An unexpected error occurred" }
  }
}
