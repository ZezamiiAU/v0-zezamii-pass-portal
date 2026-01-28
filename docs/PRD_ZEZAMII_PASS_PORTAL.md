# Product Requirements Document: Zezamii Pass Portal

**Version:** 2.0  
**Date:** January 2026  
**Status:** Living Document
**Last Updated:** 26 January 2026

---

## 1. Executive Summary

The Zezamii Pass Portal is an admin interface for managing digital access passes, QR codes, PIN codes, and device configurations. It serves as the control center for the Zezamii Pass ecosystem, which enables organizations to sell and manage temporary access to physical spaces (gates, doors, parking areas) via QR-based passes.

---

## 2. Current State

### 2.1 Existing Pages

| Page | Route | Status | Description |
|------|-------|--------|-------------|
| Home | `/` | Done | Redirects to `/dashboard` |
| Login | `/auth/login` | Done | Email/password authentication |
| Sign Up | `/auth/sign-up` | Done | New user registration |
| Sign Up Success | `/auth/sign-up-success` | Done | Post-registration confirmation |
| Auth Error | `/auth/error` | Done | Authentication error handling |
| Dashboard | `/dashboard` | Done | Main landing page with stats |
| Config Upload | `/dashboard/config-upload` | Done | Excel bulk upload for orgs/sites/devices |
| QR Generator | `/dashboard/qr-generator` | Done | Generate/manage QR passes for devices |

### 2.2 Existing API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/webhooks/rooms/pin` | GET | Health check + PIN lookup |
| `/api/v1/webhooks/rooms/pin` | POST | Receive PIN from Rooms system |
| `/api/v1/webhooks/rooms/pin` | DELETE | Revoke PIN code |
| `/api/v1/cron/backup-codes` | GET | Backup code management cron |

### 2.3 Existing Features

#### Authentication
- Supabase Auth integration
- Email/password login
- Protected dashboard routes
- Session management via middleware

#### Config Upload
- Excel file parsing (XLSX)
- Bulk creation of organizations, sites, floors, devices
- SQL generation for database operations
- Validation and preview before execution

#### QR Generator
- Device selection by organization/site
- QR code generation with customizable settings
- Pass URL construction using configurable domain
- Pass type management (Default Pass, etc.)
- Copy/share functionality

#### Rooms Integration (PIN Webhook)
- Receive PIN codes from Rooms booking system
- Store PINs in `pass.lock_codes` table
- PIN validation (4-8 digits only)
- Reservation ID validation
- Idempotency handling
- DELETE support for PIN revocation

#### PIN Code System (3-Tier Architecture)

The system uses a 3-tier approach for PIN code resilience:

| Tier | Name | Source | Description |
|------|------|--------|-------------|
| **Tier 1** | Primary Code | Rooms API | Real-time PIN from booking system |
| **Tier 2** | Pool | Lock API | Pre-generated backup codes (bucketed by duration) |
| **Tier 3** | Hail Mary | Lock API | Single emergency code per device (never expires) |

**Tier 2 Pool Buckets:**
| Bucket | Inventory | Use Case |
|--------|-----------|----------|
| `day_one_time` | 12 | Day passes (one-time use at lock level) |
| `camp_4d` | 5 | Camping 1-4 days |
| `camp_7d` | 4 | Camping 5-7 days |
| `camp_14d` | 2 | Camping 8-14 days |
| `camp_28d` | 2 | Camping 15-28 days |

**Selection Flow:**
1. Check Tier 1 (Primary) - if exists, return
2. Check Tier 2 (Pool) - smart bucket match (nearest >= requested days)
3. Check Tier 3 (Hail Mary) - emergency fallback + alert admin
4. Return `NO_CODE` error if all tiers exhausted

### 2.4 Database Schema (Key Tables)

**Pass Module:**
- `pass.passes` - Individual pass records
- `pass.pass_types` - Pass type definitions (pricing, duration)
- `pass.lock_codes` - PIN codes linked to passes
- `pass.payments` - Stripe payment records
- `pass.backup_code_pool` - Pre-generated backup codes
- `pass.accesspoint_slugs` - Device URL slugs

