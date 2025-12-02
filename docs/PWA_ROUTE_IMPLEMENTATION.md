# PWA Route Implementation Guide

This document provides a complete sample implementation for the `/p/[orgSlug]/[deviceSlug]` route that the Pass Portal QR codes point to.

## Route Structure

<!-- Updated example URL to zezamii-pass.vercel.app -->
The QR codes generate URLs like:
\`\`\`
https://zezamii-pass.vercel.app/p/zezamii-parks/main-entrance?qr=abc-123-def&source=qr
\`\`\`

Where:
- `zezamii-parks` is the organization slug
- `main-entrance` is the device/access point slug  
- `qr=abc-123-def` is the QR instance ID for analytics
- `source=qr` indicates this came from a QR code scan

## Database Schema References

The PWA will need to query these tables:

**Organizations**: `core.organisations`
- `id`, `name`, `slug`, `brand_settings`, `billing_email`

**Devices**: `core.devices`
- `id`, `slug`, `custom_name`, `custom_description`, `custom_logo_url`

**Sites**: `core.sites`
- `id`, `name`, `address`, `city`, `state`

**Pass Types**: `pass.pass_types`
- `id`, `name`, `code`, `description`, `price_cents`, `currency`, `duration_minutes`, `is_active`

**Accesspoint Details View**: `pass.v_accesspoint_details`
- Pre-joined view with all device/org/site info

**Analytics**: `analytics.qr_scans`
- Track QR code scans for analytics

## Sample Implementation

### 1. Create the Route File

Create `app/p/[orgSlug]/[deviceSlug]/page.tsx`:

\`\`\`typescript
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PassPurchaseFlow } from '@/components/pass-purchase-flow'
import { trackQRScan } from '@/lib/analytics'

interface PageProps {
  params: Promise<{
    orgSlug: string
    deviceSlug: string
  }>
  searchParams: Promise<{
    qr?: string
    source?: string
  }>
}

export default async function PassPage({ params, searchParams }: PageProps) {
  // Await params and searchParams (Next.js 15+)
  const { orgSlug, deviceSlug } = await params
  const { qr: qrInstanceId, source } = await searchParams

  const supabase = createServerClient()

  // Fetch access point details using the pre-built view
  const { data: accessPoint, error } = await supabase
    .from('v_accesspoint_details')
    .select('*')
    .eq('org_slug', orgSlug)
    .eq('slug', deviceSlug)
    .eq('is_active', true)
    .single()

  if (error || !accessPoint) {
    notFound()
  }

  // Fetch active pass types for this organization
  const { data: passTypes } = await supabase
    .from('pass_types')
    .select('*')
    .eq('org_id', accessPoint.org_id)
    .eq('is_active', true)
    .order('price_cents', { ascending: true })

  // Track QR scan if this came from a QR code
  if (qrInstanceId && source === 'qr') {
    await trackQRScan({
      qrInstanceId,
      deviceId: accessPoint.device_id,
      orgId: accessPoint.org_id,
      slug: deviceSlug,
    })
  }

  return (
    <PassPurchaseFlow
      accessPoint={accessPoint}
      passTypes={passTypes || []}
      qrInstanceId={qrInstanceId}
    />
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const { orgSlug, deviceSlug } = await params
  const supabase = createServerClient()

  const { data: accessPoint } = await supabase
    .from('v_accesspoint_details')
    .select('org_name, accesspoint_name, site_name')
    .eq('org_slug', orgSlug)
    .eq('slug', deviceSlug)
    .single()

  if (!accessPoint) {
    return {
      title: 'Access Pass',
    }
  }

  return {
    title: `${accessPoint.accesspoint_name} - ${accessPoint.org_name}`,
    description: `Purchase an access pass for ${accessPoint.accesspoint_name} at ${accessPoint.site_name}`,
  }
}
\`\`\`

### 2. Create Supabase Server Client

Create `lib/supabase/server.ts`:

\`\`\`typescript
import { createServerClient as createClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerClient() {
  const cookieStore = cookies()

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
\`\`\`

### 3. Create Analytics Tracking

Create `lib/analytics.ts`:

\`\`\`typescript
import { createServerClient } from '@/lib/supabase/server'

interface TrackQRScanParams {
  qrInstanceId: string
  deviceId: string
  orgId: string
  slug: string
}

export async function trackQRScan(params: TrackQRScanParams) {
  const supabase = createServerClient()
  
  try {
    await supabase.from('qr_scans').insert({
      qr_instance_id: params.qrInstanceId,
      device_id: params.deviceId,
      org_id: params.orgId,
      slug: params.slug,
      scanned_at: new Date().toISOString(),
      source: 'qr',
      // Optional: Add IP, user agent from request headers
    })
  } catch (error) {
    console.error('Failed to track QR scan:', error)
    // Don't throw - analytics failure shouldn't break the page
  }
}
\`\`\`

### 4. Create Pass Purchase Flow Component

Create `components/pass-purchase-flow.tsx`:

\`\`\`typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, CreditCard } from 'lucide-react'

interface PassType {
  id: string
  name: string
  code: string
  description: string | null
  price_cents: number
  currency: string
  duration_minutes: number
}

interface AccessPoint {
  org_name: string
  accesspoint_name: string
  site_name: string
  site_city: string | null
  site_state: string | null
  custom_description: string | null
  custom_logo_url: string | null
  device_id: string
  org_id: string
}

interface Props {
  accessPoint: AccessPoint
  passTypes: PassType[]
  qrInstanceId?: string
}

export function PassPurchaseFlow({ accessPoint, passTypes, qrInstanceId }: Props) {
  const [selectedPassTypeId, setSelectedPassTypeId] = useState<string | null>(null)

  const handlePurchase = async () => {
    if (!selectedPassTypeId) return

    // Call your purchase API endpoint
    const response = await fetch('/api/passes/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passTypeId: selectedPassTypeId,
        deviceId: accessPoint.device_id,
        qrInstanceId,
      }),
    })

    const { checkoutUrl } = await response.json()
    window.location.href = checkoutUrl
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {accessPoint.custom_logo_url && (
            <img 
              src={accessPoint.custom_logo_url || "/placeholder.svg"} 
              alt={accessPoint.org_name}
              className="h-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-bold">{accessPoint.accesspoint_name}</h1>
          <p className="text-muted-foreground">{accessPoint.org_name}</p>
        </div>

        {/* Location */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <MapPin className="size-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{accessPoint.site_name}</p>
                {(accessPoint.site_city || accessPoint.site_state) && (
                  <p className="text-sm text-muted-foreground">
                    {[accessPoint.site_city, accessPoint.site_state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Description */}
        {accessPoint.custom_description && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">{accessPoint.custom_description}</p>
            </CardContent>
          </Card>
        )}

        {/* Pass Types */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Select a Pass</h2>
          
          {passTypes.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No passes available at this location
              </CardContent>
            </Card>
          )}

          {passTypes.map((passType) => {
            const isSelected = selectedPassTypeId === passType.id
            const priceDisplay = (passType.price_cents / 100).toFixed(2)
            const durationHours = Math.floor(passType.duration_minutes / 60)
            const durationMins = passType.duration_minutes % 60

            return (
              <Card
                key={passType.id}
                className={`cursor-pointer transition-colors ${isSelected ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'}`}
                onClick={() => setSelectedPassTypeId(passType.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{passType.name}</CardTitle>
                      {passType.description && (
                        <CardDescription>{passType.description}</CardDescription>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {passType.currency} ${priceDisplay}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4" />
                    <span>
                      {durationHours > 0 && `${durationHours}h `}
                      {durationMins > 0 && `${durationMins}m`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Purchase Button */}
        <Button
          size="lg"
          className="w-full"
          disabled={!selectedPassTypeId}
          onClick={handlePurchase}
        >
          <CreditCard className="size-5 mr-2" />
          Continue to Payment
        </Button>
      </div>
    </div>
  )
}
\`\`\`

### 5. Create Checkout API Route

Create `app/api/passes/create-checkout/route.ts`:

\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export async function POST(request: NextRequest) {
  try {
    const { passTypeId, deviceId, qrInstanceId } = await request.json()

    const supabase = createServerClient()

    // Get pass type details
    const { data: passType, error } = await supabase
      .from('pass_types')
      .select('*, org:organisations(name)')
      .eq('id', passTypeId)
      .single()

    if (error || !passType) {
      return NextResponse.json(
        { error: 'Pass type not found' },
        { status: 404 }
      )
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: passType.currency.toLowerCase(),
            product_data: {
              name: passType.name,
              description: passType.description || undefined,
            },
            unit_amount: passType.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${request.nextUrl.origin}/pass/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/pass/cancelled`,
      metadata: {
        passTypeId,
        deviceId,
        qrInstanceId: qrInstanceId || '',
      },
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    console.error('Checkout creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    )
  }
}
\`\`\`

## Environment Variables Required

Add these to your PWA's `.env` file:

\`\`\`bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
STRIPE_SECRET_KEY=sk_test_...
\`\`\`

## Testing

1. Generate a QR code from the portal at `/dashboard/qr-generator`
2. Scan the QR code or visit the URL directly
3. Verify the pass types display correctly
4. Test the checkout flow
5. Check analytics data in `analytics.qr_scans` table

## Next Steps

1. Implement webhook handler for Stripe payment completion
2. Create pass records in `pass.passes` table after successful payment
3. Generate lock codes via `pass.lock_codes` if using physical access
4. Send confirmation emails with pass details
5. Implement pass display/redemption UI
