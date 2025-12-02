-- Create core schema for organisational hierarchy
CREATE SCHEMA IF NOT EXISTS core;

-- Organisations table
CREATE TABLE IF NOT EXISTS core.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  support_email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  stripe_account_id TEXT, -- For Stripe Connect multi-tenant payments
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table
CREATE TABLE IF NOT EXISTS core.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buildings table
CREATE TABLE IF NOT EXISTS core.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES core.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  floors INTEGER,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Floors table
CREATE TABLE IF NOT EXISTS core.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES core.buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table (access control devices)
CREATE TABLE IF NOT EXISTS core.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES core.floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  mac_address TEXT,
  ip_address TEXT,
  firmware_version TEXT,
  lock_id TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations table
CREATE TABLE IF NOT EXISTS core.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES core.organisations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT,
  api_key TEXT,
  property_id TEXT,
  webhook_secret TEXT,
  config_json JSONB,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sites_organization ON core.sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_buildings_site ON core.buildings(site_id);
CREATE INDEX IF NOT EXISTS idx_floors_building ON core.floors(building_id);
CREATE INDEX IF NOT EXISTS idx_devices_floor ON core.devices(floor_id);
CREATE INDEX IF NOT EXISTS idx_integrations_org ON core.integrations(organization_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_organisations_updated_at BEFORE UPDATE ON core.organisations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON core.sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON core.buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_floors_updated_at BEFORE UPDATE ON core.floors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON core.devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON core.integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
