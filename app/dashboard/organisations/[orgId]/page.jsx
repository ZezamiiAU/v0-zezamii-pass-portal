"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  ArrowLeft,
  Building2,
  Palette,
  Settings,
  Upload,
  X,
  ImageIcon,
  AlertCircle,
  Loader2,
  Eye,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const PASS_API_URL = process.env.NEXT_PUBLIC_PASS_API_URL || "https://pass.zezamii.com"

export default function OrganisationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const orgId = params.orgId

  const [organisation, setOrganisation] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // Branding state
  const [logoUrl, setLogoUrl] = useState(null)
  const [heroImageUrl, setHeroImageUrl] = useState(null)
  const [primaryColor, setPrimaryColor] = useState("#001F3F")
  const [secondaryColor, setSecondaryColor] = useState("#d4af37")
  const [hasChanges, setHasChanges] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (orgId) {
      fetchOrganisation()
    }
  }, [orgId])

  async function fetchOrganisation() {
    try {
      const { data, error } = await supabase
        .schema("core")
        .from("organisations")
        .select("id, name, slug, brand_settings")
        .eq("id", orgId)
        .single()

      if (error) throw error

      setOrganisation(data)
      
      // Set branding state from data
      if (data.brand_settings) {
        setLogoUrl(data.brand_settings.logo_url || null)
        setHeroImageUrl(data.brand_settings.hero_image_url || null)
        setPrimaryColor(data.brand_settings.primary_color || "#001F3F")
        setSecondaryColor(data.brand_settings.secondary_color || "#d4af37")
      }
    } catch (err) {
      console.error("[v0] Error fetching organisation:", err)
      setError("Failed to load organisation details.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveColors() {
    setIsSaving(true)
    try {
      const res = await fetch(`${PASS_API_URL}/api/v1/orgs/${orgId}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save brand settings")
      }

      const data = await res.json()
      
      // Update local state with response
      if (data.brandSettings) {
        setLogoUrl(data.brandSettings.logo_url || null)
        setHeroImageUrl(data.brandSettings.hero_image_url || null)
        setPrimaryColor(data.brandSettings.primary_color || "#001F3F")
        setSecondaryColor(data.brandSettings.secondary_color || "#d4af37")
      }
      
      setHasChanges(false)
      toast({ title: "Brand settings saved" })
    } catch (err) {
      console.error("[v0] Error saving brand settings:", err)
      toast({ 
        title: "Failed to save settings", 
        description: err.message,
        variant: "destructive" 
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleColorChange(type, value) {
    if (type === "primary") {
      setPrimaryColor(value)
    } else {
      setSecondaryColor(value)
    }
    setHasChanges(true)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (error || !organisation) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Organisation not found"}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/organisations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Organisations
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Toaster />
      
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/organisations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{organisation.name}</h1>
          <p className="text-muted-foreground mt-1">{organisation.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <Building2 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="mr-2 h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Organisation Details</CardTitle>
              <CardDescription>Basic information about this organisation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{organisation.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Slug</Label>
                  <p className="font-mono text-sm">{organisation.slug}</p>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-muted-foreground">ID</Label>
                  <p className="font-mono text-sm text-muted-foreground">{organisation.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>
                Displays on the checkout page header. Recommended: 200x200px, Max 5MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploader
                orgId={orgId}
                type="logo"
                currentUrl={logoUrl}
                onSuccess={(url) => {
                  setLogoUrl(url)
                  toast({ title: url ? "Logo uploaded" : "Logo removed" })
                }}
                onError={(msg) => toast({ title: msg, variant: "destructive" })}
              />
            </CardContent>
          </Card>

          {/* Hero Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Hero Image</CardTitle>
              <CardDescription>
                Displays as a banner on the checkout page. Recommended: 1200x400px, Max 5MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploader
                orgId={orgId}
                type="hero"
                currentUrl={heroImageUrl}
                onSuccess={(url) => {
                  setHeroImageUrl(url)
                  toast({ title: url ? "Hero image uploaded" : "Hero image removed" })
                }}
                onError={(msg) => toast({ title: msg, variant: "destructive" })}
              />
            </CardContent>
          </Card>

          {/* Brand Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
              <CardDescription>
                Colors used throughout the checkout experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <ColorPicker
                  label="Primary Color"
                  value={primaryColor}
                  onChange={(v) => handleColorChange("primary", v)}
                  description="Used for buttons, links, and accents"
                />
                <ColorPicker
                  label="Secondary Color"
                  value={secondaryColor}
                  onChange={(v) => handleColorChange("secondary", v)}
                  description="Used for highlights and secondary elements"
                />
              </div>

              {/* Color Preview */}
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-3">Preview</p>
                <div className="flex items-center gap-4">
                  <div
                    className="h-12 w-12 rounded-lg shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div
                    className="h-12 w-12 rounded-lg shadow-sm"
                    style={{ backgroundColor: secondaryColor }}
                  />
                  <div className="flex-1">
                    <Button
                      size="sm"
                      style={{ backgroundColor: primaryColor }}
                      className="mr-2"
                    >
                      Primary Button
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      style={{ borderColor: secondaryColor, color: secondaryColor }}
                    >
                      Secondary
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checkout Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Checkout Preview</CardTitle>
              <CardDescription>
                Preview how your branding will appear on the checkout page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                {/* Mini mockup of checkout */}
                <div className="bg-muted/30 p-4">
                  {/* Header */}
                  <div 
                    className="flex items-center gap-3 p-3 rounded-t-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded bg-white p-0.5" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <span className="text-white font-medium">{organisation.name}</span>
                  </div>
                  
                  {/* Hero */}
                  {heroImageUrl ? (
                    <img 
                      src={heroImageUrl} 
                      alt="Hero" 
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-24 flex items-center justify-center"
                      style={{ backgroundColor: `${secondaryColor}30` }}
                    >
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  
                  {/* Content mockup */}
                  <div className="bg-background p-4 space-y-3 rounded-b-lg">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-4 w-1/2 rounded bg-muted" />
                    <Button 
                      size="sm" 
                      className="w-full mt-4"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="sticky bottom-4 flex justify-end">
            <Button
              onClick={handleSaveColors}
              disabled={!hasChanges || isSaving}
              className="shadow-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Additional organisation settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Additional settings will be available here in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Image Uploader Component
function ImageUploader({ orgId, type, currentUrl, onSuccess, onError }) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleUpload = async (file) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      onError("Invalid file type. Please upload JPEG, PNG, WebP, SVG, or GIF.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("File size must be under 5MB.")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)

      const res = await fetch(`${PASS_API_URL}/api/v1/orgs/${orgId}/branding`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await res.json()
      onSuccess(data.url)
    } catch (err) {
      console.error("[v0] Upload error:", err)
      onError(err.message || "Failed to upload image. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = async () => {
    setIsUploading(true)
    try {
      const res = await fetch(`${PASS_API_URL}/api/v1/orgs/${orgId}/branding?type=${type}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Remove failed")
      }
      onSuccess(null)
    } catch (err) {
      console.error("[v0] Remove error:", err)
      onError(err.message || "Failed to remove image.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const inputId = `file-${type}-${orgId}`

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
          ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={type}
            className={type === "logo" ? "h-24 w-24 mx-auto object-contain" : "h-32 w-full object-cover rounded"}
          />
        ) : (
          <div className="py-4">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Drag & drop or click to upload
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
        {currentUrl && (
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isUploading}>
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        )}
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />

      <p className="text-xs text-muted-foreground">
        {type === "logo"
          ? "Recommended: 200x200px, Max 5MB, PNG/JPG/SVG"
          : "Recommended: 1200x400px, Max 5MB, PNG/JPG/WebP"}
      </p>
    </div>
  )
}

// Color Picker Component
function ColorPicker({ label, value, onChange, description }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-input"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-28 font-mono text-sm"
        />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
