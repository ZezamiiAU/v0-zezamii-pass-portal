# Zezamii Pass - Onboarding Requirements

This document outlines all data required to onboard a new Organisation, Site, and Device (Space/Room) for the Zezamii Pass PWA system, including QR code generation and URL routing.

---

## Table of Contents

1. [Data Hierarchy Overview](#data-hierarchy-overview)
2. [Organisation Setup](#1-organisation-setup)
3. [Site Setup](#2-site-setup)
4. [Device/Space Setup](#3-devicespace-setup)
5. [Pass Profile Setup](#4-pass-profile-setup)
6. [Pass Type Setup](#5-pass-type-setup)
7. [URL Slug Setup](#6-url-slug-setup)
8. [QR Code Generation](#7-qr-code-generation)
9. [Column Name Mapping (Portal vs PWA)](#8-column-name-mapping-portal-vs-pwa)
10. [Example Onboarding Workflow](#9-example-onboarding-workflow)

---

## Data Hierarchy Overview

```
Organisation (core.organisations)
    └── Site (core.sites)
            ├── Building (core.buildings) [optional]
            │       └── Floor (core.floors) [optional]
            │               └── Area (core.areas) [optional]
            └── Device/Space (core.devices)
                    ├── Pass Profile (pass.pass_profiles) - linked via site_id
                    ├── Pass Type (pass.pass_types) - linked via profile_id
                    ├── URL Slug (pass.accesspoint_slugs) - for PWA routing
                    └── QR Pass (core.qr_passes) - for QR code generation
```

---

## 1. Organisation Setup

**Table:** `core.organisations`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | uuid | Auto | Primary key | `24c59fda-8550-...` |
| `name` | text | Yes | Organisation display name | `"Acme Parking"` |
| `slug` | text | Yes | URL-safe identifier (unique) | `"acme-parking"` |
| `billing_email` | text | Yes | Primary contact email | `"billing@acme.com"` |
| `timezone` | text | Yes | Default timezone | `"Australia/Brisbane"` |
| `locale` | text | Yes | Locale for formatting | `"en-AU"` |
| `brand_settings` | jsonb | No | Branding configuration | See below |
| `account_number` | text | Yes | Unique account number | `"ACC-001234"` |

### Brand Settings Structure

```json
{
  "logo_url": "https://storage.example.com/orgs/acme/logo.png",
  "hero_image_url": "https://storage.example.com/orgs/acme/hero.jpg",
  "primary_color": "#001F3F",
  "secondary_color": "#d4af37",
  "favicon_url": "https://storage.example.com/orgs/acme/favicon.ico"
}
```

**Storage Location for Images:** Supabase Storage bucket `org-assets/{org_id}/`

---

## 2. Site Setup

**Table:** `core.sites`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | uuid | Auto | Primary key | `uuid` |
| `org_id` | uuid | Yes | FK to organisations | `uuid` |
| `name` | text | Yes | Site display name | `"Brisbane CBD Car Park"` |
| `slug` | text | Yes | URL-safe identifier | `"brisbane-cbd"` |
| `timezone` | text | Yes | Site-specific timezone | `"Australia/Brisbane"` |
| `address` | text | No | Street address | `"123 Queen St"` |
| `city` | text | No | City | `"Brisbane"` |
| `state` | text | No | State/Province | `"QLD"` |
| `postal_code` | text | No | Postal/ZIP code | `"4000"` |
| `country` | text | No | Country | `"Australia"` |
| `backup_code_mode` | text | No | Backup code rotation | `"fortnightly"` or `"daily"` |

---

## 3. Device/Space Setup

**Table:** `core.devices`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | uuid | Auto | Primary key | `uuid` |
| `org_id` | uuid | Yes | FK to organisations | `uuid` |
| `site_id` | uuid | Yes | FK to sites | `uuid` |
| `name` | text | Yes | Device/space name | `"Level 1 Entry Gate"` |
| `slug` | text | Yes | URL-safe identifier | `"level-1-entry"` |
| `category` | text | Yes | Device category | `"gate"`, `"room"`, `"parking"` |
| `status` | text | Yes | Active status | `"active"` |
| `slug_is_active` | boolean | Yes | Enable URL access | `true` |
| `custom_name` | text | No | Override display name | `"VIP Entrance"` |
| `custom_description` | text | No | Custom description | `"Premium parking access"` |
| `custom_logo_url` | text | No | Device-specific logo | `"https://..."` |
| `qr_instance_id` | uuid | Auto | Unique QR identifier | `uuid` (auto-generated) |
| `zezamii_room_id` | text | No | External Zezamii ID | `"room_abc123"` |

### Device Metadata Structure (optional)

```json
{
  "capacity": 50,
  "amenities": ["wheelchair_access", "ev_charging"],
  "operating_hours": {
    "monday": { "open": "06:00", "close": "22:00" },
    "tuesday": { "open": "06:00", "close": "22:00" }
  }
}
```

---

## 4. Pass Profile Setup

**Table:** `pass.pass_profiles`

| Field | Type | Required | Description | Portal Name | PWA Name |
|-------|------|----------|-------------|-------------|----------|
| `id` | uuid | Auto | Primary key | - | - |
| `site_id` | uuid | Yes | FK to sites | - | - |
| `code` | text | Yes | Unique profile code | `code` | `code` |
| `name` | text | Yes | Display name | `name` | `name` |
| `profile_type` | text | Yes | Profile type | `profile_type` | `profile_type` |
| `duration_minutes` | integer | No | Fixed duration | `duration_minutes` | `duration_minutes` |
| `duration_options` | jsonb | No | Duration choices | `duration_options` | `duration_options` |
| `checkout_time` | time | No | Daily checkout time | `checkout_time` | `cutoff_time` (alias) |
| `entry_buffer_minutes` | integer | No | Early entry buffer | `entry_buffer_minutes` | `buffer_before_minutes` |
| `exit_buffer_minutes` | integer | No | Late exit buffer | `exit_buffer_minutes` | `buffer_after_minutes` |
| `reset_buffer_minutes` | integer | No | Reset between bookings | `reset_buffer_minutes` | `reset_buffer_minutes` |
| `required_inputs` | jsonb | No | Required form fields | `required_inputs` | `required_inputs` |
| `future_booking_enabled` | boolean | No | Allow advance booking | `future_booking_enabled` | `future_booking_enabled` |
| `availability_enforcement` | boolean | No | Check availability | `availability_enforcement` | `availability_enforcement` |

### Profile Types

| Type | Description | Use Case |
|------|-------------|----------|
| `instant` | Immediate access, fixed duration | Hourly parking |
| `date_select` | User selects date, checkout time applies | Overnight parking |
| `date_range` | User selects date range | Multi-day stays |
| `nights` | User selects number of nights | Hotel parking |

### Duration Options Structure

```json
[
  { "label": "1 Hour", "minutes": 60, "price_cents": 500 },
  { "label": "2 Hours", "minutes": 120, "price_cents": 800 },
  { "label": "All Day", "minutes": 720, "price_cents": 2000 }
]
```

### Required Inputs Options

```json
["email", "vehicle_plate", "phone", "name", "date", "nights"]
```

---

## 5. Pass Type Setup

**Table:** `pass.pass_types`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | uuid | Auto | Primary key | `uuid` |
| `org_id` | uuid | Yes | FK to organisations | `uuid` |
| `profile_id` | uuid | No | FK to pass_profiles | `uuid` |
| `code` | text | Yes | Unique type code | `"hourly-parking"` |
| `name` | text | Yes | Display name | `"Hourly Parking Pass"` |
| `description` | text | No | Description | `"Pay per hour..."` |
| `price_cents` | integer | Yes | Price in cents | `500` (= $5.00) |
| `currency` | text | Yes | Currency code | `"aud"` |
| `duration_minutes` | integer | Yes | Pass duration | `60` |
| `is_active` | boolean | Yes | Active status | `true` |

---

## 6. URL Slug Setup

**Table:** `pass.accesspoint_slugs`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | uuid | Auto | Primary key | `uuid` |
| `slug` | text | Yes | Full URL slug (unique) | `"acme-parking/brisbane-cbd/level-1-entry"` |
| `org_slug` | text | Yes | Organisation slug | `"acme-parking"` |
| `site_slug` | text | Yes | Site slug | `"brisbane-cbd"` |
| `accesspoint_slug` | text | Yes | Device/accesspoint slug | `"level-1-entry"` |
| `org_id` | uuid | Yes | FK to organisations | `uuid` |
| `site_id` | uuid | Yes | FK to sites | `uuid` |
| `device_id` | uuid | Yes | FK to devices | `uuid` |
| `is_active` | boolean | Yes | Enable URL | `true` |

### URL Structure

```
https://pass.zezamii.com/{org_slug}/{site_slug}/{accesspoint_slug}
https://pass.zezamii.com/acme-parking/brisbane-cbd/level-1-entry
```

---

## 7. QR Code Generation

**Table:** `core.qr_passes` (for multiple QR codes per device)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | uuid | Auto | Primary key | `uuid` |
| `device_id` | uuid | Yes | FK to devices | `uuid` |
| `qr_instance_id` | uuid | Auto | Unique QR identifier | `uuid` |
| `pass_label` | text | No | Label for this QR | `"Main Entrance"` |
| `is_active` | boolean | Yes | Active status | `true` |

### QR Code URL Format

```
https://pass.zezamii.com/{org_slug}/{site_slug}/{device_slug}?qr={qr_instance_id}
```

### QR Code Generation Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| Size | QR code dimensions | 300x300px |
| Error Correction | Error correction level | "M" (15%) |
| Format | Output format | PNG, SVG |
| Logo Overlay | Optional center logo | From org brand_settings |

---

## 8. Column Name Mapping (Portal vs PWA)

| Portal/DB Column | PWA Expected Name | Notes |
|------------------|-------------------|-------|
| `entry_buffer_minutes` | `buffer_before_minutes` | PWA should use DB column |
| `exit_buffer_minutes` | `buffer_after_minutes` | PWA should use DB column |
| `checkout_time` | `cutoff_time` | PWA should use DB column |
| `reset_buffer_minutes` | `reset_buffer_minutes` | Same |

**Recommendation:** PWA should update queries to use the actual database column names.

---

## 9. Example Onboarding Workflow

### Step 1: Create Organisation

```sql
INSERT INTO core.organisations (name, slug, billing_email, timezone, locale, account_number, brand_settings)
VALUES (
  'Acme Parking',
  'acme-parking',
  'billing@acme.com',
  'Australia/Brisbane',
  'en-AU',
  'ACC-001234',
  '{"primary_color": "#001F3F", "secondary_color": "#d4af37"}'
);
```

### Step 2: Upload Branding Assets

Upload to Supabase Storage:
- `org-assets/{org_id}/logo.png`
- `org-assets/{org_id}/hero.jpg`

Update organisation with URLs:
```sql
UPDATE core.organisations
SET brand_settings = brand_settings || '{"logo_url": "https://...", "hero_image_url": "https://..."}'
WHERE id = '{org_id}';
```

### Step 3: Create Site

```sql
INSERT INTO core.sites (org_id, name, slug, timezone, address, city, state, postal_code, country)
VALUES (
  '{org_id}',
  'Brisbane CBD Car Park',
  'brisbane-cbd',
  'Australia/Brisbane',
  '123 Queen St',
  'Brisbane',
  'QLD',
  '4000',
  'Australia'
);
```

### Step 4: Create Pass Profile

```sql
INSERT INTO pass.pass_profiles (
  site_id, code, name, profile_type,
  duration_minutes, checkout_time,
  entry_buffer_minutes, exit_buffer_minutes, reset_buffer_minutes,
  required_inputs, future_booking_enabled, availability_enforcement
)
VALUES (
  '{site_id}',
  'overnight-parking',
  'Overnight Parking',
  'date_select',
  NULL,
  '10:00:00',
  30,
  30,
  15,
  '["email", "vehicle_plate", "date"]',
  true,
  true
);
```

### Step 5: Create Device/Space

```sql
INSERT INTO core.devices (
  org_id, site_id, name, slug, category, status, slug_is_active
)
VALUES (
  '{org_id}',
  '{site_id}',
  'Level 1 Entry Gate',
  'level-1-entry',
  'gate',
  'active',
  true
);
```

### Step 6: Create URL Slug

```sql
INSERT INTO pass.accesspoint_slugs (
  slug, org_slug, site_slug, accesspoint_slug,
  org_id, site_id, device_id, is_active
)
VALUES (
  'acme-parking/brisbane-cbd/level-1-entry',
  'acme-parking',
  'brisbane-cbd',
  'level-1-entry',
  '{org_id}',
  '{site_id}',
  '{device_id}',
  true
);
```

### Step 7: Create Pass Type (Product)

```sql
INSERT INTO pass.pass_types (
  org_id, profile_id, code, name, description,
  price_cents, currency, duration_minutes, is_active
)
VALUES (
  '{org_id}',
  '{profile_id}',
  'overnight-parking',
  'Overnight Parking Pass',
  'Park overnight with checkout by 10am',
  2500,
  'aud',
  720,
  true
);
```

### Step 8: Generate QR Code

The QR code URL will be:
```
https://pass.zezamii.com/acme-parking/brisbane-cbd/level-1-entry
```

Or with QR instance ID:
```
https://pass.zezamii.com/acme-parking/brisbane-cbd/level-1-entry?qr={qr_instance_id}
```

---

## Data Dependencies Summary

| Step | Table | Depends On |
|------|-------|------------|
| 1 | `core.organisations` | None |
| 2 | Storage (brand assets) | Organisation |
| 3 | `core.sites` | Organisation |
| 4 | `pass.pass_profiles` | Site |
| 5 | `core.devices` | Organisation, Site |
| 6 | `pass.accesspoint_slugs` | Organisation, Site, Device |
| 7 | `pass.pass_types` | Organisation, Pass Profile |
| 8 | QR Code Generation | Device (uses qr_instance_id) |

---

## Image Storage Locations

| Asset Type | Storage Path | Used By |
|------------|--------------|---------|
| Org Logo | `org-assets/{org_id}/logo.png` | PWA header, receipts |
| Org Hero | `org-assets/{org_id}/hero.jpg` | PWA checkout page |
| Device Logo | `device-assets/{device_id}/logo.png` | Device-specific branding |
| QR Code | Generated on-demand | Portal download, print |

---

## API Endpoints Required

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/orgs` | POST | Create organisation |
| `/api/v1/orgs/{id}/branding` | POST | Upload branding images |
| `/api/v1/sites` | POST | Create site |
| `/api/v1/devices` | POST | Create device |
| `/api/v1/pass-profiles` | POST | Create pass profile |
| `/api/v1/pass-types` | POST | Create pass type |
| `/api/v1/slugs` | POST | Create URL slug |
| `/api/v1/qr-generator` | GET | Generate QR code |

---

## Checklist for New Onboarding

- [ ] Organisation created with unique slug
- [ ] Brand settings configured (colors)
- [ ] Logo uploaded to storage
- [ ] Hero image uploaded to storage
- [ ] Site created with timezone
- [ ] Pass profile(s) created for site
- [ ] Device/space created with slug
- [ ] URL slug registered in accesspoint_slugs
- [ ] Pass type(s) created and linked to profile
- [ ] QR code generated and tested
- [ ] PWA URL tested end-to-end
