import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QRGeneratorClient } from "./qr-generator-client"

export default async function QRGeneratorPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: orgModuleLicenses } = await supabase
    .schema("core")
    .from("org_module_licenses")
    .select("org_id, module_key")
    .eq("module_key", "pass")

  const orgIdsWithPassModule = orgModuleLicenses?.map((license) => license.org_id) || []

  const { data: devices } = await supabase
    .schema("core")
    .from("v_devices_with_passes")
    .select("*")
    .in("org_id", orgIdsWithPassModule.length > 0 ? orgIdsWithPassModule : ["00000000-0000-0000-0000-000000000000"]) // Use dummy UUID if no orgs have pass module
    .order("org_name", { ascending: true })

  return <QRGeneratorClient devices={devices || []} />
}
