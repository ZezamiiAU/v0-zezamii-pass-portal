import QRCode from "qrcode"

export interface QRCodeOptions {
  data: string
  size?: number
  errorCorrectionLevel?: "low" | "medium" | "quartile" | "high"
  color?: {
    dark?: string
    light?: string
  }
}

/**
 * Generate QR code as data URL (PNG)
 */
export async function generateQRCodeDataURL(options: QRCodeOptions): Promise<string> {
  const { data, size = 500, errorCorrectionLevel = "high", color } = options

  return QRCode.toDataURL(data, {
    width: size,
    margin: 2,
    errorCorrectionLevel:
      errorCorrectionLevel === "low"
        ? "L"
        : errorCorrectionLevel === "medium"
          ? "M"
          : errorCorrectionLevel === "quartile"
            ? "Q"
            : "H",
    color: {
      dark: color?.dark || "#000000",
      light: color?.light || "#FFFFFF",
    },
  })
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(options: QRCodeOptions): Promise<string> {
  const { data, size = 500, errorCorrectionLevel = "high", color } = options

  return QRCode.toString(data, {
    type: "svg",
    width: size,
    margin: 2,
    errorCorrectionLevel:
      errorCorrectionLevel === "low"
        ? "L"
        : errorCorrectionLevel === "medium"
          ? "M"
          : errorCorrectionLevel === "quartile"
            ? "Q"
            : "H",
    color: {
      dark: color?.dark || "#000000",
      light: color?.light || "#FFFFFF",
    },
  })
}

/**
 * Download QR code as PNG file
 */
export async function downloadQRCodePNG(dataUrl: string, filename: string) {
  const link = document.createElement("a")
  link.download = `${filename}.png`
  link.href = dataUrl
  link.click()
}

/**
 * Download QR code as SVG file
 */
export async function downloadQRCodeSVG(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.download = `${filename}.svg`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}
