# Rooms PIN Webhook API Documentation

## Quick Reference

| Item | Value |
|------|-------|
| **Production URL** | `https://api-pass.zezamii.com/api/webhooks/rooms/pin` |
| **Authentication** | Bearer Token |
| **Auth Header** | `Authorization: Bearer <ROOMS_WEBHOOK_SECRET>` |
| **Environment Variable** | `ROOMS_WEBHOOK_SECRET` (stored in Vercel) |

---

## Overall Logic Flow

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PASS PURCHASE FLOW                                │
│                    (Two-Phase: PENDING + CONFIRMED)                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │     │   PWA    │     │  Stripe  │     │  Rooms   │     │  Portal  │
│          │     │          │     │          │     │   API    │     │    DB    │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │  1. Select     │                │                │                │
     │     Pass       │                │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │                │  2. Create Pass (status=pending)                 │
     │                │─────────────────────────────────────────────────>│
     │                │                │                │                │
     │                │  3. Create Lock Code (code=NULL, status=pending) │
     │                │─────────────────────────────────────────────────>│
     │                │                │                │                │
     │                │                │                │                │
     │                │ ┌──────────────────────────────────────────────┐ │
     │                │ │  4. PARALLEL: Payment + Prep Lock            │ │
     │                │ └──────────────────────────────────────────────┘ │
     │                │                │                │                │
     │                │  4a. Create    │                │                │
     │                │  Payment Intent│                │                │
     │                │───────────────>│                │                │
     │                │                │                │                │
     │                │  4b. PENDING   │                │                │
     │                │  (prep lock,   │                │                │
     │                │  pass passId)  │                │                │
     │                │───────────────────────────────>│                │
     │                │                │                │                │
     │                │                │                │  4c. Rooms     │
     │                │                │                │  preps lock    │
     │                │                │                │  (no PIN yet)  │
     │                │                │                │                │
     │                │  4d. ACK       │                │                │
     │                │<───────────────────────────────│                │
     │                │                │                │                │
     │  5. Enter      │                │                │                │
     │     Payment    │                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     │  6. Confirm    │                │                │                │
     │     Payment    │                │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │                │  7. Confirm    │                │                │
     │                │  Payment Intent│                │                │
     │                │───────────────>│                │                │
     │                │                │                │                │
     │                │  8. Payment    │                │                │
     │                │  Success       │                │                │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │                │  9. CONFIRMED  │                │                │
     │                │  (payment done,│                │                │
     │                │  generate PIN) │                │                │
     │                │───────────────────────────────>│                │
     │                │                │                │                │
     │  10. Show      │                │                │                │
     │     "Getting   │                │                │                │
     │      PIN..."   │                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     │                │                │                │ 11. Generate   │
     │                │                │                │     PIN code   │
     │                │                │                │                │
     │                │                │  12. POST /api/webhooks/rooms/pin
     │                │                │                │───────────────>│
     │                │                │                │                │
     │                │                │                │ 13. Update     │
     │                │                │                │     lock_codes │
     │                │                │                │     (code=PIN, │
     │                │                │                │     status=    │
     │                │                │                │     active)    │
     │                │                │                │                │
     │                │                │                │ 14. Update     │
     │                │                │                │     passes     │
     │                │                │                │     (status=   │
     │                │                │                │     active)    │
     │                │                │                │                │
     │                │                │                │<───────────────│
     │                │                │                │ 15. 200 OK     │
     │                │                │                │                │
     │                │  16. Poll for PIN               │                │
     │                │─────────────────────────────────────────────────>│
     │                │                │                │                │
     │                │  17. Return PIN                 │                │
     │                │<─────────────────────────────────────────────────│
     │                │                │                │                │
     │  18. Display   │                │                │                │
     │      PIN       │                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     ▼                ▼                ▼                ▼                ▼
