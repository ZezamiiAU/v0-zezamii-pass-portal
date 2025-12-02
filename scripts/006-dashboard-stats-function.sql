-- Create a function to get dashboard statistics
-- This works better than REST API for non-public schema tables

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, pass
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'org_count', (SELECT COUNT(*) FROM core.organisations),
    'device_count', (SELECT COUNT(*) FROM core.devices),
    'pass_type_count', (SELECT COUNT(*) FROM pass.pass_types),
    'pass_count', (SELECT COUNT(*) FROM pass.passes)
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats() IS 
'Returns dashboard statistics from core and pass schemas. Used by admin portal.';
