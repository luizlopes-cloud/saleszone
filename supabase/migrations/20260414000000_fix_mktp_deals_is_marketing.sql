-- Fix mktp_deals.is_marketing generated column to match Nekt canal names.
-- Nekt returns canal as text (e.g. "Marketing") instead of numeric ID "12".
-- Drop and re-add the generated column with the updated expression.
ALTER TABLE mktp_deals DROP COLUMN IF EXISTS is_marketing;
ALTER TABLE mktp_deals
  ADD COLUMN is_marketing BOOLEAN GENERATED ALWAYS AS (canal = 'Marketing') STORED;

-- Recreate index that depends on is_marketing (inherited index was dropped with column)
CREATE INDEX IF NOT EXISTS idx_mktp_deals_marketing_emp ON mktp_deals (empreendimento, add_time DESC)
  WHERE is_marketing = TRUE AND empreendimento IS NOT NULL;
