-- Create pass schema for pass management
CREATE SCHEMA IF NOT EXISTS pass;

-- Pass types table
CREATE TABLE IF NOT EXISTS pass.pass_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_hours NUMERIC NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  max_uses INTEGER,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access point slugs table (for slug-based routing)
CREATE TABLE IF NOT EXISTS pass.accesspoint_slugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  device_id UUID NOT NULL REFERENCES core.devices(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_description TEXT,
  custom_logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Passes table
CREATE TABLE IF NOT EXISTS pass.passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_number TEXT UNIQUE NOT NULL,
  pass_type_id UUID NOT NULL REFERENCES pass.pass_types(id) ON DELETE RESTRICT,
  device_id UUID REFERENCES core.devices(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lock codes table
CREATE TABLE IF NOT EXISTS pass.lock_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id UUID NOT NULL REFERENCES pass.passes(id) ON DELETE CASCADE,
  lock_code TEXT NOT NULL,
  lock_id TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pass_types_org ON pass.pass_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_accesspoint_slugs_device ON pass.accesspoint_slugs(device_id);
CREATE INDEX IF NOT EXISTS idx_accesspoint_slugs_slug ON pass.accesspoint_slugs(slug) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_passes_type ON pass.passes(pass_type_id);
CREATE INDEX IF NOT EXISTS idx_passes_device ON pass.passes(device_id);
CREATE INDEX IF NOT EXISTS idx_passes_session ON pass.passes(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_passes_email ON pass.passes(guest_email);
CREATE INDEX IF NOT EXISTS idx_lock_codes_pass ON pass.lock_codes(pass_id);

-- Add updated_at triggers
CREATE TRIGGER update_pass_types_updated_at BEFORE UPDATE ON pass.pass_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accesspoint_slugs_updated_at BEFORE UPDATE ON pass.accesspoint_slugs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_passes_updated_at BEFORE UPDATE ON pass.passes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
