import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OrganisationDetailClient } from "./organisation-detail-client"

export default async function OrganisationDetailPage({ params }) {
  const { orgId } = await params
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch organisation from v_devices_with_passes view (bypasses RLS issue)
  const { data: devices } = await supabase
    .schema("core")
    .from("v_devices_with_passes")
    .select("org_id, org_name, org_slug")
    .eq("org_id", orgId)
    .limit(1)

  if (!devices || devices.length === 0) {
    notFound()
  }

  const device = devices[0]
  
  // Now fetch the brand_settings from organisations table using service role or try direct
  const { data: orgData } = await supabase
    .schema("core")
    .from("organisations")
    .select("brand_settings")
    .eq("id", orgId)
    .maybeSingle()

  const organisation = {
    id: device.org_id,
    name: device.org_name,
    slug: device.org_slug,
    brand_settings: orgData?.brand_settings || null,
  }

  return <OrganisationDetailClient organisation={organisation} />
}
