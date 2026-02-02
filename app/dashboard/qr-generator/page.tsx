import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { QRGeneratorClient } from "./qr-generator-client"

export default async function QRGeneratorPage() {
  // Check for mock auth cookie first
  const cookieStore = await cookies()
  const mockAuthCookie = cookieStore.get("mock_auth_user")
  
  if (mockAuthCookie) {
    // Mock auth - return sample devices for testing (no DB connection)
    const mockDevices = [
      {
        device_id: "dev-001",
        device_name: "Main Entrance Gate",
        device_slug: "main-entrance",
        site_id: "site-001",
        site_name: "Sydney Office",
        site_slug: "sydney-office",
        org_id: "org-001",
        org_name: "Acme Corp",
        org_slug: "acme-corp",
        pass_count: 3,
      },
      {
        device_id: "dev-002",
        device_name: "Car Park Entry",
        device_slug: "car-park",
        site_id: "site-001",
        site_name: "Sydney Office",
        site_slug: "sydney-office",
        org_id: "org-001",
        org_name: "Acme Corp",
        org_slug: "acme-corp",
        pass_count: 2,
      },
      {
        device_id: "dev-003",
        device_name: "Reception Door",
        device_slug: "reception",
        site_id: "site-002",
        site_name: "Melbourne Office",
        site_slug: "melbourne-office",
        org_id: "org-001",
        org_name: "Acme Corp",
        org_slug: "acme-corp",
        pass_count: 5,
      },
      {
        device_id: "dev-004",
        device_name: "Pool Gate",
        device_slug: "pool-gate",
        site_id: "site-003",
        site_name: "Beach Resort",
        site_slug: "beach-resort",
        org_id: "org-002",
        org_name: "Holiday Parks",
        org_slug: "holiday-parks",
        pass_count: 10,
      },
      {
        device_id: "dev-005",
        device_name: "Campground Entry",
        device_slug: "campground",
        site_id: "site-003",
        site_name: "Beach Resort",
        site_slug: "beach-resort",
        org_id: "org-002",
        org_name: "Holiday Parks",
        org_slug: "holiday-parks",
        pass_count: 8,
      },
    ]
    return <QRGeneratorClient devices={mockDevices} />
  }

  // Real Supabase auth
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
