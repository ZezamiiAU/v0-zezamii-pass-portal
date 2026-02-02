-- Quick DB connectivity test
-- Verifies Portal is connected to correct database with pass_profiles and pass_types

SELECT 
  'pass.pass_profiles' as table_name,
  COUNT(*) as row_count
FROM pass.pass_profiles

UNION ALL

SELECT 
  'pass.pass_types' as table_name,
  COUNT(*) as row_count
FROM pass.pass_types

UNION ALL

SELECT 
  'pass_types_with_profile' as table_name,
  COUNT(*) as row_count
FROM pass.pass_types
WHERE profile_id IS NOT NULL;
