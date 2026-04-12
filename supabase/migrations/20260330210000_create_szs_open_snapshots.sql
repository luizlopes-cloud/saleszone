-- Daily snapshot of open deals by canal_group and stage for SZS Resultados charts
CREATE TABLE IF NOT EXISTS szs_open_snapshots (
  date DATE NOT NULL,
  canal_group TEXT NOT NULL,
  total_open INT NOT NULL DEFAULT 0,
  mql INT NOT NULL DEFAULT 0,
  sql_count INT NOT NULL DEFAULT 0,
  opp INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  ag_dados INT NOT NULL DEFAULT 0,
  contrato INT NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, canal_group)
);

-- RLS disabled (public access via service role / anon with --no-verify-jwt)
ALTER TABLE szs_open_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON szs_open_snapshots FOR ALL USING (true) WITH CHECK (true);
