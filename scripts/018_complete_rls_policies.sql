-- Enable RLS on remaining tables
-- This script ensures all tables have RLS enabled to prevent unauthorized access

-- Enable RLS on pass_token_usage table
ALTER TABLE pass.pass_token_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read their own token usage
CREATE POLICY pass_token_usage_read ON pass.pass_token_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pass.qr_passes qp
      WHERE qp.id = pass_token_usage.pass_id
      AND qp.user_id = auth.uid()
    )
  );

-- Policy: Allow authenticated users to insert their own token usage
CREATE POLICY pass_token_usage_insert ON pass.pass_token_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pass.qr_passes qp
      WHERE qp.id = pass_token_usage.pass_id
      AND qp.user_id = auth.uid()
    )
  );

-- Enable RLS on processed_webhooks table
ALTER TABLE pass.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can manage webhooks (no public access needed)
CREATE POLICY processed_webhooks_service_only ON pass.processed_webhooks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY pass_token_usage_read ON pass.pass_token_usage IS 'Users can read their own pass token usage';
COMMENT ON POLICY pass_token_usage_insert ON pass.pass_token_usage IS 'Users can insert their own pass token usage';
COMMENT ON POLICY processed_webhooks_service_only ON pass.processed_webhooks IS 'Only service role can manage webhook processing records';
