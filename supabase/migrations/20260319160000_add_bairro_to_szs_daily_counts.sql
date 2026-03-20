-- Add bairro column to szs_daily_counts for neighborhood-level grouping
-- This only affects SZS module; squad_daily_counts (SZI) is not touched.

-- Add column with NOT NULL default so it works with existing PK
ALTER TABLE szs_daily_counts ADD COLUMN IF NOT EXISTS bairro TEXT NOT NULL DEFAULT 'Sem bairro';

-- The table was created with LIKE squad_daily_counts INCLUDING ALL,
-- so the PK is (date, tab, empreendimento, source).
-- We need to drop and recreate it to include bairro.
-- First find and drop the existing PK constraint.
DO $$
DECLARE
  pk_name TEXT;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = 'szs_daily_counts'::regclass
    AND contype = 'p';

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE szs_daily_counts DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;

-- Recreate PK including bairro
ALTER TABLE szs_daily_counts ADD CONSTRAINT szs_daily_counts_pkey
  PRIMARY KEY (date, tab, empreendimento, bairro, source);
