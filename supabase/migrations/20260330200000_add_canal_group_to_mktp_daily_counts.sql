-- Add canal_group column to mktp_daily_counts
-- Follows same pattern as szs_daily_counts (which has canal_group since creation)

-- 1. Add column with default so existing rows get a value
ALTER TABLE mktp_daily_counts
  ADD COLUMN IF NOT EXISTS canal_group TEXT NOT NULL DEFAULT 'Marketing';

-- 2. Drop existing PK (date, tab, empreendimento, source)
ALTER TABLE mktp_daily_counts DROP CONSTRAINT IF EXISTS mktp_daily_counts_pkey;

-- 3. Recreate PK including canal_group
ALTER TABLE mktp_daily_counts
  ADD CONSTRAINT mktp_daily_counts_pkey
  PRIMARY KEY (date, tab, canal_group, empreendimento, source);
