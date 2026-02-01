-- Migration: 032_seed_legacy_profiles.sql
-- Description: Create default profiles for legacy Day and Camping pass types
-- Non-breaking: Only affects pass types without existing profile_id
-- Rollout: future_booking_enabled = false by default until PWA integration verified
--
-- Schema relationship:
--   pass_types.organization_id -> organisations.id
--   pass_profiles.site_id -> sites.id
--   sites.organization_id -> organisations.id
-- So we join pass_types -> organisations -> sites to get site_id for profiles

-- Step 1: Create end_of_day profile for each site in organizations that have Day pass types
-- Day passes: valid until 23:59 on the selected date
INSERT INTO pass.pass_profiles (
  site_id,
  code,
  name,
  profile_type,
  duration_minutes,
  checkout_time,
  entry_buffer_minutes,
  exit_buffer_minutes,
  reset_buffer_minutes,
  required_inputs,
  future_booking_enabled,
  availability_enforcement
)
SELECT DISTINCT
  s.id,
  'end_of_day',
  'End of Day Pass',
  'date_select',
  NULL,  -- No fixed duration, runs until end of day
  '23:59:00'::TIME,  -- Cutoff at end of day
  0,     -- No entry buffer
  0,     -- No exit buffer
  0,     -- No reset buffer
  '["date"]'::JSONB,  -- Requires date selection
  false, -- Future booking OFF by default
  false  -- Availability enforcement OFF by default
FROM pass.pass_types pt
JOIN core.sites s ON s.organization_id = pt.organization_id
WHERE pt.name ILIKE '%day%'
  AND pt.profile_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pass.pass_profiles pp 
    WHERE pp.site_id = s.id AND pp.code = 'end_of_day'
  )
ON CONFLICT (site_id, code) DO NOTHING;

-- Step 2: Create nights_checkout profile for each site in organizations that have Camping pass types
-- Camping passes: checkout at 10:00 AM after N nights
INSERT INTO pass.pass_profiles (
  site_id,
  code,
  name,
  profile_type,
  duration_minutes,
  checkout_time,
  entry_buffer_minutes,
  exit_buffer_minutes,
  reset_buffer_minutes,
  required_inputs,
  future_booking_enabled,
  availability_enforcement
)
SELECT DISTINCT
  s.id,
  'nights_checkout',
  'Camping / Overnight Stay',
  'date_select',
  NULL,  -- Variable based on nights selected
  '10:00:00'::TIME,  -- Checkout at 10 AM
  0,     -- No entry buffer
  0,     -- No exit buffer
  0,     -- No reset buffer
  '["date", "nights"]'::JSONB,  -- Requires date and number of nights
  false, -- Future booking OFF by default
  false  -- Availability enforcement OFF by default
FROM pass.pass_types pt
JOIN core.sites s ON s.organization_id = pt.organization_id
WHERE (pt.name ILIKE '%camp%' OR pt.name ILIKE '%overnight%' OR pt.name ILIKE '%night%')
  AND pt.profile_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pass.pass_profiles pp 
    WHERE pp.site_id = s.id AND pp.code = 'nights_checkout'
  )
ON CONFLICT (site_id, code) DO NOTHING;

-- Step 3: Link Day pass types to end_of_day profile (via organization -> site)
UPDATE pass.pass_types pt
SET profile_id = pp.id,
    updated_at = now()
FROM pass.pass_profiles pp
JOIN core.sites s ON pp.site_id = s.id
WHERE s.organization_id = pt.organization_id
  AND pp.code = 'end_of_day'
  AND pt.name ILIKE '%day%'
  AND pt.profile_id IS NULL;

-- Step 4: Link Camping pass types to nights_checkout profile (via organization -> site)
UPDATE pass.pass_types pt
SET profile_id = pp.id,
    updated_at = now()
FROM pass.pass_profiles pp
JOIN core.sites s ON pp.site_id = s.id
WHERE s.organization_id = pt.organization_id
  AND pp.code = 'nights_checkout'
  AND (pt.name ILIKE '%camp%' OR pt.name ILIKE '%overnight%' OR pt.name ILIKE '%night%')
  AND pt.profile_id IS NULL;

-- Step 5: Create an instant profile for each site in organizations that have remaining pass types
-- This ensures all pass types have a profile for API consistency
INSERT INTO pass.pass_profiles (
  site_id,
  code,
  name,
  profile_type,
  duration_minutes,
  checkout_time,
  entry_buffer_minutes,
  exit_buffer_minutes,
  reset_buffer_minutes,
  required_inputs,
  future_booking_enabled,
  availability_enforcement
)
SELECT DISTINCT
  s.id,
  'instant_access',
  'Instant Access Pass',
  'instant',
  NULL,  -- No fixed duration
  NULL,  -- No checkout time
  0,     -- No entry buffer
  0,     -- No exit buffer
  0,     -- No reset buffer
  '[]'::JSONB,  -- No required inputs for instant
  false, -- Future booking OFF
  false  -- Availability enforcement OFF
FROM pass.pass_types pt
JOIN core.sites s ON s.organization_id = pt.organization_id
WHERE pt.profile_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pass.pass_profiles pp 
    WHERE pp.site_id = s.id AND pp.code = 'instant_access'
  )
ON CONFLICT (site_id, code) DO NOTHING;

-- Step 6: Link remaining unlinked pass types to instant_access profile (via organization -> site)
UPDATE pass.pass_types pt
SET profile_id = pp.id,
    updated_at = now()
FROM pass.pass_profiles pp
JOIN core.sites s ON pp.site_id = s.id
WHERE s.organization_id = pt.organization_id
  AND pp.code = 'instant_access'
  AND pt.profile_id IS NULL;

-- Verification query (run manually to check results):
-- SELECT 
--   pt.name as pass_type_name,
--   pp.code as profile_code,
--   pp.name as profile_name,
--   pp.profile_type,
--   pp.checkout_time,
--   pp.required_inputs
-- FROM pass.pass_types pt
-- LEFT JOIN pass.pass_profiles pp ON pt.profile_id = pp.id
-- ORDER BY pt.organization_id, pt.name;

COMMENT ON TABLE pass.pass_profiles IS 'Profile-driven pass configuration. All pass types should have profile_id set for API consistency.';