**Core Module:**
- `core.organisations` - Organization records
- `core.sites` - Physical locations
- `core.devices` - Access points (gates, doors)
- `core.floors` / `core.buildings` - Location hierarchy
- `core.qr_passes` - QR pass instances
- `core.users` / `core.org_members` - User management

---

## 3. Backend Services Architecture

### 3.1 Services Overview

| Service | Purpose | Runtime | Trigger | Endpoint |
|---------|---------|---------|---------|----------|
| **Rooms Webhook** | Receive Tier 1 primary codes | Vercel Serverless | HTTP POST from Rooms | `/api/v1/webhooks/rooms/pin` |
| **Pool Replenish** | Maintain Tier 2 pool inventory | Vercel Cron | Scheduled (hourly) | `/api/v1/cron/backup-codes/replenish` |
| **Pool Cleanup** | Remove expired pool codes | Vercel Cron | Scheduled (daily) | `/api/v1/cron/backup-codes/cleanup` |
| **Hail Mary Check** | Ensure Tier 3 codes exist | Vercel Cron | Scheduled (daily) | `/api/v1/cron/backup-codes/hail-mary` |
| **Lock API Client** | Create/delete codes on locks | Internal library | Called by services | `lib/lock-api/client.ts` |

### 3.2 Service Details

#### 3.2.1 Rooms Webhook Service
**Endpoint:** `POST /api/v1/webhooks/rooms/pin`  
**Runtime:** Vercel Serverless Function  
**Auth:** HMAC signature via `ROOMS_WEBHOOK_SECRET`

**Responsibilities:**
- Receive PIN codes from Rooms booking system
- Validate reservation exists in `pass.passes`
- Store PIN in `pass.lock_codes` with provider = 'rooms'
- Handle idempotent updates (same reservation, new code)

