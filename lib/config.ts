/**
 * Application Configuration
 * Centralizes environment variables and configuration values
 */

export const config = {
  /**
   * PWA Base URL (Production)
   * Used for generating pass URLs, QR codes, and deep links
   */
  pwaBaseUrl: process.env.NEXT_PUBLIC_PWA_BASE_URL || "https://pass.zezamii.com",

  /**
   * PWA Preview URL (Development/Testing)
   * Used for testing pass URLs before production deployment
   */
  pwaPreviewUrl: process.env.NEXT_PUBLIC_PWA_PREVIEW_URL || "https://v0-zezamiipass-g8z0ferbb-zezamii.vercel.app",

  /**
   * Supabase Configuration
   */
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },

  /**
   * Application Environment
   */
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
} as const

/**
 * Generate a pass URL for a given organisation, site, and device slug
 * @param orgSlug - The organisation slug
 * @param siteSlug - The site slug
 * @param deviceSlug - The device slug
 * @param qrInstanceId - Optional QR instance ID for analytics tracking
 * @returns Full URL to access the pass
 */
export function generatePassUrl(orgSlug: string, siteSlug: string, deviceSlug: string, qrInstanceId?: string): string {
  const baseUrl = `${config.pwaBaseUrl}/p/${orgSlug}/${siteSlug}/${deviceSlug}`
  if (qrInstanceId) {
    return `${baseUrl}?qr=${qrInstanceId}&source=qr`
  }
  return baseUrl
}

/**
 * Generate a preview pass URL for testing
 * @param orgSlug - The organisation slug
 * @param siteSlug - The site slug
 * @param deviceSlug - The device slug
 * @param qrInstanceId - Optional QR instance ID for analytics tracking
 * @returns Full preview URL to access the pass
 */
export function generatePreviewPassUrl(orgSlug: string, siteSlug: string, deviceSlug: string, qrInstanceId?: string): string {
  const baseUrl = `${config.pwaPreviewUrl}/p/${orgSlug}/${siteSlug}/${deviceSlug}`
  if (qrInstanceId) {
    return `${baseUrl}?qr=${qrInstanceId}&source=qr`
  }
  return baseUrl
}

/**
 * Validate if URL is a valid PWA domain
 */
export function isValidPwaDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
  } catch {
    return false
  }
}