\`\`\`

### Flow Summary

| Phase | Step | Action |
|-------|------|--------|
| **Setup** | 1-3 | User selects pass, PWA creates pending pass and lock_code in Portal DB |
| **PENDING** | 4a-4d | PWA calls Stripe (payment intent) AND Rooms (PENDING) in parallel. Rooms preps the lock but does NOT generate PIN yet |
| **Payment** | 5-8 | User completes payment via Stripe |
| **CONFIRMED** | 9 | PWA calls Rooms with CONFIRMED status after payment success |
| **PIN Delivery** | 10-15 | Rooms generates PIN and calls Portal webhook to store it |
| **Display** | 16-18 | PWA polls Portal DB for PIN and displays to user |

---

## Timeout / Backup Code Flow

If the PIN is not received within the countdown timer (e.g., 30 seconds), the PWA uses a backup code and notifies Rooms to cancel the pending request.

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TIMEOUT / BACKUP CODE FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │     │   PWA    │     │  Rooms   │     │  Portal  │
│          │     │          │     │   API    │     │    DB    │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  (After CONFIRMED sent to Rooms)                │
     │                │                │                │
     │  1. Start      │                │                │
     │     countdown  │                │                │
     │     timer      │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │                │  2. Poll for PIN               │
     │                │─────────────────────────────────────────────────>│
     │                │                │                │                │
     │                │  3. No PIN yet (code=NULL)     │                │
     │                │<─────────────────────────────────────────────────│
     │                │                │                │
     │                │     ... timer continues ...    │
     │                │                │                │
     │  4. Timer      │                │                │
     │     expires!   │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │                │  5. CANCEL     │                │
     │                │  (reason=      │                │
     │                │  timeout)      │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │                │  6. Rooms     │
     │                │                │  cancels      │
     │                │                │  PIN gen      │
     │                │                │  (NO webhook) │
     │                │                │                │
     │                │  7. Fetch      │                │
     │                │  backup code   │                │
     │                │─────────────────────────────────────────────────>│
     │                │                │                │
     │                │  8. Backup code returned       │
     │                │<─────────────────────────────────────────────────│
     │                │                │                │
     │  9. Display    │                │                │
     │     backup     │                │                │
     │     code       │                │                │
     │<───────────────│                │                │
     │                │                │                │
     ▼                ▼                ▼                ▼
\`\`\`

### Timeout Flow Summary

| Step | Action |
|------|--------|
| 1-3 | PWA starts countdown timer and polls Portal DB for PIN |
| 4 | Timer expires without receiving PIN |
| 5 | PWA calls **Rooms API** CANCEL endpoint with `reason: "timeout"` |
| 6 | Rooms cancels pending PIN generation - **does NOT call Portal webhook** |
| 7-8 | PWA fetches backup code from Portal DB |
| 9 | User sees backup code instead of dynamic PIN |

**Important:** 
- PWA calls **Rooms API** (not Portal webhook) to cancel
- Rooms does NOT call Portal webhook when cancelled
- Pass remains **ACTIVE** so user can use backup code

---

## Authentication

All requests require Bearer token authentication:

\`\`\`
Authorization: Bearer <ROOMS_WEBHOOK_SECRET>
\`\`\`

### Configuration

| Party | Environment Variable | Description |
|-------|---------------------|-------------|
| **Portal (Vercel)** | `ROOMS_WEBHOOK_SECRET` | Stored in Vercel project environment variables |
| **Rooms API** | (configure as needed) | Must match the Portal secret exactly |

### Setup Steps

1. **Generate a secure secret** (e.g., `openssl rand -base64 32`)
2. **Portal**: Add `ROOMS_WEBHOOK_SECRET` to Vercel environment variables
3. **Rooms**: Configure the same secret for outbound webhook calls

---

## Endpoints

### POST - Deliver PIN Code

Creates or updates a PIN code for a pass. Supports two payload formats.

**Request (Flat Format - Simple):**

\`\`\`http
POST https://api-pass.zezamii.com/api/webhooks/rooms/pin
Authorization: Bearer <ROOMS_WEBHOOK_SECRET>
Content-Type: application/json

{
  "reservationId": "uuid-of-the-pass",
  "pinCode": "123456",
  "validFrom": "2026-01-21T10:00:00Z",
  "validUntil": "2026-01-21T23:59:00Z"
}
\`\`\`

**Request (Nested Event Format - From Rooms PRD):**

\`\`\`http
POST https://api-pass.zezamii.com/api/webhooks/rooms/pin
Authorization: Bearer <ROOMS_WEBHOOK_SECRET>
Content-Type: application/json

{
  "event": "pin.created",
  "timestamp": "2026-01-21T10:30:00Z",
  "data": {
    "reservationId": "483876d8-0e8b-4d34-bef6-00240e89cc58",
    "propertyId": "02140c92-06b9-4967-9cb3-fcea633339ed",
    "roomId": "8b2299fe-05cf-4432-97d8-a7a97714127a",
    "pinCode": "4829",
    "validFrom": "2026-01-21T00:00:00Z",
    "validUntil": "2026-01-22T00:00:00Z",
    "guestName": "John Smith"
  }
}
\`\`\`

**Request Fields (Flat Format):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reservationId` | string (UUID) | Yes | The pass ID from the initial booking |
| `pinCode` | string | Yes | The PIN code for the lock |
| `validFrom` | ISO8601 datetime | No | When PIN becomes valid (maps to `starts_at`) |
| `validUntil` | ISO8601 datetime | No | When PIN expires (maps to `ends_at`) |

