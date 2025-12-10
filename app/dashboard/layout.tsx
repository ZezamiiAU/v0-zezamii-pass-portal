"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { getMockUser } from "@/lib/auth/mock-auth"
import { useEffect, useState } from "react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mockUser = getMockUser()

    if (!mockUser) {
      router.push("/auth/login")
      return
    }

    setUser(mockUser)
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} />
      <main className="lg:pl-64">{children}</main>
    </div>
  )
}
