-- Verification script: Confirm all pass types have profiles and API returns correctly
-- Run this to verify seed/backfill completed successfully

-- 1. All pass types have profile_id set (should return 0 rows)
SELECT 'FAIL: Pass types without profile_id' as check_name, pt.id, pt.name
FROM pass.pass_types pt
WHERE pt.profile_id IS NULL;

-- 2. Profile linkage summary
SELECT 
  pp.code as profile_code,
  pp.name as profile_name,
  COUNT(pt.id) as linked_pass_types
FROM pass.pass_profiles pp
LEFT JOIN pass.pass_types pt ON pt.profile_id = pp.id
GROUP BY pp.id, pp.code, pp.name
ORDER BY pp.code;

-- 3. Day pass types have end_of_day profile
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: All day pass types linked to end_of_day'
    ELSE 'FAIL: Day pass types not linked correctly'
  END as check_result,
  COUNT(*) as unlinked_count
FROM pass.pass_types pt
LEFT JOIN pass.pass_profiles pp ON pt.profile_id = pp.id
WHERE pt.name ILIKE '%day%'
  AND (pp.code IS NULL OR pp.code != 'end_of_day');

-- 4. Camping pass types have nights_checkout profile
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS: All camping pass types linked to nights_checkout'
    ELSE 'FAIL: Camping pass types not linked correctly'
  END as check_result,
  COUNT(*) as unlinked_count
FROM pass.pass_types pt
LEFT JOIN pass.pass_profiles pp ON pt.profile_id = pp.id
WHERE (pt.name ILIKE '%camp%' OR pt.name ILIKE '%overnight%' OR pt.name ILIKE '%night%')
  AND (pp.code IS NULL OR pp.code != 'nights_checkout');

-- 5. Full pass type to profile mapping (expected output for API)
SELECT 
  pt.id as pass_type_id,
  pt.name as pass_type_name,
  pp.id as profile_id,
  pp.code as profile_code,
  pp.profile_type,
  pp.checkout_time,
  pp.duration_minutes,
  pp.required_inputs,
  pp.future_booking_enabled,
  pp.availability_enforcement
FROM pass.pass_types pt
LEFT JOIN pass.pass_profiles pp ON pt.profile_id = pp.id
ORDER BY pt.name;
