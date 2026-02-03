"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Building2, Search, ChevronRight } from "lucide-react"

export function OrganisationsClient({ organisations }) {
  const [filteredOrgs, setFilteredOrgs] = useState(organisations)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredOrgs(organisations)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredOrgs(
        organisations.filter(
          (org) =>
            org.name?.toLowerCase().includes(query) ||
            org.slug?.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, organisations])

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Organisations</h1>
          <p className="text-muted-foreground mt-2">
            Manage organisation settings and branding
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search organisations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredOrgs.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  {searchQuery ? "No organisations found" : "No organisations yet"}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Organisations will appear here once created"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrgs.map((org) => {
              const logoUrl = org.brand_settings?.logo_url
              const primaryColor = org.brand_settings?.primary_color || "#001F3F"

              return (
                <Link key={org.id} href={`/dashboard/organisations/${org.id}`}>
                  <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={`${org.name} logo`}
                              className="h-10 w-10 object-contain rounded"
                            />
                          ) : (
                            <Building2
                              className="h-6 w-6"
                              style={{ color: primaryColor }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{org.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {org.slug}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {filteredOrgs.length} organisation{filteredOrgs.length !== 1 ? "s" : ""} found
        </p>
      </div>
    </div>
  )
}