**Inputs:**
\`\`\`json
{
  "reservationId": "uuid",
  "pinCode": "1234",
  "validFrom": "2026-01-26T10:00:00Z",
  "validTo": "2026-01-28T10:00:00Z"
}
\`\`\`

---

#### 3.2.2 Pool Replenish Service
**Endpoint:** `GET /api/v1/cron/backup-codes/replenish`  
**Runtime:** Vercel Cron  
**Schedule:** Every hour (`0 * * * *`)  
**Auth:** Vercel Cron signature

**Responsibilities:**
- Check pool inventory per device against targets
- Create new backup codes via Lock API for low buckets
- Store codes in `pass.backup_code_pool`
- Log replenishment activity

**Flow:**
1. Query devices with `backup_code_mode = 'pool'`
2. For each device, count available codes per bucket
3. If count < target, call Lock API to create codes
4. Insert new codes into `backup_code_pool`

**Inventory Targets (per device):**
| Bucket | Target |
|--------|--------|
| `day_one_time` | 12 |
| `camp_4d` | 5 |
| `camp_7d` | 4 |
| `camp_14d` | 2 |
| `camp_28d` | 2 |

---

#### 3.2.3 Pool Cleanup Service
**Endpoint:** `GET /api/v1/cron/backup-codes/cleanup`  
**Runtime:** Vercel Cron  
**Schedule:** Daily at 2am (`0 2 * * *`)  
**Auth:** Vercel Cron signature

**Responsibilities:**
- Find expired codes in `backup_code_pool` (status = 'available', expires_at < now)
- Call Lock API to delete codes from physical locks
- Update status to 'expired' or delete from table
- Find used codes past retention period and archive/delete

**Flow:**
1. Query `backup_code_pool WHERE expires_at < NOW() AND status = 'available'`
2. For each code, call Lock API `deleteCode(lockId, codeRef)`
3. Update code status or delete row
4. Log cleanup activity

---

#### 3.2.4 Hail Mary Check Service
**Endpoint:** `GET /api/v1/cron/backup-codes/hail-mary`  
**Runtime:** Vercel Cron  
**Schedule:** Daily at 3am (`0 3 * * *`)  
**Auth:** Vercel Cron signature

**Responsibilities:**
- Ensure every pool-enabled device has a Tier 3 hail mary code
- Create missing hail mary codes via Lock API
- Replace used hail mary codes
- Alert if hail mary was used (indicates pool health issue)

**Flow:**
1. Query devices with `backup_code_mode = 'pool'`
2. Check for existing hail mary code (category = 'hail_mary', status = 'available')
3. If missing or used, create new via Lock API (no expiry)
4. If previous was used, log alert for admin review

---

#### 3.2.5 Lock API Client
**Location:** `lib/lock-api/client.ts`  
**Type:** Internal library (not an endpoint)

**Responsibilities:**
- Abstract lock vendor API communication
- Create PIN codes on physical locks
- Delete PIN codes from locks
- Handle retries and error cases

**Interface:**
\`\`\`typescript
interface LockAPIClient {
  createCode(params: {
    lockId: string;
    pinCode: string;
    validFrom: Date;
    validUntil: Date | null;  // null = never expires
    oneTime?: boolean;
    label?: string;
  }): Promise<{ success: boolean; codeRef: string }>;

  deleteCode(params: {
    lockId: string;
    codeRef: string;
  }): Promise<{ success: boolean }>;
}
\`\`\`

**Configuration:**
- Lock API base URL via `LOCK_API_URL` env var
- Auth via `LOCK_API_KEY` env var

---

### 3.3 Service Dependencies

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        External Systems                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Rooms System              Lock Vendor API        Supabase     │
│   (booking)                 (physical locks)       (database)   │
│       │                           │                    │        │
│       │ webhook                   │ REST               │ SQL    │
│       ▼                           ▼                    ▼        │
├─────────────────────────────────────────────────────────────────┤
│                        Portal Services                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │   Rooms      │    │    Pool      │    │    Pool      │     │
│   │   Webhook    │    │  Replenish   │    │   Cleanup    │     │
│   │  (Tier 1)    │    │  (Tier 2)    │    │  (Tier 2)    │     │
│   └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                 │
│   ┌──────────────┐    ┌──────────────────────────────────┐     │
│   │  Hail Mary   │    │        Lock API Client           │     │
│   │   Check      │    │   (shared by replenish/cleanup)  │     │
│   │  (Tier 3)    │    └──────────────────────────────────┘     │
│   └──────────────┘                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                           PWA                                    │
├─────────────────────────────────────────────────────────────────┤
│   pass.zezamii.com                                              │
│   - Requests PIN via getBackupCode()                            │
│   - Passes passType (day/camping) and campingDays               │
│   - Receives code from Tier 1, 2, or 3                          │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

### 3.4 Environment Variables Required

| Variable | Service | Description |
|----------|---------|-------------|
| `ROOMS_WEBHOOK_SECRET` | Rooms Webhook | HMAC secret for webhook validation |
| `LOCK_API_URL` | Lock API Client | Base URL for lock vendor API |
| `LOCK_API_KEY` | Lock API Client | API key for lock vendor |
| `SUPABASE_SERVICE_ROLE_KEY` | All services | Database access |
| `CRON_SECRET` | Cron jobs | Vercel cron authentication |

---

### 3.5 Vercel Cron Configuration

\`\`\`json
// vercel.json
{
  "crons": [
    {
      "path": "/api/v1/cron/backup-codes/replenish",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/v1/cron/backup-codes/cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/v1/cron/backup-codes/hail-mary",
      "schedule": "0 3 * * *"
    }
  ]
}
\`\`\`

---

## 4. Database Schema Changes

### 4.1 Backup Code Pool Updates

\`\`\`sql
-- Update category enum to new bucket names
ALTER TABLE pass.backup_code_pool 
  DROP CONSTRAINT IF EXISTS backup_code_pool_category_check;

ALTER TABLE pass.backup_code_pool 
  ADD CONSTRAINT backup_code_pool_category_check 
  CHECK (category IN ('day_one_time', 'camp_4d', 'camp_7d', 'camp_14d', 'camp_28d', 'hail_mary'));

-- Add lock_ref column for Lock API reference
ALTER TABLE pass.backup_code_pool 
  ADD COLUMN IF NOT EXISTS lock_ref TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_backup_code_pool_device_category 
  ON pass.backup_code_pool(device_id, category, status);
\`\`\`

### 4.2 Device Updates

\`\`\`sql
-- Add hail_mary tracking columns (alternative to pool table)
ALTER TABLE core.devices 
  ADD COLUMN IF NOT EXISTS hail_mary_code TEXT,
  ADD COLUMN IF NOT EXISTS hail_mary_lock_ref TEXT,
  ADD COLUMN IF NOT EXISTS hail_mary_last_used TIMESTAMPTZ;
\`\`\`

### 4.3 Alert/Logging Table

\`\`\`sql
-- Track hail mary usage for alerting
CREATE TABLE IF NOT EXISTS pass.backup_code_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES core.devices(id),
  alert_type TEXT NOT NULL,  -- 'hail_mary_used', 'pool_low', 'replenish_failed'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES core.users(id)
);
\`\`\`

---

## 5. Recommended Enhancements

### 5.1 High Priority (Phase 1)

#### 5.1.1 Organizations Management Page
**Route:** `/dashboard/organisations`

**Features:**
- List all organizations with search/filter
- View organization details (name, slug, settings)
- Edit organization branding settings
- View sites within organization
- Toggle organization active status

**Why:** Currently no way to view/edit organizations in the portal.

---

#### 5.1.2 Sites & Devices Management Page
**Route:** `/dashboard/sites-devices`

**Features:**
- Hierarchical view: Organization > Site > Building > Floor > Device
- Device status overview (active, inactive, health)
- Edit device details (name, description, custom logo)
- View device QR readiness status
- Bulk device operations

**Why:** The sidebar shows "Sites & Devices" and "Organisations" but these pages don't exist.

---

#### 5.1.3 Passes Management Page
**Route:** `/dashboard/passes`

**Features:**
- List all passes with filters (status, date range, device)
- View pass details (purchaser, validity period, PIN code)
- Pass status management (activate, expire, cancel)
- View associated payments
- Search by email or vehicle plate

**Why:** No visibility into purchased passes or their status.

---

#### 5.1.4 Pass Types Management Page
**Route:** `/dashboard/pass-types`

**Features:**
- CRUD for pass types
- Configure pricing (amount, currency)
- Set duration (minutes/hours/days)
- Enable/disable pass types per device
- Preview pass type on PWA

**Why:** Pass types currently managed only via database.

---

### 5.2 Medium Priority (Phase 2)

#### 5.2.1 Analytics Dashboard
**Route:** `/dashboard/analytics`

**Features:**
- Pass sales overview (daily/weekly/monthly)
- Revenue by organization/site
- QR scan analytics
- Conversion rates (scan to purchase)
- Peak usage times

**Tables:** `analytics.qr_scans`, `pass.payments`, `pass.passes`

---

#### 5.2.2 User Management
**Route:** `/dashboard/users`

**Features:**
- List portal users
- Role management (admin, viewer)
- Invite new users
- Organization membership management

**Tables:** `core.users`, `core.org_members`

---

#### 5.2.3 Settings Page
**Route:** `/dashboard/settings`

**Features:**
- Organization branding (logo, colors)
- Email notification settings
- Webhook configurations
- API key management
- Default pass settings

---

#### 5.2.4 Audit Logs
**Route:** `/dashboard/audit`

**Features:**
- View all admin actions
- Filter by user, action type, date
- Export audit logs

**Table:** `core.audit_events`

---

### 5.3 Lower Priority (Phase 3)

#### 5.3.1 Access Logs Viewer
**Route:** `/dashboard/access-logs`

**Features:**
- View device access attempts
- Filter by success/failure
- Debug access issues

**Table:** `access.access_logs`

---

#### 5.3.2 Webhook Management
**Route:** `/dashboard/webhooks`

**Features:**
- Configure outbound webhooks
- View delivery history
- Retry failed deliveries

**Tables:** `events.webhook_subscriptions`, `events.webhook_deliveries`

---

#### 5.3.3 Reports & Exports
**Route:** `/dashboard/reports`

**Features:**
- Generate pass reports
- Export to CSV/PDF
- Scheduled report emails

---

#### 5.3.4 Integration Management
**Route:** `/dashboard/integrations`

**Features:**
- Rooms integration status
- Stripe Connect settings
- Third-party API configurations

**Table:** `core.integrations`

---

## 6. API Enhancements

### 6.1 New Endpoints Needed

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/organisations` | GET | List organizations |
| `/api/v1/organisations/:id` | GET/PUT | Get/update organization |
| `/api/v1/sites` | GET | List sites |
| `/api/v1/sites/:id` | GET/PUT | Get/update site |
| `/api/v1/devices` | GET | List devices |
| `/api/v1/devices/:id` | GET/PUT | Get/update device |
| `/api/v1/passes` | GET | List passes with filters |
| `/api/v1/passes/:id` | GET/PUT | Get/update pass |
| `/api/v1/pass-types` | GET/POST | List/create pass types |
| `/api/v1/pass-types/:id` | GET/PUT/DELETE | CRUD pass type |
| `/api/v1/analytics/summary` | GET | Dashboard analytics |
| `/api/v1/audit-logs` | GET | Audit log listing |

