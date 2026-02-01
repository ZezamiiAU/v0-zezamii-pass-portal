-- Migration: 033_profile_seed_backfill.sql
-- Description: Idempotent profile seed + backfill script
-- Usage: Run globally OR set @target_org_id to backfill a specific organization
-- Safe to re-run: Uses ON CONFLICT DO NOTHING and only updates NULL profile_id
--
-- To run for a specific org, uncomment and set the org_id filter below:
-- SET session my.target_org_id = 'your-org-uuid-here';

-- ============================================================================
-- FUNCTION: Idempotent profile seed + backfill
-- ============================================================================
-- This function can be called globally or for a specific organization
-- It creates missing profiles and links unlinked pass types

CREATE OR REPLACE FUNCTION pass.seed_and_backfill_profiles(target_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  action TEXT,
  profile_code TEXT,
  pass_type_name TEXT,
  linked_site_id UUID
) AS $$
BEGIN
  -- Step 1: Create end_of_day profile for sites with Day pass types
  INSERT INTO pass.pass_profiles (
    site_id, code, name, profile_type, duration_minutes, checkout_time,
    entry_buffer_minutes, exit_buffer_minutes, reset_buffer_minutes,
    required_inputs, future_booking_enabled, availability_enforcement
  )
  SELECT DISTINCT
    s.id, 'end_of_day', 'End of Day Pass', 'date_select',
    NULL::INTEGER, '23:59:00'::TIME, 0, 0, 0,
    '["date"]'::JSONB, false, false
  FROM pass.pass_types pt
  JOIN core.sites s ON s.org_id = pt.org_id
  WHERE pt.name ILIKE '%day%'
    AND pt.profile_id IS NULL
    AND (target_org_id IS NULL OR pt.org_id = target_org_id)
    AND NOT EXISTS (
      SELECT 1 FROM pass.pass_profiles pp 
      WHERE pp.site_id = s.id AND pp.code = 'end_of_day'
    )
  ON CONFLICT (site_id, code) DO NOTHING;

  -- Step 2: Create nights_checkout profile for sites with Camping pass types
  INSERT INTO pass.pass_profiles (
    site_id, code, name, profile_type, duration_minutes, checkout_time,
    entry_buffer_minutes, exit_buffer_minutes, reset_buffer_minutes,
    required_inputs, future_booking_enabled, availability_enforcement
  )
  SELECT DISTINCT
    s.id, 'nights_checkout', 'Camping / Overnight Stay', 'date_select',
    NULL::INTEGER, '10:00:00'::TIME, 0, 0, 0,
    '["date", "nights"]'::JSONB, false, false
  FROM pass.pass_types pt
  JOIN core.sites s ON s.org_id = pt.org_id
  WHERE (pt.name ILIKE '%camp%' OR pt.name ILIKE '%overnight%' OR pt.name ILIKE '%night%')
    AND pt.profile_id IS NULL
    AND (target_org_id IS NULL OR pt.org_id = target_org_id)
    AND NOT EXISTS (
      SELECT 1 FROM pass.pass_profiles pp 
      WHERE pp.site_id = s.id AND pp.code = 'nights_checkout'
    )
  ON CONFLICT (site_id, code) DO NOTHING;

  -- Step 3: Create instant_access profile for remaining pass types
  INSERT INTO pass.pass_profiles (
    site_id, code, name, profile_type, duration_minutes, checkout_time,
    entry_buffer_minutes, exit_buffer_minutes, reset_buffer_minutes,
    required_inputs, future_booking_enabled, availability_enforcement
  )
  SELECT DISTINCT
    s.id, 'instant_access', 'Instant Access Pass', 'instant',
    NULL::INTEGER, NULL::TIME, 0, 0, 0,
    '[]'::JSONB, false, false
  FROM pass.pass_types pt
  JOIN core.sites s ON s.org_id = pt.org_id
  WHERE pt.profile_id IS NULL
    AND (target_org_id IS NULL OR pt.org_id = target_org_id)
    AND NOT EXISTS (
      SELECT 1 FROM pass.pass_profiles pp 
      WHERE pp.site_id = s.id AND pp.code = 'instant_access'
    )
  ON CONFLICT (site_id, code) DO NOTHING;

  -- Step 4: Link Day pass types to end_of_day profile
  UPDATE pass.pass_types pt
  SET profile_id = pp.id, updated_at = now()
  FROM pass.pass_profiles pp
  JOIN core.sites s ON pp.site_id = s.id
  WHERE s.org_id = pt.org_id
    AND pp.code = 'end_of_day'
    AND pt.name ILIKE '%day%'
    AND pt.profile_id IS NULL
    AND (target_org_id IS NULL OR pt.org_id = target_org_id);

  -- Step 5: Link Camping pass types to nights_checkout profile
  UPDATE pass.pass_types pt
  SET profile_id = pp.id, updated_at = now()
  FROM pass.pass_profiles pp
  JOIN core.sites s ON pp.site_id = s.id
  WHERE s.org_id = pt.org_id
    AND pp.code = 'nights_checkout'
    AND (pt.name ILIKE '%camp%' OR pt.name ILIKE '%overnight%' OR pt.name ILIKE '%night%')
    AND pt.profile_id IS NULL
    AND (target_org_id IS NULL OR pt.org_id = target_org_id);

  -- Step 6: Link remaining to instant_access profile
  UPDATE pass.pass_types pt
  SET profile_id = pp.id, updated_at = now()
  FROM pass.pass_profiles pp
  JOIN core.sites s ON pp.site_id = s.id
  WHERE s.org_id = pt.org_id
    AND pp.code = 'instant_access'
    AND pt.profile_id IS NULL
    AND (target_org_id IS NULL OR pt.org_id = target_org_id);

  -- Return summary of linked pass types
  RETURN QUERY
  SELECT 
    'linked'::TEXT as action,
    pp.code as profile_code,
    pt.name as pass_type_name,
    pp.site_id as linked_site_id
  FROM pass.pass_types pt
  JOIN pass.pass_profiles pp ON pt.profile_id = pp.id
  JOIN core.sites s ON pp.site_id = s.id
  WHERE s.org_id = pt.org_id
    AND (target_org_id IS NULL OR pt.org_id = target_org_id)
  ORDER BY pp.code, pt.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXECUTE: Run global backfill (all orgs)
-- ============================================================================
SELECT * FROM pass.seed_and_backfill_profiles(NULL);

-- ============================================================================
-- EXAMPLE: Run for specific org (uncomment and set org_id)
-- ============================================================================
-- SELECT * FROM pass.seed_and_backfill_profiles('your-org-uuid-here'::UUID);

-- ============================================================================
-- VERIFICATION: Check all pass types have profiles
-- ============================================================================
-- SELECT 
--   pt.id,
--   pt.name as pass_type,
--   pt.org_id,
--   pp.code as profile_code,
--   pp.profile_type,
--   pp.checkout_time,
--   pp.required_inputs
-- FROM pass.pass_types pt
-- LEFT JOIN pass.pass_profiles pp ON pt.profile_id = pp.id
-- ORDER BY pt.org_id, pt.name;

-- ============================================================================
-- VERIFICATION: Check for orphaned pass types (should return 0 rows)
-- ============================================================================
-- SELECT pt.id, pt.name, pt.org_id
-- FROM pass.pass_types pt
-- WHERE pt.profile_id IS NULL;
