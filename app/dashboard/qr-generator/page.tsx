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

  // Fetch all devices directly from v_devices_with_passes view
  const { data: devices } = await supabase
    .schema("core")
    .from("v_devices_with_passes")
    .select("*")
    .order("org_name", { ascending: true })

  return <QRGeneratorClient devices={devices || []} />
}
