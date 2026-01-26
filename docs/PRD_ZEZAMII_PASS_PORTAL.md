# Product Requirements Document: Zezamii Pass Portal

**Version:** 1.0  
**Date:** January 2026  
**Status:** Living Document

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

#### Backup Code System
- Backup code pool management
- Site-level backup code mode configuration
- Cron job for code rotation

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

## 3. Recommended Enhancements

### 3.1 High Priority (Phase 1)

#### 3.1.1 Organizations Management Page
**Route:** `/dashboard/organisations`

**Features:**
- List all organizations with search/filter
- View organization details (name, slug, settings)
- Edit organization branding settings
- View sites within organization
- Toggle organization active status

**Why:** Currently no way to view/edit organizations in the portal.

---

#### 3.1.2 Sites & Devices Management Page
**Route:** `/dashboard/sites-devices`

**Features:**
- Hierarchical view: Organization > Site > Building > Floor > Device
- Device status overview (active, inactive, health)
- Edit device details (name, description, custom logo)
- View device QR readiness status
- Bulk device operations

**Why:** The sidebar shows "Sites & Devices" and "Organisations" but these pages don't exist.

---

#### 3.1.3 Passes Management Page
**Route:** `/dashboard/passes`

**Features:**
- List all passes with filters (status, date range, device)
- View pass details (purchaser, validity period, PIN code)
- Pass status management (activate, expire, cancel)
- View associated payments
- Search by email or vehicle plate

**Why:** No visibility into purchased passes or their status.

---

#### 3.1.4 Pass Types Management Page
**Route:** `/dashboard/pass-types`

**Features:**
- CRUD for pass types
- Configure pricing (amount, currency)
- Set duration (minutes/hours/days)
- Enable/disable pass types per device
- Preview pass type on PWA

**Why:** Pass types currently managed only via database.

---

### 3.2 Medium Priority (Phase 2)

#### 3.2.1 Analytics Dashboard
**Route:** `/dashboard/analytics`

**Features:**
- Pass sales overview (daily/weekly/monthly)
- Revenue by organization/site
- QR scan analytics
- Conversion rates (scan to purchase)
- Peak usage times

**Tables:** `analytics.qr_scans`, `pass.payments`, `pass.passes`

---

#### 3.2.2 User Management
**Route:** `/dashboard/users`

**Features:**
- List portal users
- Role management (admin, viewer)
- Invite new users
- Organization membership management

**Tables:** `core.users`, `core.org_members`

---

#### 3.2.3 Settings Page
**Route:** `/dashboard/settings`

**Features:**
- Organization branding (logo, colors)
- Email notification settings
- Webhook configurations
- API key management
- Default pass settings

---

#### 3.2.4 Audit Logs
**Route:** `/dashboard/audit`

**Features:**
- View all admin actions
- Filter by user, action type, date
- Export audit logs

**Table:** `core.audit_events`

---

### 3.3 Lower Priority (Phase 3)

#### 3.3.1 Access Logs Viewer
**Route:** `/dashboard/access-logs`

**Features:**
- View device access attempts
- Filter by success/failure
- Debug access issues

**Table:** `access.access_logs`

---

#### 3.3.2 Webhook Management
**Route:** `/dashboard/webhooks`

**Features:**
- Configure outbound webhooks
- View delivery history
- Retry failed deliveries

**Tables:** `events.webhook_subscriptions`, `events.webhook_deliveries`

---

#### 3.3.3 Reports & Exports
**Route:** `/dashboard/reports`

**Features:**
- Generate pass reports
- Export to CSV/PDF
- Scheduled report emails

---

#### 3.3.4 Integration Management
**Route:** `/dashboard/integrations`

**Features:**
- Rooms integration status
- Stripe Connect settings
- Third-party API configurations

**Table:** `core.integrations`

---

## 4. API Enhancements

### 4.1 New Endpoints Needed

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

## 5. Technical Considerations

### 5.1 Authentication & Authorization
- Current: Basic auth via Supabase
- Needed: Role-based access control (RBAC)
- Consider: Organization-scoped permissions

### 5.2 Performance
- Implement pagination for list views
- Add caching for dashboard stats
- Consider real-time updates via Supabase subscriptions

### 5.3 Mobile Responsiveness
- Dashboard should work on tablets
- Consider mobile-optimized views for field workers

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| Admin task completion time | Reduce by 50% |
| Support tickets for data changes | Reduce by 70% |
| Pass management visibility | 100% of passes visible |
| Self-service configuration | 80% of changes via portal |

---

## 7. Implementation Roadmap

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

## 8. Appendix

### A. Current File Structure

```
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
```

### B. Environment Variables

```
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_PWA_BASE_URL
ROOMS_WEBHOOK_SECRET
```

### C. Related Systems

- **PWA (pass.zezamii.com):** Customer-facing pass purchase flow
- **Rooms:** External booking system that sends PIN codes
- **Stripe:** Payment processing
- **Supabase:** Database and authentication
