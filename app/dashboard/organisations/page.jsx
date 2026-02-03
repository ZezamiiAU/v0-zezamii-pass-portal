import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OrganisationsClient } from "./organisations-client"

export default async function OrganisationsPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch organisations - get unique orgs from v_devices_with_passes view
  // This view already has proper access and includes org info
  const { data: devices } = await supabase
    .schema("core")
    .from("v_devices_with_passes")
    .select("org_id, org_name, org_slug")
    .order("org_name", { ascending: true })

  // Extract unique organisations from devices
  const orgsMap = new Map()
  devices?.forEach((device) => {
    if (device.org_id && !orgsMap.has(device.org_id)) {
      orgsMap.set(device.org_id, {
        id: device.org_id,
        name: device.org_name,
        slug: device.org_slug,
        brand_settings: null, // Will be fetched in detail page
      })
    }
  })

  const organisations = Array.from(orgsMap.values())

  return <OrganisationsClient organisations={organisations} />
}
