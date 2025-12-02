-- Create dashboard stats function in PUBLIC schema (required for Supabase RPC)
-- This function queries core and pass schemas to return dashboard statistics

DROP FUNCTION IF EXISTS public.get_dashboard_stats();

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'org_count', (SELECT COUNT(*) FROM core.organisations WHERE is_active = true),
    'device_count', (SELECT COUNT(*) FROM core.devices),
    'pass_type_count', (SELECT COUNT(*) FROM pass.pass_types WHERE is_active = true),
    'pass_count', (SELECT COUNT(*) FROM pass.passes)
  ) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return zeros on error
    RETURN jsonb_build_object(
      'org_count', 0,
      'device_count', 0,
      'pass_type_count', 0,
      'pass_count', 0
    );
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats IS 
'Returns dashboard statistics for organisations, devices, pass types, and passes. Created in public schema for Supabase RPC access.';
