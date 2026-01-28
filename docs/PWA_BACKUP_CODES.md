# PWA Backup Code Implementation Guide

## Overview

The backup code system supports two modes:

| Mode | Table | Description |
|------|-------|-------------|
| `fortnightly` | `pass.backup_pincodes` | Legacy: static codes that rotate every 2 weeks |
| `pool` | `pass.backup_code_pool` | New: dynamic daily pool with category-based codes |

**Default:** `fortnightly` (no changes needed for existing behavior)

---

## Configuration

### Environment Variable (Optional)

Add to PWA `.env`:

\`\`\`
BACKUP_CODE_MODE=fortnightly
\`\`\`

This is the fallback if a site doesn't have an explicit setting. Leave unset or set to `fortnightly` to keep current behavior.

### Mode Priority

1. Site setting in `core.sites.backup_code_mode` (highest)
2. `BACKUP_CODE_MODE` env var
3. Falls back to `"fortnightly"`

---

## Implementation

### Step 1: Get Backup Code Mode

\`\`\`javascript
async function getBackupCodeMode(supabase, siteId) {
  // Check site-level setting
  const { data: site } = await supabase
    .schema('core')
    .from('sites')
    .select('backup_code_mode')
    .eq('id', siteId)
    .maybeSingle()

  return site?.backup_code_mode 
    || process.env.BACKUP_CODE_MODE 
    || 'fortnightly'
}
\`\`\`

### Step 2: Get Backup Code (Fortnightly Mode)

\`\`\`javascript
async function getFortnightlyBackupCode(supabase, siteId, deviceId) {
  const now = new Date().toISOString()

  let query = supabase
    .schema('pass')
    .from('backup_pincodes')
    .select('pincode, period_end')
    .eq('site_id', siteId)
    .lte('period_start', now)
    .gte('period_end', now)

  if (deviceId) {
    query = query.eq('device_id', deviceId)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    return { success: false, error: 'No backup code available' }
  }

  return {
    success: true,
    code: data.pincode,
    expiresAt: data.period_end,
    mode: 'fortnightly'
  }
}
\`\`\`

### Step 3: Get Backup Code (Pool Mode)

Pool mode uses a waterfall: tries shortest validity first (day pass), falls back to longer (camping).

\`\`\`javascript
const CATEGORY_PRIORITY = ['day', 'camping_3d', 'camping_7d', 'camping_14d']

async function assignBackupCodeFromPool(supabase, passId, deviceId) {
  const now = new Date().toISOString()

  // Waterfall through categories
  for (const category of CATEGORY_PRIORITY) {
    // Find available code
    const { data: availableCode } = await supabase
      .schema('pass')
      .from('backup_code_pool')
      .select('id, code, category, expires_at')
      .eq('device_id', deviceId)
      .eq('status', 'available')
      .eq('category', category)
      .gt('expires_at', now)
      .limit(1)
      .maybeSingle()

    if (availableCode) {
      // Assign to pass (optimistic locking)
      const { error } = await supabase
        .schema('pass')
        .from('backup_code_pool')
        .update({
          status: 'assigned',
          pass_id: passId,
          assigned_at: now,
        })
        .eq('id', availableCode.id)
        .eq('status', 'available')  // Only if still available

      if (!error) {
        return {
          success: true,
          code: availableCode.code,
          category: availableCode.category,
          expiresAt: availableCode.expires_at,
          mode: 'pool'
        }
      }
      // If error, another request grabbed it - try next category
    }
  }

  // No pool codes available - fall back to fortnightly
  // Get site_id from device first
  const { data: device } = await supabase
    .schema('core')
    .from('devices')
    .select('site_id')
    .eq('id', deviceId)
    .maybeSingle()

  if (device?.site_id) {
    return getFortnightlyBackupCode(supabase, device.site_id, deviceId)
  }

  return { success: false, error: 'No backup codes available' }
}
\`\`\`

### Step 4: Main Function

\`\`\`javascript
async function getBackupCode(supabase, passId, siteId, deviceId) {
  const mode = await getBackupCodeMode(supabase, siteId)

  if (mode === 'pool') {
    return assignBackupCodeFromPool(supabase, passId, deviceId)
  } else {
    return getFortnightlyBackupCode(supabase, siteId, deviceId)
  }
}
\`\`\`

---

## Usage in Timeout Flow

\`\`\`javascript
// When Rooms PIN times out...
const result = await pollForPin(passId)

if (!result.success) {
  // Cancel Rooms request
  await cancelRoomsRequest(passId, 'timeout')
  
  // Get backup code (auto-detects mode)
  const backupResult = await getBackupCode(supabase, passId, siteId, deviceId)
  
  if (backupResult.success) {
    showCodeToUser({
      code: backupResult.code,
      mode: backupResult.mode,
      expiresAt: backupResult.expiresAt,
      category: backupResult.category,  // Only for pool mode
    })
  } else {
    showError('No backup code available. Please contact support.')
  }
}
\`\`\`

---

## Database Tables

### `pass.backup_pincodes` (Fortnightly Mode)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `site_id` | UUID | FK to core.sites |
| `device_id` | UUID | FK to core.devices (optional) |
| `pincode` | VARCHAR | The backup PIN code |
| `fortnight_number` | INTEGER | Which fortnight |
| `period_start` | TIMESTAMPTZ | Start of validity |
| `period_end` | TIMESTAMPTZ | End of validity |

### `pass.backup_code_pool` (Pool Mode)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `site_id` | UUID | FK to core.sites |
| `device_id` | UUID | FK to core.devices |
| `code` | VARCHAR(5) | The PIN code (10000-99999) |
| `category` | TEXT | `day`, `camping_3d`, `camping_7d`, `camping_14d` |
| `validity_hours` | INTEGER | 24, 72, 168, or 336 |
| `status` | TEXT | `available`, `assigned`, `pending_removal` |
| `pass_id` | UUID | FK to pass.passes (when assigned) |
| `assigned_at` | TIMESTAMPTZ | When assigned |
| `expires_at` | TIMESTAMPTZ | When code expires |
| `rooms_ref` | TEXT | Rooms API reference |

### `core.sites` (Mode Setting)

| Column | Type | Description |
|--------|------|-------------|
| `backup_code_mode` | TEXT | `fortnightly` or `pool` (default: `fortnightly`) |

---

## Category Validity

| Category | Validity | Reserve Goal | Use Case |
|----------|----------|--------------|----------|
| `day` | 24 hours | 30 codes | Single-day passes |
| `camping_3d` | 3 days | 10 codes | Short camping stays |
| `camping_7d` | 7 days | 5 codes | Week-long trips |
| `camping_14d` | 14 days | 5 codes | Extended trips |

---

## Optional: Release Code on Cancellation

If a pass is cancelled and used pool mode, release the code back:

\`\`\`javascript
async function releaseBackupCode(supabase, passId) {
  await supabase
    .schema('pass')
    .from('backup_code_pool')
    .update({
      status: 'available',
      pass_id: null,
      assigned_at: null,
    })
    .eq('pass_id', passId)
    .eq('status', 'assigned')
}
\`\`\`

---

## Testing

1. **Fortnightly mode (default):** Should work as before, no changes needed
2. **Pool mode:** Set `UPDATE core.sites SET backup_code_mode = 'pool' WHERE id = 'site-uuid'`
3. **Fallback:** If pool has no codes, automatically falls back to fortnightly
