import { jsPDF } from "jspdf"

export interface PrintablePDFOptions {
  qrDataUrl: string
  deviceName: string
  locationPath: string
  slug: string
  orgSlug: string // Added org slug
  fullUrl: string
  orgName: string // Added org name
  supportEmail?: string
  size?: "letter" | "a4"
}

/**
 * Generate printable PDF with QR code
 */
export async function generatePrintablePDF(options: PrintablePDFOptions): Promise<Blob> {
  const { qrDataUrl, deviceName, locationPath, slug: _slug, orgSlug, fullUrl, orgName, supportEmail, size = "a4" } = options

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: size,
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const _pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20

  let yPos = margin

  // Add org logo if available
  if (orgSlug) {
    try {
      // Logo would need to be loaded as base64
      // For now, skip to avoid CORS issues
      yPos += 20
    } catch (error) {
      console.error("Failed to load org logo:", error)
      yPos += 20
    }
  } else {
    yPos += 10
  }

  // Add title
  pdf.setFontSize(24)
  pdf.setFont("helvetica", "bold")
  pdf.text(deviceName, pageWidth / 2, yPos, { align: "center" })
  yPos += 8

  pdf.setFontSize(14)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 100, 100)
  pdf.text(orgName, pageWidth / 2, yPos, { align: "center" })
  yPos += 10

  // Add location
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(120, 120, 120)
  pdf.text(locationPath, pageWidth / 2, yPos, { align: "center" })
  yPos += 20

  // Add QR code (centered, 120mm x 120mm)
  const qrSize = 120
  const qrX = (pageWidth - qrSize) / 2
  pdf.addImage(qrDataUrl, "PNG", qrX, yPos, qrSize, qrSize)
  yPos += qrSize + 15

  // Add instructions
  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")
  pdf.text("Scan to purchase access pass", pageWidth / 2, yPos, { align: "center" })
  yPos += 10

  // Add URL
  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 100, 100)
  pdf.text(fullUrl, pageWidth / 2, yPos, { align: "center" })
  yPos += 15

  // Add support info
  if (supportEmail) {
    pdf.setFontSize(9)
    pdf.text(`Support: ${supportEmail}`, pageWidth / 2, yPos, { align: "center" })
  }

  return pdf.output("blob")
}

/**
 * Download PDF file
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.download = `${filename}.pdf`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}
