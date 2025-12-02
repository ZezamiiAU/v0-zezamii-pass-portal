/**
 * Generates a valid UUID v4 format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 * This matches PostgreSQL UUID type requirements (8-4-4-4-12 hex digits)
 */
export function generateId(): string {
  const randomHex = () => Math.floor(Math.random() * 16).toString(16)
  const randomSegment = (length: number) => Array.from({ length }, randomHex).join("")

  // Standard UUID v4 format: 8-4-4-4-12
  return `${randomSegment(8)}-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(12)}`
}

/**
 * Check if an ID is a valid UUID format
 */
export function isValidId(id: any): boolean {
  if (typeof id !== "string") return false
  // Standard UUID format: 8-4-4-4-12 hex characters
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return pattern.test(id)
}

/**
 * Ensure an ID is valid, generate one if missing or invalid
 */
export function ensureValidId(id: any): string {
  return isValidId(id) ? id : generateId()
}
