CREATE TABLE IF NOT EXISTS squad_alignment_deals (
  id BIGSERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  empreendimento TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alignment_deals_emp_owner ON squad_alignment_deals (empreendimento, owner_name);
