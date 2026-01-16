-- Fix pass types RLS policies to allow anonymous read access
-- This is critical for the PWA to load pass types without authentication

-- Grant USAGE on pass schema to anonymous role
GRANT USAGE ON SCHEMA pass TO anon;

-- Grant SELECT on pass_types table to anonymous role
GRANT SELECT ON pass.pass_types TO anon;

-- Create or replace public read policy for pass types
DROP POLICY IF EXISTS pass_types_public_read ON pass.pass_types;

CREATE POLICY pass_types_public_read ON pass.pass_types
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Grant SELECT on qr_passes for anonymous users to validate passes
GRANT SELECT ON pass.qr_passes TO anon;

-- Create or replace public read policy for active passes
DROP POLICY IF EXISTS qr_passes_public_read ON pass.qr_passes;

CREATE POLICY qr_passes_public_read ON pass.qr_passes
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

COMMENT ON POLICY pass_types_public_read ON pass.pass_types IS 'Allow anonymous users to read active pass types for PWA purchase flow';
COMMENT ON POLICY qr_passes_public_read ON pass.qr_passes IS 'Allow anonymous users to read active QR passes for validation';
