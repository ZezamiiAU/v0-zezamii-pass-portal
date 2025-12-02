/**
 * Pincode Settings Configuration
 *
 * This module provides utilities for managing PIN code length settings
 * at different levels (organization, site, pass type)
 */

export const PINCODE_CONSTRAINTS = {
  MIN_LENGTH: 4,
  MAX_LENGTH: 8,
  DEFAULT_LENGTH: 6,
} as const

export type PincodeLength = 4 | 5 | 6 | 7 | 8

/**
 * Validates that a pincode length is within acceptable bounds
 */
export function isValidPincodeLength(length: number): length is PincodeLength {
  return (
    Number.isInteger(length) && length >= PINCODE_CONSTRAINTS.MIN_LENGTH && length <= PINCODE_CONSTRAINTS.MAX_LENGTH
  )
}

/**
 * Gets the effective pincode length with fallback chain:
 * pass_type > site > default
 */
export function getEffectivePincodeLength(passTypeLength?: number | null, siteLength?: number | null): PincodeLength {
  // Try pass type setting first
  if (passTypeLength && isValidPincodeLength(passTypeLength)) {
    return passTypeLength
  }

  // Try site setting
  if (siteLength && isValidPincodeLength(siteLength)) {
    return siteLength
  }

  // Fall back to default
  return PINCODE_CONSTRAINTS.DEFAULT_LENGTH
}

/**
 * Generates a random PIN code of the specified length
 */
export function generatePincode(length: PincodeLength = 6): string {
  if (!isValidPincodeLength(length)) {
    throw new Error(
      `Invalid pincode length: ${length}. Must be between ${PINCODE_CONSTRAINTS.MIN_LENGTH} and ${PINCODE_CONSTRAINTS.MAX_LENGTH}`,
    )
  }

  let pincode = ""
  for (let i = 0; i < length; i++) {
    pincode += Math.floor(Math.random() * 10).toString()
  }

  return pincode
}

/**
 * Type definitions for pincode settings at different levels
 */
export interface SiteSettings {
  id: string
  site_id: string
  pincode_digit_length: number
  created_at: string
  updated_at: string
}

export interface PassTypeWithPincodeSettings {
  id: string
  pincode_digit_length?: number | null
  // ... other pass type fields
}

export interface EffectivePincodeSettings {
  pass_id: string
  pass_type_id: string
  site_id: string
  org_id: string
  effective_pincode_length: number
  pass_type_setting: number | null
  site_setting: number | null
}