**Request Fields (Nested Event Format):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | Yes | Must be `"pin.created"` |
| `timestamp` | ISO8601 datetime | No | When event was generated |
| `data.reservationId` | string (UUID) | Yes | The pass ID |
| `data.pinCode` | string | Yes | The PIN code |
| `data.validFrom` | ISO8601 datetime | No | When PIN becomes valid |
| `data.validUntil` | ISO8601 datetime | No | When PIN expires |
| `data.propertyId` | string | No | Rooms property ID |
| `data.roomId` | string | No | Rooms room ID |
| `data.guestName` | string | No | Guest name (for logging) |

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Success - PIN stored |
| `400` | Bad request - missing required fields |
| `401` | Unauthorized - invalid or missing token |
| `500` | Server error |

**Success Response (new/updated PIN):**

\`\`\`json
{
  "success": true,
  "message": "PIN code received and stored",
  "passId": "uuid-of-the-pass"
}
\`\`\`

**Idempotent Response (PIN already set with same value):**

\`\`\`json
{
  "success": true,
  "message": "PIN code already set (no changes made)",
  "passId": "uuid-of-the-pass",
  "idempotent": true
}
\`\`\`

**Error Response:**

\`\`\`json
{
  "error": "Bad Request",
  "message": "reservationId and pinCode are required"
}
\`\`\`

---

### DELETE - Cancel/Revoke PIN Request

Cancels a pending PIN request or revokes an existing PIN. The `reason` field determines whether the pass stays active or gets cancelled.

**Request:**

\`\`\`http
DELETE https://api-pass.zezamii.com/api/webhooks/rooms/pin
Authorization: Bearer <ROOMS_WEBHOOK_SECRET>
Content-Type: application/json

{
  "reservationId": "uuid-of-the-pass",
  "reason": "timeout"
}
\`\`\`

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reservationId` | string (UUID) | Yes | The pass ID to cancel/revoke |
| `reason` | string | No | Reason for cancellation (see below) |

**Reason Values:**

| Reason | Pass Status | Description |
|--------|-------------|-------------|
| `timeout` | Stays **ACTIVE** | PIN not received in time, using backup code |
| `backup_used` | Stays **ACTIVE** | User chose to use backup code |
| `payment_failed` | Set to **CANCELLED** | Stripe payment failed |
| `user_cancelled` | Set to **CANCELLED** | User cancelled the purchase (default) |

**Responses:**

| Status | Description |
|--------|-------------|
| `200` | Success - PIN request cancelled/revoked |
| `400` | Bad request - missing reservationId |
| `401` | Unauthorized - invalid or missing token |
| `404` | No PIN found (only for payment_failed/user_cancelled) |
| `500` | Server error |

**Success Response (timeout/backup - pass stays active):**

