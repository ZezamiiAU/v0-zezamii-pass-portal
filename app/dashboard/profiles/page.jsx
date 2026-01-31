"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, AlertCircle, Layers, Clock, Calendar, Timer } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PROFILE_TYPE_LABELS } from "@/lib/types/pass-profile"

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState([])
  const [sites, setSites] = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const supabase = createClient()

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchProfiles(selectedSiteId)
    }
  }, [selectedSiteId])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name")

      if (error) throw error

      setSites(data || [])
      if (data && data.length > 0) {
        setSelectedSiteId(data[0].id)
      }
    } catch (err) {
      console.error("[v0] Error fetching sites:", err)
      setError("Failed to load sites. Please check your database connection.")
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchProfiles(siteId) {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("pass_profiles")
        .select("*")
        .eq("site_id", siteId)
        .order("name")

      if (error) throw error

      setProfiles(data || [])
      setError(null)
    } catch (err) {
      console.error("[v0] Error fetching profiles:", err)
      // Table might not exist yet - show friendly message
      if (err.code === "42P01") {
        setError("Pass profiles table not found. Please run migration 030_create_pass_profiles.sql first.")
      } else {
        setError("Failed to load profiles.")
      }
      setProfiles([])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(profileId) {
    try {
      const { error } = await supabase
        .from("pass_profiles")
        .delete()
        .eq("id", profileId)

      if (error) throw error

      setProfiles(profiles.filter(p => p.id !== profileId))
      setDeleteConfirm(null)
    } catch (err) {
      console.error("[v0] Error deleting profile:", err)
      setError("Failed to delete profile. It may be assigned to pass types.")
    }
  }

  function getProfileTypeIcon(profileType) {
    switch (profileType) {
      case "instant":
        return <Layers className="h-4 w-4" />
      case "date_select":
        return <Calendar className="h-4 w-4" />
      case "datetime_select":
        return <Clock className="h-4 w-4" />
      case "duration_select":
        return <Timer className="h-4 w-4" />
      default:
        return <Layers className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Pass Profiles</h1>
          <p className="text-muted-foreground mt-2">
            Configure booking behaviour for pass types
          </p>
        </div>
        <Button asChild disabled={!selectedSiteId}>
          <Link href={`/dashboard/profiles/new?site_id=${selectedSiteId}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Profile
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Site</CardTitle>
          <CardDescription>Profiles are scoped to individual sites</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full max-w-md">
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
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Loading profiles...</p>
          </CardContent>
        </Card>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Layers className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No profiles yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create your first profile to enable booking behaviour for pass types.
              </p>
              <Button asChild className="mt-4" disabled={!selectedSiteId}>
                <Link href={`/dashboard/profiles/new?site_id=${selectedSiteId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      {getProfileTypeIcon(profile.profile_type)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{profile.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {profile.code}
                        </code>
                        <span>•</span>
                        <span>{PROFILE_TYPE_LABELS[profile.profile_type] || profile.profile_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                      {profile.entry_buffer_minutes > 0 && (
                        <span>Entry: +{profile.entry_buffer_minutes}m</span>
                      )}
                      {profile.exit_buffer_minutes > 0 && (
                        <span>Exit: +{profile.exit_buffer_minutes}m</span>
                      )}
                      {profile.future_booking_enabled && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          Future Booking
                        </span>
                      )}
                      {profile.availability_enforcement && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                          Availability Check
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/profiles/${profile.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      {deleteConfirm === profile.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(profile.id)}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(profile.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
