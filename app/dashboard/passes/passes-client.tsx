"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, ExternalLink, QrCode, Filter } from "lucide-react"

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
  org_id: string
  org_name: string
  org_slug: string | null
  site_id: string
  site_name: string
  site_slug: string | null
  building_name: string
  floor_name: string
  qr_passes: QRPass[]
  pass_count: number
}

interface PassWithDevice extends QRPass {
  device_name: string
  device_slug: string | null
  org_name: string
  org_slug: string | null
  site_name: string
  site_slug: string | null
  device_id: string
}

interface PassesClientProps {
  devices: DeviceWithPasses[]
}

export function PassesClient({ devices }: PassesClientProps) {
  const safeDevices = Array.isArray(devices) ? devices : []

  // Flatten all passes with device context
  const allPasses = useMemo<PassWithDevice[]>(() => {
    return safeDevices.flatMap((device) =>
      (device.qr_passes || []).map((pass) => ({
        ...pass,
        device_name: device.device_custom_name || device.device_name,
        device_slug: device.device_slug,
        org_name: device.org_name,
        org_slug: device.org_slug,
        site_name: device.site_name,
        site_slug: device.site_slug,
        device_id: device.device_id,
      })),
    )
  }, [safeDevices])

  // Extract unique organizations
  const organizations = useMemo(() => {
    const uniqueOrgs = new Map<string, { id: string; name: string }>()
    safeDevices.forEach((device) => {
      if (device.org_id && device.org_name) {
        uniqueOrgs.set(device.org_id, { id: device.org_id, name: device.org_name })
      }
    })
    return Array.from(uniqueOrgs.values())
  }, [safeDevices])

  // Extract unique sites
  const sites = useMemo(() => {
    const uniqueSites = new Map<string, { id: string; name: string }>()
    safeDevices.forEach((device) => {
      if (device.site_id && device.site_name) {
        uniqueSites.set(device.site_id, { id: device.site_id, name: device.site_name })
      }
    })
    return Array.from(uniqueSites.values())
  }, [safeDevices])

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrg, setSelectedOrg] = useState<string>("all")
  const [selectedSite, setSelectedSite] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Filter passes
  const filteredPasses = useMemo(() => {
    return allPasses.filter((pass) => {
      const matchesSearch =
        searchQuery === "" ||
        pass.pass_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pass.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pass.qr_instance_id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesOrg =
        selectedOrg === "all" || pass.org_name === organizations.find((o) => o.id === selectedOrg)?.name

      const matchesSite = selectedSite === "all" || pass.site_name === sites.find((s) => s.id === selectedSite)?.name

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && pass.is_active) ||
        (statusFilter === "inactive" && !pass.is_active)

      return matchesSearch && matchesOrg && matchesSite && matchesStatus
    })
  }, [allPasses, searchQuery, selectedOrg, selectedSite, statusFilter, organizations, sites])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const stats = useMemo(() => {
    return {
      total: allPasses.length,
      active: allPasses.filter((p) => p.is_active).length,
      inactive: allPasses.filter((p) => !p.is_active).length,
      devices: new Set(allPasses.map((p) => p.device_id)).size,
    }
  }, [allPasses])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">QR Passes</h1>
        <p className="text-muted-foreground">Manage all QR passes across your devices</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Passes</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <div className="h-2 w-2 rounded-full bg-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.devices}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search passes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Site</label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passes Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Passes ({filteredPasses.length})</CardTitle>
              <CardDescription>
                {filteredPasses.length === allPasses.length
                  ? "Showing all passes"
                  : `Filtered from ${allPasses.length} total passes`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>QR URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No passes found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPasses.map((pass) => {
                    const fullUrl =
                      pass.qr_url ||
                      `https://zezamii-pass.vercel.app/p/${pass.org_slug}/${pass.site_slug}/${pass.device_slug}?qr=${pass.qr_instance_id}&source=qr`

                    return (
                      <TableRow key={pass.pass_id}>
                        <TableCell className="font-medium">{pass.pass_label}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{pass.device_name}</span>
                            {pass.device_slug && (
                              <code className="text-xs text-muted-foreground">{pass.device_slug}</code>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{pass.org_name}</TableCell>
                        <TableCell>{pass.site_name}</TableCell>
                        <TableCell>
                          {pass.is_active ? (
                            <Badge variant="default" className="bg-green-500">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(pass.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 max-w-xs">
                            <code className="text-xs truncate flex-1">{fullUrl}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(fullUrl)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => window.open(fullUrl, "_blank")}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