\`\`\`json
{
  "success": true,
  "message": "PIN request cancelled (backup code in use)",
  "passId": "uuid-of-the-pass",
  "reason": "timeout",
  "passActive": true
}
\`\`\`

**Success Response (cancellation - pass cancelled):**

\`\`\`json
{
  "success": true,
  "message": "PIN code revoked and pass cancelled",
  "passId": "uuid-of-the-pass",
  "reason": "user_cancelled",
  "passActive": false
}
\`\`\`

**Idempotent Response (already revoked):**

\`\`\`json
{
  "success": true,
  "message": "PIN already revoked (no changes made)",
  "passId": "uuid-of-the-pass",
  "idempotent": true
}
\`\`\`

---

### GET - Health Check

Simple health check endpoint to verify the webhook is available. No authentication required.

**Request:**

\`\`\`http
GET https://api-pass.zezamii.com/api/webhooks/rooms/pin
\`\`\`

**Response:** `200 OK`

\`\`\`json
{
  "status": "ok",
  "service": "rooms-pin-webhook"
}
\`\`\`

---

## Database Schema

**Important:** All tables are in the `pass` schema (e.g., `pass.lock_codes`, `pass.passes`).

### `pass.lock_codes` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `pass_id` | UUID | Foreign key to `pass.passes` |
| `code` | TEXT | The PIN code (NULL when pending) |
| `code_hmac` | TEXT | HMAC for verification (optional) |
| `status` | TEXT | `pending`, `active`, `used`, `expired`, `revoked` |
| `provider` | TEXT | Source of the PIN: `"rooms"` or `"backup"` |
| `provider_ref` | TEXT | External reference (e.g., Rooms reservation ID) |
| `starts_at` | TIMESTAMPTZ | When PIN becomes valid |
| `ends_at` | TIMESTAMPTZ | When PIN expires |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `used_at` | TIMESTAMPTZ | When PIN was used |
| `attempt_count` | INTEGER | Number of unlock attempts |

### `pass.passes` Table (relevant fields)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (this is the `reservationId`) |
| `status` | ENUM | `pending`, `active`, `expired`, `cancelled`, `refunded` |
| `pass_type_id` | UUID | Foreign key to `pass.pass_types` |
| `site_id` | UUID | Foreign key to `core.sites` |
| `device_id` | UUID | Foreign key to `core.devices` (optional) |
| `valid_from` | TIMESTAMPTZ | When pass becomes valid |
| `valid_to` | TIMESTAMPTZ | When pass expires |
| `purchaser_email` | TEXT | Email of the purchaser |

### `pass.backup_pincodes` Table (for fallback codes)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `site_id` | UUID | Foreign key to `core.sites` |
| `device_id` | UUID | Foreign key to `core.devices` (optional) |
| `pincode` | VARCHAR | The backup PIN code |
| `fortnight_number` | INTEGER | Which fortnight this code is valid for |
| `period_start` | TIMESTAMPTZ | Start of validity period |
| `period_end` | TIMESTAMPTZ | End of validity period |

---

## Idempotency

All endpoints are fully idempotent:

- **POST**: If called multiple times with the same `reservationId` and `pinCode`, returns success without modifying data or timestamps.
- **DELETE**: If called multiple times for an already-revoked PIN, returns success without side effects.

This makes it safe to retry requests on network failures.

---

## Error Handling

| HTTP Status | Error Type | When |
|-------------|------------|------|
| `400` | Bad Request | Missing required fields |
| `401` | Unauthorized | Missing or invalid `Authorization` header |
| `404` | Not Found | No lock_code exists for DELETE operation |
| `500` | Server Error | Database or unexpected errors |

---

## Who Calls What

| Caller | Endpoint | When |
|--------|----------|------|
| **PWA -> Rooms** | `POST <rooms-api>/pending` | After Stripe payment intent created (parallel) |
| **PWA -> Rooms** | `POST <rooms-api>/confirmed` | After Stripe payment success |
| **PWA -> Rooms** | `DELETE <rooms-api>/cancel` | On timeout or user cancellation |
| **Rooms -> Portal** | `POST https://api-pass.zezamii.com/api/webhooks/rooms/pin` | After generating PIN (this webhook) |
| **Rooms -> Portal** | `DELETE https://api-pass.zezamii.com/api/webhooks/rooms/pin` | If Rooms needs to revoke a PIN |

---

## Integration Checklist

### Rooms API Responsibilities
- [ ] Accept PENDING call from PWA - prep lock, store `reservationId` (pass UUID)
- [ ] Accept CONFIRMED call from PWA - generate PIN and call Portal POST webhook
- [ ] Accept CANCEL call from PWA - stop PIN generation, do NOT call webhook
- [ ] Call Portal POST webhook with PIN after generation
- [ ] Handle retries gracefully (webhook is idempotent)

