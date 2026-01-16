-- Fix public access for PWA - enable anon access to pass schema and tables
-- This resolves 401 errors when loading pass types from the PWA

-- Grant USAGE on pass schema to anonymous role so they can access tables
GRANT USAGE ON SCHEMA pass TO anon;

-- Grant SELECT on pass_types table to anonymous role  
GRANT SELECT ON pass.pass_types TO anon;

-- Ensure the RLS policy allows anon users to read active pass types
-- (This policy already exists from previous migrations, but we're ensuring it's correct)
DROP POLICY IF EXISTS "Allow anon to read active pass types" ON pass.pass_types;
CREATE POLICY "Allow anon to read active pass types" ON pass.pass_types
  FOR SELECT TO anon, authenticated 
  USING (is_active = true);

-- Grant USAGE on core schema to anonymous role
GRANT USAGE ON SCHEMA core TO anon;

-- Grant SELECT on qr_passes for anonymous users to validate passes
GRANT SELECT ON core.qr_passes TO anon;

-- Enable RLS on qr_passes if not already enabled
ALTER TABLE core.qr_passes ENABLE ROW LEVEL SECURITY;

-- Create public read policy for active QR passes
DROP POLICY IF EXISTS qr_passes_public_read ON core.qr_passes;
CREATE POLICY qr_passes_public_read ON core.qr_passes
  FOR SELECT TO anon, authenticated 
  USING (is_active = true);

COMMENT ON POLICY qr_passes_public_read ON core.qr_passes IS 'Allow anonymous PWA users to read active QR passes for validation';