---

## 7. Technical Considerations

### 7.1 Authentication & Authorization
- Current: Basic auth via Supabase
- Needed: Role-based access control (RBAC)
- Consider: Organization-scoped permissions

### 7.2 Performance
- Implement pagination for list views
- Add caching for dashboard stats
- Consider real-time updates via Supabase subscriptions

### 7.3 Mobile Responsiveness
- Dashboard should work on tablets
- Consider mobile-optimized views for field workers

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Admin task completion time | Reduce by 50% |
| Support tickets for data changes | Reduce by 70% |
| Pass management visibility | 100% of passes visible |
| Self-service configuration | 80% of changes via portal |

---

## 9. Implementation Roadmap

### Phase 1 (4-6 weeks)
- Organizations page
- Sites & Devices page
- Passes page
- Pass Types page

### Phase 2 (4-6 weeks)
- Analytics dashboard
- User management
- Settings page
- Audit logs

### Phase 3 (4-6 weeks)
- Access logs viewer
- Webhook management
- Reports & exports
- Integration management

---

## 10. Appendix

### A. Current File Structure

\`\`\`
app/
├── api/v1/
│   ├── cron/backup-codes/route.ts
│   └── webhooks/rooms/pin/route.ts
├── auth/
│   ├── error/page.tsx
│   ├── login/page.tsx
│   ├── sign-up/page.tsx
│   └── sign-up-success/page.tsx
├── dashboard/
│   ├── config-upload/page.tsx
│   ├── qr-generator/
│   │   ├── page.tsx
│   │   └── qr-generator-client.tsx
│   ├── layout.tsx
│   └── page.tsx
├── layout.tsx
└── page.tsx

lib/
├── backup-codes.ts
├── config.ts
├── config/pincode-settings.ts
├── db/site-settings.ts
├── schemas/tenant-config.ts
├── supabase/
│   ├── client.ts
│   ├── middleware.ts
│   └── server.ts
├── utils/
│   ├── excel-converter.ts
│   ├── id-generator.ts
│   ├── pdf-generator.ts
│   ├── qr-generator.ts
│   └── sql-generator.ts
└── validations/pass.ts
\`\`\`

### B. Environment Variables

\`\`\`
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_PWA_BASE_URL
ROOMS_WEBHOOK_SECRET
\`\`\`

### C. Related Systems

- **PWA (pass.zezamii.com):** Customer-facing pass purchase flow
- **Rooms:** External booking system that sends PIN codes
- **Stripe:** Payment processing
- **Supabase:** Database and authentication
