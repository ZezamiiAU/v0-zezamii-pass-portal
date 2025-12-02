-- Add pincode digit length settings at multiple levels
-- This allows for organization-wide defaults, site-specific overrides, and pass-type granularity

-- 1. Add pincode_digit_length to pass_types (most granular level)
ALTER TABLE pass.pass_types 
ADD COLUMN IF NOT EXISTS pincode_digit_length INTEGER DEFAULT 6
CHECK (pincode_digit_length BETWEEN 4 AND 8);

COMMENT ON COLUMN pass.pass_types.pincode_digit_length IS 'Number of digits for PIN codes generated for this pass type (4-8 digits)';

-- 2. Create site_settings table for site-level configuration
CREATE TABLE IF NOT EXISTS core.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
  pincode_digit_length INTEGER DEFAULT 6 CHECK (pincode_digit_length BETWEEN 4 AND 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id)
);

COMMENT ON TABLE core.site_settings IS 'Site-level configuration settings including pincode generation preferences';
COMMENT ON COLUMN core.site_settings.pincode_digit_length IS 'Default PIN code length for all passes at this site (overridden by pass_type if set)';

-- 3. Add RLS policies for site_settings
ALTER TABLE core.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_settings_select ON core.site_settings
  FOR SELECT
  USING (
    site_id IN (
      SELECT s.id FROM core.sites s
      WHERE s.org_id IN (
        SELECT org_id FROM core.memberships 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY site_settings_insert ON core.site_settings
  FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT s.id FROM core.sites s
      WHERE s.org_id IN (
        SELECT org_id FROM core.memberships 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY site_settings_update ON core.site_settings
  FOR UPDATE
  USING (
    site_id IN (
      SELECT s.id FROM core.sites s
      WHERE s.org_id IN (
        SELECT org_id FROM core.memberships 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY site_settings_delete ON core.site_settings
  FOR DELETE
  USING (
    site_id IN (
      SELECT s.id FROM core.sites s
      WHERE s.org_id IN (
        SELECT org_id FROM core.memberships 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- 4. Add updated_at trigger
CREATE TRIGGER update_site_settings_updated_at 
  BEFORE UPDATE ON core.site_settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Create a view to get effective pincode length with precedence
CREATE OR REPLACE VIEW pass.v_effective_pincode_settings AS
SELECT 
  p.id AS pass_id,
  p.pass_type_id,
  p.site_id,
  p.org_id,
  -- Precedence: pass_type > site > default (6)
  COALESCE(
    pt.pincode_digit_length,
    ss.pincode_digit_length,
    6
  ) AS effective_pincode_length,
  pt.pincode_digit_length AS pass_type_setting,
  ss.pincode_digit_length AS site_setting
FROM pass.passes p
JOIN pass.pass_types pt ON pt.id = p.pass_type_id
LEFT JOIN core.site_settings ss ON ss.site_id = p.site_id;

COMMENT ON VIEW pass.v_effective_pincode_settings IS 'Resolves the effective PIN code length for each pass using precedence: pass_type > site > default(6)';

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_settings_site_id ON core.site_settings(site_id);
CREATE INDEX IF NOT EXISTS idx_pass_types_pincode_length ON pass.pass_types(pincode_digit_length) WHERE pincode_digit_length IS NOT NULL;

-- 7. Insert default site settings for existing sites
INSERT INTO core.site_settings (site_id, pincode_digit_length)
SELECT id, 6 FROM core.sites
ON CONFLICT (site_id) DO NOTHING;
