-- Histórico diário de ratios de conversão (MQL→SQL→OPP→WON)
-- 4 rows/dia: squad_id 0 (global) + 1/2/3 (squads)
CREATE TABLE IF NOT EXISTS squad_ratios_daily (
  date       DATE NOT NULL,
  squad_id   INTEGER NOT NULL DEFAULT 0,
  ratios     JSONB NOT NULL,
  counts_90d JSONB NOT NULL,
  synced_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (date, squad_id)
);
