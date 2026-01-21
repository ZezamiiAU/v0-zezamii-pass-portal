-- Add backup_code_mode to core.sites table
-- This allows per-site configuration of backup code behavior
-- 
-- Options:
-- - 'fortnightly': Legacy rotating codes from pass.backup_pincodes (default)
-- - 'pool': Dynamic daily pool from pass.backup_code_pool

-- Add column to existing sites table
ALTER TABLE core.sites 
ADD COLUMN IF NOT EXISTS backup_code_mode TEXT DEFAULT 'fortnightly';

-- Add constraint for valid values (using DO block to avoid error if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sites_backup_code_mode'
  ) THEN
    ALTER TABLE core.sites
    ADD CONSTRAINT chk_sites_backup_code_mode 
    CHECK (backup_code_mode IN ('fortnightly', 'pool'));
  END IF;
END $$;

-- Comment for documentation
COMMENT ON COLUMN core.sites.backup_code_mode IS 
'Backup code mode: "fortnightly" (legacy 2-week rotation) or "pool" (dynamic daily pool with categories)';
