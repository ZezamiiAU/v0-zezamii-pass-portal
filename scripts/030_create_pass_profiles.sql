-- Migration: 030_create_pass_profiles.sql
-- Description: Add profile-driven pass configuration (non-breaking, progressive rollout)
-- Backwards compatible: pass_types with profile_id = NULL continue working as-is
-- 
-- DEPLOYMENT NOTES:
-- - Env vars: None required
-- - API field mapping: Backend will handle mapping:
--   * entry_buffer_minutes -> buffer_before_minutes
--   * exit_buffer_minutes -> buffer_after_minutes
-- - update_updated_at_column() function exists in 001_create_core_schema.sql
-- - RLS uses USING (true) - intentional for current tenancy model

-- 1) Create pass_profiles table (site-scoped)
CREATE TABLE IF NOT EXISTS pass.pass_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                              -- 'end_of_day', 'nights_checkout', 'hourly_slot'
  name TEXT NOT NULL,                              -- Display name
  profile_type TEXT NOT NULL,                      -- 'instant', 'date_select', 'datetime_select', 'duration_select'

  -- Duration config
  duration_minutes INTEGER,                        -- For fixed duration profiles
  duration_options JSONB DEFAULT '[]'::jsonb,      -- [{label: "1 hour", minutes: 60}]
  checkout_time TIME,                              -- For overnight stays (e.g., 10:00)

  -- Buffers (stored as Portal field names, backend maps to API names)
  entry_buffer_minutes INTEGER DEFAULT 0,          -- API: buffer_before_minutes
  exit_buffer_minutes INTEGER DEFAULT 0,           -- API: buffer_after_minutes
  reset_buffer_minutes INTEGER DEFAULT 0,

  -- Required inputs (what PWA needs to collect)
  required_inputs JSONB DEFAULT '[]'::jsonb,       -- ['date', 'time', 'duration', 'nights']

  -- Feature flags (default OFF for progressive rollout)
  future_booking_enabled BOOLEAN DEFAULT false,
  availability_enforcement BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one code per site
  CONSTRAINT unique_profile_code_per_site UNIQUE (site_id, code)
);

-- 2) Add profile_id link to pass_types (nullable for backwards compatibility)
-- profile_id = NULL preserves legacy behaviour
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'pass' 
    AND table_name = 'pass_types' 
    AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE pass.pass_types
    ADD COLUMN profile_id UUID REFERENCES pass.pass_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pass_profiles_site_id ON pass.pass_profiles(site_id);
CREATE INDEX IF NOT EXISTS idx_pass_types_profile_id ON pass.pass_types(profile_id);

-- 4) Updated_at trigger for pass_profiles
DROP TRIGGER IF EXISTS update_pass_profiles_updated_at ON pass.pass_profiles;
CREATE TRIGGER update_pass_profiles_updated_at 
  BEFORE UPDATE ON pass.pass_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5) RLS policies for pass_profiles (matching existing pattern)
ALTER TABLE pass.pass_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent reruns)
DROP POLICY IF EXISTS "Allow authenticated read access to pass_profiles" ON pass.pass_profiles;
DROP POLICY IF EXISTS "Allow authenticated insert to pass_profiles" ON pass.pass_profiles;
DROP POLICY IF EXISTS "Allow authenticated update to pass_profiles" ON pass.pass_profiles;
DROP POLICY IF EXISTS "Allow authenticated delete to pass_profiles" ON pass.pass_profiles;

CREATE POLICY "Allow authenticated read access to pass_profiles"
  ON pass.pass_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert to pass_profiles"
  ON pass.pass_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to pass_profiles"
  ON pass.pass_profiles FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete to pass_profiles"
  ON pass.pass_profiles FOR DELETE
  TO authenticated
  USING (true);

-- 6) Add comment for documentation
COMMENT ON TABLE pass.pass_profiles IS 'Profile-driven pass configuration. Enables booking behaviour per pass type. NULL profile_id on pass_types preserves legacy behaviour.';
COMMENT ON COLUMN pass.pass_profiles.entry_buffer_minutes IS 'Buffer before pass validity starts. API exposes as buffer_before_minutes.';
COMMENT ON COLUMN pass.pass_profiles.exit_buffer_minutes IS 'Buffer after pass validity ends. API exposes as buffer_after_minutes.';
COMMENT ON COLUMN pass.pass_profiles.reset_buffer_minutes IS 'Time between consecutive bookings for same resource.';
