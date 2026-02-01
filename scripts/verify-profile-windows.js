/**
 * Verification Script: Profile-driven Access Window Calculation
 * 
 * This script verifies that the new profile-driven access window calculation
 * produces identical results to the legacy hard-coded logic for Day and Camping passes.
 * 
 * Run manually or integrate into CI/CD to ensure no regressions.
 */

// Legacy calculation (hard-coded logic - for comparison only)
function legacyCalculateAccessWindow(passTypeName, startDate, durationHours, nights) {
  const now = startDate || new Date()
  
  const isCampingPass = /camp|overnight|night/i.test(passTypeName)
  const isDayPass = /day/i.test(passTypeName)
  
  if (isDayPass) {
    // Legacy: valid until 23:59 on the selected date
    const validFrom = now
    const validUntil = new Date(now)
    validUntil.setUTCHours(23, 59, 0, 0)
    return { validFrom, validUntil }
  }
  
  if (isCampingPass) {
    // Legacy: valid until 10:00 AM after N nights
    const validFrom = now
    const numNights = nights || 1
    const checkoutDate = new Date(now)
    checkoutDate.setUTCDate(checkoutDate.getUTCDate() + numNights)
    checkoutDate.setUTCHours(10, 0, 0, 0)
    return { validFrom, validUntil: checkoutDate }
  }
  
  // Default: use duration_hours
  const validFrom = now
  const validUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000)
  return { validFrom, validUntil }
}

// New profile-driven calculation (must match the implementation in payment-intents/route.js)
function profileCalculateAccessWindow({ bookedFrom, nights, durationHours, profile }) {
  const now = bookedFrom || new Date()
  
  const bufferBefore = profile?.entry_buffer_minutes || 0
  const bufferAfter = profile?.exit_buffer_minutes || 0
  
  if (!profile) {
    const validFrom = now
    const validUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000)
    return { validFrom, validUntil }
  }
  
  const profileCode = profile.code
  const checkoutTime = profile.checkout_time || "23:59:00"
  const [checkoutHour, checkoutMinute] = checkoutTime.split(":").map(Number)
  
  function setTimeOnDate(date, hour, minute) {
    const result = new Date(date)
    result.setUTCHours(hour, minute, 0, 0)
    return result
  }
  
  function addDays(date, days) {
    const result = new Date(date)
    result.setUTCDate(result.getUTCDate() + days)
    return result
  }

  let validFrom
  let validUntil
  
  switch (profileCode) {
    case "end_of_day":
      validFrom = now
      validUntil = setTimeOnDate(now, checkoutHour, checkoutMinute)
      break
      
    case "nights_checkout":
      validFrom = now
      const numNights = nights || 1
      const checkoutDate = addDays(now, numNights)
      validUntil = setTimeOnDate(checkoutDate, checkoutHour, checkoutMinute)
      break
      
    case "instant_access":
      validFrom = now
      const durationMins = profile.duration_minutes || (durationHours * 60)
      validUntil = new Date(now.getTime() + durationMins * 60 * 1000)
      break
      
    default:
      validFrom = now
      const defaultDuration = profile.duration_minutes || (durationHours * 60)
      validUntil = new Date(now.getTime() + defaultDuration * 60 * 1000)
      break
  }
  
  // Apply entry buffer (no exit buffer for end_of_day/nights_checkout)
  const finalValidFrom = new Date(validFrom.getTime() - bufferBefore * 60 * 1000)
  let finalValidUntil = validUntil
  if (profileCode !== "end_of_day" && profileCode !== "nights_checkout") {
    finalValidUntil = new Date(validUntil.getTime() + bufferAfter * 60 * 1000)
  }
  
  return { validFrom: finalValidFrom, validUntil: finalValidUntil }
}

// Test cases
const testCases = [
  {
    name: "Day Pass - Morning",
    passTypeName: "Day Pass",
    startDate: new Date("2025-02-03T09:00:00Z"),
    durationHours: 24,
    nights: null,
    profile: {
      code: "end_of_day",
      profile_type: "date_select",
      checkout_time: "23:59:00",
      entry_buffer_minutes: 0,
      exit_buffer_minutes: 0,
    },
  },
  {
    name: "Day Pass - Afternoon",
    passTypeName: "Day Pass",
    startDate: new Date("2025-02-03T14:30:00Z"),
    durationHours: 24,
    nights: null,
    profile: {
      code: "end_of_day",
      profile_type: "date_select",
      checkout_time: "23:59:00",
      entry_buffer_minutes: 0,
      exit_buffer_minutes: 0,
    },
  },
  {
    name: "Camping Pass - 1 Night",
    passTypeName: "Camping Pass",
    startDate: new Date("2025-02-03T12:00:00Z"),
    durationHours: 24,
    nights: 1,
    profile: {
      code: "nights_checkout",
      profile_type: "date_select",
      checkout_time: "10:00:00",
      entry_buffer_minutes: 0,
      exit_buffer_minutes: 0,
    },
  },
  {
    name: "Camping Pass - 3 Nights",
    passTypeName: "Overnight Stay",
    startDate: new Date("2025-02-03T15:00:00Z"),
    durationHours: 72,
    nights: 3,
    profile: {
      code: "nights_checkout",
      profile_type: "date_select",
      checkout_time: "10:00:00",
      entry_buffer_minutes: 0,
      exit_buffer_minutes: 0,
    },
  },
]

// Run verification
console.log("=== Profile-driven Access Window Verification ===\n")

let allPassed = true

testCases.forEach((tc) => {
  const legacy = legacyCalculateAccessWindow(
    tc.passTypeName,
    tc.startDate,
    tc.durationHours,
    tc.nights
  )
  
  const profileBased = profileCalculateAccessWindow({
    bookedFrom: tc.startDate,
    nights: tc.nights,
    durationHours: tc.durationHours,
    profile: tc.profile,
  })
  
  // Compare (allowing for buffer differences)
  const validFromMatch = legacy.validFrom.getTime() === profileBased.validFrom.getTime()
  const validUntilMatch = legacy.validUntil.getTime() === profileBased.validUntil.getTime()
  const passed = validFromMatch && validUntilMatch
  
  if (!passed) allPassed = false
  
  console.log(`Test: ${tc.name}`)
  console.log(`  Pass Type: ${tc.passTypeName}`)
  console.log(`  Start: ${tc.startDate.toISOString()}`)
  console.log(`  Nights: ${tc.nights || "N/A"}`)
  console.log(`  Profile: ${tc.profile.code}`)
  console.log(`  `)
  console.log(`  Legacy:`)
  console.log(`    valid_from:  ${legacy.validFrom.toISOString()}`)
  console.log(`    valid_until: ${legacy.validUntil.toISOString()}`)
  console.log(`  `)
  console.log(`  Profile-based:`)
  console.log(`    valid_from:  ${profileBased.validFrom.toISOString()}`)
  console.log(`    valid_until: ${profileBased.validUntil.toISOString()}`)
  console.log(`  `)
  console.log(`  Result: ${passed ? "PASS" : "FAIL"}`)
  if (!validFromMatch) console.log(`    - valid_from mismatch`)
  if (!validUntilMatch) console.log(`    - valid_until mismatch`)
  console.log(`\n${"=".repeat(50)}\n`)
})

console.log(`\nOverall: ${allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`)

// Export for potential module usage
if (typeof module !== "undefined") {
  module.exports = {
    legacyCalculateAccessWindow,
    profileCalculateAccessWindow,
    testCases,
  }
}
