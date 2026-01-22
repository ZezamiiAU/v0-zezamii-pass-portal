import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user = null

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error("[v0] Dashboard auth error:", error.message)
    }
    
    if (!data?.user) {
      redirect("/auth/login")
    }
    
    user = data.user
  } catch (err) {
    // Handle connection errors gracefully - redirect to login, not error page
    console.error("[v0] Dashboard layout error:", err)
    redirect("/auth/login")
  }

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} />
      <main className="lg:pl-64">{children}</main>
    </div>
  )
}
