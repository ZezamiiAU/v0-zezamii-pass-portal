"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { use } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save, AlertCircle, Plus, X } from "lucide-react"
import { createProfile, updateProfile, getProfile, getSites } from "../actions"
import {
  PROFILE_TYPES,
  PROFILE_TYPE_LABELS,
  REQUIRED_INPUT_OPTIONS,
  REQUIRED_INPUT_LABELS,
  DEFAULT_PROFILE_VALUES,
} from "@/lib/types/pass-profile"

export default function ProfileEditPage({ params }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = resolvedParams.id === "new"

  const [formData, setFormData] = useState({
    ...DEFAULT_PROFILE_VALUES,
    site_id: searchParams.get("site_id") || "",
  })
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [durationOptionInput, setDurationOptionInput] = useState({ label: "", minutes: "" })

  useEffect(() => {
    loadSites()
    if (!isNew) {
      loadProfile()
    }
  }, [resolvedParams.id])

  async function loadSites() {
    const result = await getSites()
    if (result.success) {
      setSites(result.data)
    }
  }

  async function loadProfile() {
    setIsLoading(true)
    try {
      const result = await getProfile(resolvedParams.id)
      if (result.success && result.data) {
        setFormData({
          ...DEFAULT_PROFILE_VALUES,
          ...result.data,
          duration_options: result.data.duration_options || [],
          required_inputs: result.data.required_inputs || [],
        })
      } else {
        setError(result.error || "Profile not found")
      }
    } catch (err) {
      setError("Failed to load profile")
    } finally {
      setIsLoading(false)
    }
  }

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  function handleNumberChange(field, value) {
    const num = value === "" ? 0 : parseInt(value, 10)
    handleChange(field, isNaN(num) ? 0 : num)
  }

  function handleRequiredInputToggle(input) {
    const current = formData.required_inputs || []
    const updated = current.includes(input)
      ? current.filter((i) => i !== input)
      : [...current, input]
    handleChange("required_inputs", updated)
  }

  function handleAddDurationOption() {
    if (!durationOptionInput.label || !durationOptionInput.minutes) return

    const newOption = {
      label: durationOptionInput.label,
      minutes: parseInt(durationOptionInput.minutes, 10),
    }

    const current = formData.duration_options || []
    handleChange("duration_options", [...current, newOption])
    setDurationOptionInput({ label: "", minutes: "" })
  }

  function handleRemoveDurationOption(index) {
    const current = formData.duration_options || []
    handleChange(
      "duration_options",
      current.filter((_, i) => i !== index)
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const result = isNew
        ? await createProfile(formData)
        : await updateProfile(resolvedParams.id, formData)

      if (result.success) {
        router.push("/dashboard/profiles")
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError("Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <p className="text-center text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/dashboard/profiles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profiles
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">
          {isNew ? "Create Profile" : "Edit Profile"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isNew
            ? "Configure a new pass profile for booking behaviour"
            : "Update profile configuration"}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Profile identification and type</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="site_id">Site *</Label>
                <Select
                  value={formData.site_id}
                  onValueChange={(value) => handleChange("site_id", value)}
                  disabled={!isNew}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a site..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} {site.slug && `(${site.slug})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">Display Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Day Pass, Hourly Slot"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="code">Profile Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange("code", e.target.value)}
                  placeholder="e.g., end_of_day, hourly_slot"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier per site. Spaces will be converted to underscores.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="profile_type">Profile Type *</Label>
                <Select
                  value={formData.profile_type}
                  onValueChange={(value) => handleChange("profile_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {PROFILE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Duration Config */}
          <Card>
            <CardHeader>
              <CardTitle>Duration Configuration</CardTitle>
              <CardDescription>How pass validity is calculated</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="duration_minutes">Fixed Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  min="0"
                  value={formData.duration_minutes || ""}
                  onChange={(e) =>
                    handleChange(
                      "duration_minutes",
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  placeholder="Leave empty for variable duration"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="checkout_time">Checkout Time (for overnight)</Label>
                <Input
                  id="checkout_time"
                  type="time"
                  value={formData.checkout_time || ""}
                  onChange={(e) =>
                    handleChange("checkout_time", e.target.value || null)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  For overnight stays, the time when the pass expires
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Duration Options (for duration_select type)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Label (e.g., 1 Hour)"
                    value={durationOptionInput.label}
                    onChange={(e) =>
                      setDurationOptionInput((prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Minutes"
                    className="w-28"
                    value={durationOptionInput.minutes}
                    onChange={(e) =>
                      setDurationOptionInput((prev) => ({
                        ...prev,
                        minutes: e.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddDurationOption}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.duration_options?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.duration_options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-sm"
                      >
                        <span>
                          {opt.label} ({opt.minutes}m)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDurationOption(idx)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Buffers */}
          <Card>
            <CardHeader>
              <CardTitle>Buffer Configuration</CardTitle>
              <CardDescription>
                Grace periods before and after pass validity
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="entry_buffer_minutes">Entry Buffer (min)</Label>
                <Input
                  id="entry_buffer_minutes"
                  type="number"
                  min="0"
                  value={formData.entry_buffer_minutes}
                  onChange={(e) =>
                    handleNumberChange("entry_buffer_minutes", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  API: buffer_before_minutes
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="exit_buffer_minutes">Exit Buffer (min)</Label>
                <Input
                  id="exit_buffer_minutes"
                  type="number"
                  min="0"
                  value={formData.exit_buffer_minutes}
                  onChange={(e) =>
                    handleNumberChange("exit_buffer_minutes", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  API: buffer_after_minutes
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reset_buffer_minutes">Reset Buffer (min)</Label>
                <Input
                  id="reset_buffer_minutes"
                  type="number"
                  min="0"
                  value={formData.reset_buffer_minutes}
                  onChange={(e) =>
                    handleNumberChange("reset_buffer_minutes", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Time between consecutive bookings
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Required Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>Required Inputs</CardTitle>
              <CardDescription>
                What the PWA needs to collect from users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {REQUIRED_INPUT_OPTIONS.map((input) => (
                  <button
                    key={input}
                    type="button"
                    onClick={() => handleRequiredInputToggle(input)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      formData.required_inputs?.includes(input)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {REQUIRED_INPUT_LABELS[input]}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Enable advanced booking features (default OFF)
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.future_booking_enabled}
                  onChange={(e) =>
                    handleChange("future_booking_enabled", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <div>
                  <p className="font-medium">Future Booking</p>
                  <p className="text-sm text-muted-foreground">
                    Allow users to select future dates for their pass
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.availability_enforcement}
                  onChange={(e) =>
                    handleChange("availability_enforcement", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <div>
                  <p className="font-medium">Availability Enforcement</p>
                  <p className="text-sm text-muted-foreground">
                    Check and enforce slot availability before booking
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" type="button" asChild>
              <Link href="/dashboard/profiles">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : isNew ? "Create Profile" : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
