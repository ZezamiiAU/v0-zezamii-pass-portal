"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import QRCodeStyling from "qr-code-styling"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Copy, Trash2, QrCode, MapPin, Hash, Lock } from "lucide-react"
import { deleteQRPass } from "./actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface QRPass {
  pass_id: string
  qr_instance_id: string
  pass_label: string
  is_active: boolean
  created_at: string
  qr_url: string | null
}

interface DeviceWithPasses {
  device_id: string
  device_name: string
  device_slug: string | null
  device_custom_name: string | null
  device_custom_description: string | null
  device_custom_logo_url: string | null
  category: string
  slug_is_active: boolean
  device_status: string
  lock_id: number | null // Changed from string to number since lock_id is INTEGER in database
  org_id: string
  org_name: string
  org_slug: string | null
  site_id: string
  site_name: string
  site_slug: string | null // Added site_slug for URL generation
  building_id: string
  building_name: string
  floor_id: string
  floor_name: string
  floor_level: number
  device_created_at: string
  device_updated_at: string
  qr_passes: QRPass[]
  pass_count: number
}

interface QRGeneratorClientProps {
  devices: DeviceWithPasses[]
  sites: { id: string; name: string }[]
}

export function QRGeneratorClient({ devices, sites }: QRGeneratorClientProps) {
  const safeDevices = Array.isArray(devices) ? devices : []
  const safeSites = Array.isArray(sites) ? sites : []

  const organisations = useMemo(() => {
    const uniqueOrgs = new Map<string, { id: string; name: string }>()
    safeDevices.forEach((device) => {
      if (device.org_id && device.org_name) {
        uniqueOrgs.set(device.org_id, { id: device.org_id, name: device.org_name })
      }
    })
    return Array.from(uniqueOrgs.values())
  }, [safeDevices])

  const [selectedDevice, setSelectedDevice] = useState<DeviceWithPasses | null>(null)
  const [selectedPass, setSelectedPass] = useState<QRPass | null>(null)
  const [qrCode, setQRCode] = useState<QRCodeStyling | null>(null)
  const [qrSettings, setQRSettings] = useState({
    size: 500,
    errorCorrection: "M" as "L" | "M" | "Q" | "H",
    includeLogo: false,
  })
  const [selectedOrgId, setSelectedOrgId] = useState("")
  const [selectedSiteId, setSelectedSiteId] = useState("all")
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedDevice && selectedDevice.qr_passes && selectedDevice.qr_passes.length > 0) {
      setSelectedPass(selectedDevice.qr_passes[0])
    } else {
      setSelectedPass(null)
    }
  }, [selectedDevice])

  const filteredDevices = selectedOrgId
    ? safeDevices.filter(
        (d) =>
          d.org_id === selectedOrgId && (!selectedSiteId || selectedSiteId === "all" || d.site_id === selectedSiteId),
      )
    : []

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setTimeout(() => {}, 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const selectedSite = safeSites.find((s) => s.id === selectedSiteId)

  const generateQRCode = (pass: QRPass) => {
    const qr = new QRCodeStyling({
      width: qrSettings.size,
      height: qrSettings.size,
      type: "svg",
      data: pass.qr_url || "",
      errorCorrectionLevel: qrSettings.errorCorrection,
      margin: 5,
      dotsOptions: {
        color: "#000000", // Changed from blue (#4285F4) to black
      },
      backgroundOptions: {
        color: "#FFFFFF",
      },
      logo: qrSettings.includeLogo ? "path/to/logo.png" : undefined,
      logoWidth: 50,
      logoHeight: 50,
    })
    setQRCode(qr)
  }

  useEffect(() => {
    if (selectedPass) {
      generateQRCode(selectedPass)
    }
  }, [selectedPass, qrSettings])

  useEffect(() => {
    if (qrCode && qrRef.current) {
      qrRef.current.innerHTML = ""
      qrCode.append(qrRef.current)
    }
  }, [qrCode])

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      {/* Left Sidebar - Device Selection */}
      <div className="w-80 space-y-4 overflow-y-auto border-r px-6 pt-4">
        <div>
          <h2 className="text-lg font-semibold mb-4">Select Device</h2>

          <div className="space-y-3">
            <div>
              <label htmlFor="search">Search</label>
              <Input id="search" placeholder="Device name or slug..." value="" onChange={(e) => {}} />
            </div>

            <div>
              <label htmlFor="org-filter">Organisation</label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger id="org-filter">
                  <SelectValue placeholder="Select an organisation" />
                </SelectTrigger>
                <SelectContent>
                  {organisations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="site-filter">Site</label>
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger id="site-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {safeSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {!selectedOrgId && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Please select an organisation to view devices
            </p>
          )}
          {filteredDevices.length === 0 && selectedOrgId !== "" && (
            <p className="text-sm text-muted-foreground text-center py-4">No devices found</p>
          )}
          {filteredDevices.map((device) => (
            <Button
              key={device.device_id}
              variant={selectedDevice?.device_id === device.device_id ? "default" : "ghost"}
              className="w-full justify-start text-left h-auto py-3"
              onClick={() => setSelectedDevice(device)}
            >
              <div className="flex flex-col items-start gap-1 w-full">
                <span className="font-medium text-sm">
                  {device.device_custom_name || device.device_name || device.category}
                </span>
                <span className="text-xs text-muted-foreground">
                  {device.floor_name} {device.building_name && `• ${device.building_name}`}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Middle Panel - Device Details and QR Passes */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {!selectedDevice && (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center py-12">
              <div className="size-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Select a Device</h3>
              <p className="text-sm text-muted-foreground">Choose a device from the left to view its QR passes</p>
            </CardContent>
          </Card>
        )}

        {selectedDevice && (
          <>
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-xl">
                  {selectedDevice.device_custom_name || selectedDevice.device_name || selectedDevice.category}
                </CardTitle>
                <CardDescription>
                  {selectedDevice.org_name} / {selectedDevice.site_name} / {selectedDevice.floor_name || ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="p-2 rounded-md bg-background">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">Device Slug</div>
                      <code className="text-sm font-mono truncate block">
                        {selectedDevice.device_slug || "Not set"}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="p-2 rounded-md bg-background">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">Org Slug</div>
                      <code className="text-sm font-mono truncate block">{selectedDevice.org_slug || "Not set"}</code>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="p-2 rounded-md bg-background">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">Site ID</div>
                      <code className="text-xs font-mono truncate block">{selectedDevice.site_id}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => copyToClipboard(selectedDevice.site_id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 py-3 border-t">
                    <div className="p-2 rounded-md bg-background">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">Lock ID</div>
                      <code className="text-sm font-mono truncate block">
                        {selectedDevice.lock_id != null ? selectedDevice.lock_id.toString() : "Not set"}
                      </code>
                    </div>
                    {selectedDevice.lock_id != null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => copyToClipboard(selectedDevice.lock_id!.toString())}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>QR Passes ({selectedDevice.qr_passes.length})</CardTitle>
                    <CardDescription>Select a pass to generate its QR code</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const passes = Array.isArray(selectedDevice.qr_passes) ? selectedDevice.qr_passes : []

                  if (passes.length === 0) {
                    return (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        <p>No QR passes available for this device.</p>
                        <p className="text-xs mt-2">
                          Passes are automatically created when devices are imported with slugs.
                        </p>
                      </div>
                    )
                  }

                  return passes.map((pass) => {
                    const fullUrl =
                      pass.qr_url ||
                      `https://zezamii-pass.vercel.app/p/${selectedDevice.org_slug}/${selectedDevice.site_slug}/${selectedDevice.device_slug}?qr=${pass.qr_instance_id}&source=qr`

                    return (
                      <div
                        key={pass.pass_id}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                          selectedPass?.pass_id === pass.pass_id
                            ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedPass(pass)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              className={`p-2 rounded-md ${
                                selectedPass?.pass_id === pass.pass_id ? "bg-primary/10" : "bg-muted"
                              }`}
                            >
                              <QrCode
                                className={`h-4 w-4 ${
                                  selectedPass?.pass_id === pass.pass_id ? "text-primary" : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <span className="font-semibold text-base">{pass.pass_label}</span>
                            {pass.is_active ? (
                              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                Active
                              </span>
                            ) : (
                              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteQRPass(pass.pass_id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-start gap-2 mt-3">
                          <div className="text-xs text-muted-foreground font-mono break-all flex-1 bg-muted/50 p-2 rounded">
                            {fullUrl}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyToClipboard(fullUrl)
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border/50">
                          Created{" "}
                          {new Date(pass.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          {new Date(pass.created_at).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
              </CardContent>
            </Card>

            {selectedPass && (
              <Card>
                <CardHeader>
                  <CardTitle>QR Code Preview</CardTitle>
                  <CardDescription>Scan this code to open the pass purchase page</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <div ref={qrRef} className="flex justify-center" />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (qrCode) {
                          qrCode.download({
                            name: `${selectedDevice.device_slug}-${selectedPass.pass_label}.svg`,
                            extension: "svg",
                          })
                        }
                      }}
                    >
                      Download SVG
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (qrCode) {
                          qrCode.download({
                            name: `${selectedDevice.device_slug}-${selectedPass.pass_label}.png`,
                            extension: "png",
                          })
                        }
                      }}
                    >
                      Download PNG
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Right Sidebar - Settings */}
      <div className="w-64 space-y-4 p-6 border-l">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-size">Size</Label>
            <Slider
              defaultValue={[qrSettings.size]}
              max={800}
              min={200}
              step={100}
              onValueChange={(v) => {
                setQRSettings((prev) => ({ ...prev, size: v[0] }))
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="error-correction">Error Correction</Label>
            <Select
              value={qrSettings.errorCorrection}
              onValueChange={(v: any) => {
                setQRSettings((prev) => ({ ...prev, errorCorrection: v }))
              }}
            >
              <SelectTrigger id="error-correction">
                <SelectValue placeholder="Select error correction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Low (7%)</SelectItem>
                <SelectItem value="M">Medium (15%)</SelectItem>
                <SelectItem value="Q">Quartile (25%)</SelectItem>
                <SelectItem value="H">High (30%)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Higher levels allow more damage/obstruction to QR code</p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="include-logo">Include Logo</Label>
            <input
              id="include-logo"
              type="checkbox"
              checked={qrSettings.includeLogo}
              onChange={(e) => setQRSettings((prev) => ({ ...prev, includeLogo: e.target.checked }))}
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground">Logo overlay coming in future update</p>
        </div>
      </div>
    </div>
  )
}