### Portal Webhook (This Document)
- [x] Endpoint deployed: `https://api-pass.zezamii.com/api/webhooks/rooms/pin`
- [x] Environment variable configured: `ROOMS_WEBHOOK_SECRET` in Vercel
- [ ] Share `ROOMS_WEBHOOK_SECRET` value with Rooms team
- [ ] Rooms team configures the same secret for outbound calls

### Test Scenarios
- [ ] Happy path: PENDING -> CONFIRMED -> PIN webhook -> PWA displays PIN
- [ ] Timeout path: PENDING -> CONFIRMED -> PWA timeout -> PWA calls Rooms CANCEL -> backup code used
- [ ] Payment failed: PENDING -> Payment fails -> PWA calls Rooms CANCEL -> no PIN generated

---

## PWA Implementation Guide

This section is for the **PWA developer** implementing the pass purchase flow.

### Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| **PIN Polling Interval** | 2 seconds | How often to check for PIN |
| **Countdown Timer** | 30 seconds | Time before falling back to backup code |
| **Max Poll Attempts** | 15 | 30s / 2s = 15 attempts |

### Step-by-Step Implementation

#### Step 1: Create Pending Pass and Lock Code

When user selects a pass, create records in Portal DB.

**Important:** Use `.schema('pass')` to access the pass schema tables.

