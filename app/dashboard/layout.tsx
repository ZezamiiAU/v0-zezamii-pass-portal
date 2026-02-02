import type React from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user = null

  // Check for mock auth cookie first
  const cookieStore = await cookies()
  const mockAuthCookie = cookieStore.get("mock_auth_user")
  
  if (mockAuthCookie) {
    try {
      const mockUser = JSON.parse(decodeURIComponent(mockAuthCookie.value))
      user = {
        id: "mock-user-id",
        email: mockUser.email,
        role: mockUser.role || "admin",
      }
    } catch {
      // Invalid cookie, continue to Supabase auth
    }
  }

  // If no mock user, try Supabase auth
  if (!user) {
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
