import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUp, Building2, MapPin, QrCode } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  // Stats display removed until we have a working solution

  const quickLinks = [
    {
      title: "QR Generator",
      description: "Generate QR codes for devices",
      href: "/dashboard/qr-generator",
      icon: QrCode,
      color: "text-blue-500",
    },
    {
      title: "Upload Configuration",
      description: "Add new tenant configuration from JSON",
      href: "/dashboard/config-upload",
      icon: FileUp,
      color: "text-green-500",
    },
    {
      title: "Manage Organisations",
      description: "View and edit organisation settings",
      href: "/dashboard/organisations",
      icon: Building2,
      color: "text-purple-500",
    },
    {
      title: "Sites & Devices",
      description: "Configure access points and locations",
      href: "/dashboard/sites",
      icon: MapPin,
      color: "text-orange-500",
    },
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage your Zezamii Pass portal configuration and metadata</p>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {quickLinks.map((link) => (
            <Card key={link.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-muted", link.color)}>
                    <link.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={link.href}>
                  <Button variant="outline" className="w-full bg-transparent">
                    Go to {link.title}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}
