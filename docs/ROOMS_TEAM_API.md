# Zezamii Pass Portal - Rooms Integration API

## Quick Reference

| Item | Value |
|------|-------|
| **Webhook URL** | `https://api-pass.zezamii.com/api/webhooks/rooms/pin` |
| **Auth Header** | `Authorization: Bearer <ROOMS_WEBHOOK_SECRET>` |
| **Methods** | `POST` (deliver PIN), `DELETE` (revoke PIN), `GET` (health check) |

---

## Integration Overview

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│   PWA    │                    │  Rooms   │                    │  Portal  │
│          │                    │   API    │                    │ Webhook  │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │  1. PENDING (prep lock)       │                               │
     │  ─────────────────────────>   │                               │
     │                               │                               │
     │  2. ACK                       │                               │
     │  <─────────────────────────   │                               │
     │                               │                               │
     │  ... user completes payment   │                               │
     │                               │                               │
     │  3. CONFIRMED (generate PIN)  │                               │
     │  ─────────────────────────>   │                               │
     │                               │                               │
     │                               │  4. POST webhook (PIN)        │
     │                               │  ─────────────────────────>   │
     │                               │                               │
     │                               │  5. 200 OK                    │
     │                               │  <─────────────────────────   │
     │                               │                               │
     ▼                               ▼                               ▼
```

### What Rooms Needs To Do

| Step | Trigger | Action |
|------|---------|--------|
| 1 | Receive PENDING from PWA | Prep the lock, store `reservationId` (pass UUID) |
| 2 | Receive CONFIRMED from PWA | Generate PIN, call Portal webhook |
| 3 | Receive CANCEL from PWA | Stop PIN generation, do NOT call webhook |

---

## Authentication

All webhook requests must include:

```
Authorization: Bearer <ROOMS_WEBHOOK_SECRET>
```

**Setup:** We will share the `ROOMS_WEBHOOK_SECRET` value with you securely. Configure it for your outbound webhook calls.

---

## POST - Deliver PIN Code

Call this endpoint after generating a PIN (when you receive CONFIRMED from PWA).

**Endpoint:** `POST https://api-pass.zezamii.com/api/webhooks/rooms/pin`

### Request Format (Choose One)

**Option A: Simple Flat Format**

```json
{
  "reservationId": "483876d8-0e8b-4d34-bef6-00240e89cc58",
  "pinCode": "4829",
  "validFrom": "2026-01-21T00:00:00Z",
  "validUntil": "2026-01-22T00:00:00Z"
}
```

**Option B: Nested Event Format**

```json
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
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reservationId` | UUID | Yes | The pass ID from PENDING/CONFIRMED call |
| `pinCode` | string | Yes | The generated PIN code |
| `validFrom` | ISO8601 | No | When PIN becomes valid |
| `validUntil` | ISO8601 | No | When PIN expires |

### Responses

**Success (200):**
```json
{
  "success": true,
  "message": "PIN code received and stored",
  "passId": "483876d8-0e8b-4d34-bef6-00240e89cc58"
}
```

**Idempotent (200) - Same PIN already set:**
```json
{
  "success": true,
  "message": "PIN code already set (no changes made)",
  "passId": "483876d8-0e8b-4d34-bef6-00240e89cc58",
  "idempotent": true
}
```

**Error (400):**
```json
{
  "error": "Bad Request",
  "message": "reservationId and pinCode are required"
}
```

**Unauthorized (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authorization"
}
```

---

## DELETE - Revoke PIN (Optional)

Call this if Rooms needs to revoke a previously delivered PIN.

**Endpoint:** `DELETE https://api-pass.zezamii.com/api/webhooks/rooms/pin`

### Request

```json
{
  "reservationId": "483876d8-0e8b-4d34-bef6-00240e89cc58",
  "reason": "user_cancelled"
}
```

### Reason Values

| Reason | Effect |
|--------|--------|
| `timeout` | Pass stays ACTIVE (backup code in use) |
| `backup_used` | Pass stays ACTIVE (backup code in use) |
| `payment_failed` | Pass set to CANCELLED |
| `user_cancelled` | Pass set to CANCELLED (default) |

### Response

```json
{
  "success": true,
  "message": "PIN code revoked and pass cancelled",
  "passId": "483876d8-0e8b-4d34-bef6-00240e89cc58",
  "reason": "user_cancelled",
  "passActive": false
}
```

---

## GET - Health Check

No authentication required. Use to verify the webhook is available.

**Endpoint:** `GET https://api-pass.zezamii.com/api/webhooks/rooms/pin`

**Response (200):**
```json
{
  "status": "ok",
  "service": "rooms-pin-webhook"
}
```

---

## Timeout / Cancellation Flow

If PWA sends CANCEL (e.g., user timeout waiting for PIN):

```
┌──────────┐                    ┌──────────┐
│   PWA    │                    │  Rooms   │
└────┬─────┘                    └────┬─────┘
     │                               │
     │  CANCEL (reason: timeout)     │
     │  ─────────────────────────>   │
     │                               │
     │                               │  Stop PIN generation
     │                               │  Do NOT call Portal webhook
     │                               │
     │  ACK                          │
     │  <─────────────────────────   │
     │                               │
     ▼                               ▼
```

**Important:** When you receive CANCEL, do NOT call the Portal webhook. The PWA will use a backup code instead.

---

## Idempotency

All endpoints are idempotent and safe to retry:

- **POST with same PIN:** Returns success with `idempotent: true`
- **DELETE on already revoked:** Returns success with `idempotent: true`

---

## Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | PIN stored/revoked |
| 400 | Bad request | Check payload format |
| 401 | Unauthorized | Check Bearer token |
| 404 | Not found | No lock_code exists (DELETE only) |
| 500 | Server error | Retry with backoff |

### Retry Strategy

For 5xx errors, retry with exponential backoff:
- 1st retry: 1 second
- 2nd retry: 2 seconds
- 3rd retry: 4 seconds
- Max retries: 3

---

## Testing

### Health Check
```bash
curl https://api-pass.zezamii.com/api/webhooks/rooms/pin
```

### Deliver PIN (Test)
```bash
curl -X POST https://api-pass.zezamii.com/api/webhooks/rooms/pin \
  -H "Authorization: Bearer <ROOMS_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "test-uuid-here",
    "pinCode": "1234",
    "validFrom": "2026-01-21T00:00:00Z",
    "validUntil": "2026-01-22T00:00:00Z"
  }'
```

---

## Checklist for Rooms Team

- [ ] Receive `ROOMS_WEBHOOK_SECRET` from Zezamii team
- [ ] Configure webhook URL: `https://api-pass.zezamii.com/api/webhooks/rooms/pin`
- [ ] Store `reservationId` from PENDING calls
- [ ] Call POST webhook after generating PIN (on CONFIRMED)
- [ ] Handle CANCEL - do NOT call webhook
- [ ] Implement retry logic for failed webhook calls
- [ ] Test health check endpoint
- [ ] Test PIN delivery with sample reservation

---

## Contact

For questions or issues with the webhook, contact the Zezamii Pass Portal team.
