"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Building2, FileUp, Home, MapPin, Package, Settings, CreditCard, LogOut, QrCode, Menu, X } from "lucide-react"
import type { User } from "@supabase/supabase-js"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Config Upload", href: "/dashboard/config-upload", icon: FileUp },
  { name: "QR Generator", href: "/dashboard/qr-generator", icon: QrCode },
  { name: "Organisations", href: "/dashboard/organisations", icon: Building2 },
  { name: "Sites & Devices", href: "/dashboard/sites", icon: MapPin },
  { name: "Pass Types", href: "/dashboard/pass-types", icon: Package },
  { name: "Passes", href: "/dashboard/passes", icon: CreditCard },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

async function signOut() {
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  await supabase.auth.signOut()
  window.location.href = "/auth/login"
}

export function DashboardNav({ user }: { user: User }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-background px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center border-b -mx-6 px-6">
            <h1 className="text-xl font-semibold">Zezamii Pass</h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="rounded-lg border bg-card p-4 mb-4">
                  <p className="text-xs font-medium mb-1">Signed in as</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button variant="outline" className="w-full justify-start bg-transparent" onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-background px-4 py-4 shadow-sm sm:px-6 lg:hidden border-b">
        <h1 className="text-lg font-semibold">Zezamii Pass</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Slide-out menu */}
          <div className="fixed inset-y-0 left-0 w-64 bg-background shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-6">
              <h1 className="text-xl font-semibold">Zezamii Pass</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col p-4">
              <ul role="list" className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "group flex gap-x-3 rounded-md p-3 text-sm font-semibold leading-6 transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-auto pt-6 border-t mt-6">
                <div className="rounded-lg border bg-card p-4 mb-4">
                  <p className="text-xs font-medium mb-1">Signed in as</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button variant="outline" className="w-full justify-start bg-transparent" onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
