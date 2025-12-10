import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PassesClient } from "./passes-client"

export default async function PassesPage() {
  const supabase = await createSupabaseServerClient()

  // Get organizations with pass module
  const { data: orgModuleLicenses } = await supabase
    .schema("core")
    .from("org_module_licenses")
    .select("org_id, module_key")
    .eq("module_key", "pass")

  const orgIdsWithPassModule = orgModuleLicenses?.map((license) => license.org_id) || []

  // Fetch all devices with passes
  const { data: devices } = await supabase
    .schema("core")
    .from("v_devices_with_passes")
    .select("*")
    .in("org_id", orgIdsWithPassModule.length > 0 ? orgIdsWithPassModule : ["00000000-0000-0000-0000-000000000000"])
    .order("org_name", { ascending: true })

  return <PassesClient devices={devices || []} />
}