\`\`\`javascript
// Create pending pass
const { data: pass, error: passError } = await supabase
  .schema('pass')
  .from('passes')
  .insert({
    pass_type_id: selectedPassType.id,
    site_id: siteId,
    status: 'pending',
    valid_from: startDate,
    valid_to: endDate,  // Note: column is valid_to, not valid_until
    // ... other pass fields
  })
  .select()
  .single()

// Create pending lock_code (code=NULL, status=pending)
// Note: Column names are starts_at/ends_at, not valid_from/valid_until
const { data: lockCode, error: lockCodeError } = await supabase
  .schema('pass')
  .from('lock_codes')
  .insert({
    pass_id: pass.id,
    status: 'pending',
    provider: 'rooms',           // Required: identifies PIN source
    provider_ref: pass.id,       // Optional: external reference
    starts_at: startDate,        // Note: starts_at, not valid_from
    ends_at: endDate,            // Note: ends_at, not valid_until
  })
  .select()
  .single()
\`\`\`

#### Step 2: Call Stripe and Rooms in Parallel

\`\`\`javascript
// Call both in parallel
const [stripeResult, roomsResult] = await Promise.all([
  // Stripe: Create payment intent
  createPaymentIntent({
    amount: passPrice,
    currency: 'aud',
    metadata: { pass_id: pass.id }
  }),
  
  // Rooms: Send PENDING request
  fetch(`${ROOMS_API_URL}/pending`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId: pass.id,  // Pass UUID
      lockId: device.lock_id,   // Lock device ID
      validFrom: startDate,
      validUntil: endDate,
    })
  })
])
\`\`\`

#### Step 3: Process Payment

\`\`\`javascript
// Show payment form to user
// ... Stripe Elements or Payment Sheet

// On payment success
const { paymentIntent, error } = await stripe.confirmPayment(...)

if (error) {
  // Payment failed - cancel Rooms request
  await fetch(`${ROOMS_API_URL}/cancel`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId: pass.id,
      reason: 'payment_failed'
    })
  })
  
  // Update pass status
  await supabase
    .from('passes')
    .update({ status: 'cancelled' })
    .eq('id', pass.id)
    
  return { success: false, error: 'Payment failed' }
}
\`\`\`

#### Step 4: Send CONFIRMED to Rooms

\`\`\`javascript
// Payment successful - tell Rooms to generate PIN
await fetch(`${ROOMS_API_URL}/confirmed`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reservationId: pass.id,
    paymentIntentId: paymentIntent.id,
  })
})
\`\`\`

#### Step 5: Poll for PIN with Countdown

\`\`\`javascript
const POLL_INTERVAL = 2000  // 2 seconds
const TIMEOUT = 30000       // 30 seconds

async function pollForPin(passId) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < TIMEOUT) {
    // Check for PIN in pass.lock_codes
    const { data: lockCode } = await supabase
      .schema('pass')
      .from('lock_codes')
      .select('code, status')
      .eq('pass_id', passId)
      .eq('provider', 'rooms')  // Only check Rooms provider
      .maybeSingle()
    
    // PIN received!
    if (lockCode?.code && lockCode.status === 'active') {
      return { success: true, pin: lockCode.code }
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
    
    // Update countdown UI
    const remaining = Math.ceil((TIMEOUT - (Date.now() - startTime)) / 1000)
    updateCountdownUI(remaining)
  }
  
  // Timeout - use backup code
  return { success: false, timeout: true }
}
\`\`\`

#### Step 6: Handle Timeout - Use Backup Code

\`\`\`javascript
const result = await pollForPin(pass.id)

if (result.success) {
  // Display dynamic PIN
  showPinToUser(result.pin)
} else {
  // Timeout - cancel Rooms and use backup
  await fetch(`${ROOMS_API_URL}/cancel`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationId: pass.id,
      reason: 'timeout'
    })
  })
  
  // Get backup code from pass.backup_pincodes table
  // Backup codes rotate every fortnight
  const now = new Date()
  const { data: backupCode } = await supabase
    .schema('pass')
    .from('backup_pincodes')
    .select('pincode')
    .eq('site_id', siteId)
    .lte('period_start', now.toISOString())
    .gte('period_end', now.toISOString())
    .maybeSingle()
  
  // Display backup code
  showBackupCodeToUser(backupCode?.pincode || 'Contact support')
}
\`\`\`

### Complete Flow Code

\`\`\`javascript
async function purchasePass(passTypeId, siteId, deviceId, startDate, endDate) {
  try {
    // 1. Create pending pass (note: valid_to, not valid_until)
    const { data: pass } = await supabase
      .schema('pass')
      .from('passes')
      .insert({ pass_type_id: passTypeId, site_id: siteId, status: 'pending', valid_from: startDate, valid_to: endDate })
      .select()
      .single()
    
    // 2. Create pending lock_code (note: starts_at/ends_at, provider required)
    await supabase
      .schema('pass')
      .from('lock_codes')
      .insert({ pass_id: pass.id, status: 'pending', provider: 'rooms', provider_ref: pass.id, starts_at: startDate, ends_at: endDate })
    
    // 3. Parallel: Stripe + Rooms PENDING
    const [paymentIntent, roomsAck] = await Promise.all([
      createStripePaymentIntent(pass.id, passPrice),
      sendRoomsPending(pass.id, deviceId, startDate, endDate)
    ])
    
    // 4. Collect payment (show UI, wait for user)
    const paymentResult = await collectPayment(paymentIntent)
    
    if (!paymentResult.success) {
      await cancelRoomsRequest(pass.id, 'payment_failed')
      await updatePassStatus(pass.id, 'cancelled')
      throw new Error('Payment failed')
    }
    
    // 5. Send CONFIRMED to Rooms
    await sendRoomsConfirmed(pass.id, paymentIntent.id)
    
    // 6. Poll for PIN with countdown
    showLoadingWithCountdown(30)
    const pinResult = await pollForPin(pass.id)
    
    if (pinResult.success) {
      // Got dynamic PIN
      return { success: true, pin: pinResult.pin, type: 'dynamic' }
    } else {
      // Timeout - use backup
      await cancelRoomsRequest(pass.id, 'timeout')
      const backupCode = await getBackupCode(siteId)
      return { success: true, pin: backupCode, type: 'backup' }
    }
    
  } catch (error) {
    console.error('Pass purchase failed:', error)
    throw error
  }
}
\`\`\`

### Error Handling Summary

| Scenario | Action |
|----------|--------|
| Pass/lock_code creation fails | Show error, don't proceed |
| Rooms PENDING fails | Continue with payment (can retry later) |
| Payment fails | Call Rooms CANCEL, update pass to cancelled |
| Rooms CONFIRMED fails | Retry, or fallback to backup code |
| PIN poll timeout | Call Rooms CANCEL, use backup code |
| Network error during poll | Retry poll, show offline message |

### UI States

| State | Display |
|-------|---------|
| Creating pass | "Setting up your pass..." |
| Payment | Stripe payment form |
| Waiting for PIN | "Getting your PIN..." with countdown timer |
| PIN received | Large PIN display with copy button |
| Backup code | Backup PIN with note explaining fallback |
| Error | Error message with retry option |
