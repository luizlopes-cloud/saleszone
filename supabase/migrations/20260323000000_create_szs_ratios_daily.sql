-- Histórico diário de ratios de conversão SZS (por canal_group)
-- squad_id: 0=global, 1=Marketing, 2=Parceiros, 3=Expansão, 4=Spots, 5=Mônica, 6=Outros
CREATE TABLE IF NOT EXISTS szs_ratios_daily (
  date       DATE NOT NULL,
  squad_id   INTEGER NOT NULL DEFAULT 0,
  ratios     JSONB NOT NULL,
  counts_90d JSONB NOT NULL,
  synced_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (date, squad_id)
);
