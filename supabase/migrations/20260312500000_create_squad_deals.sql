-- Squad Deals: centralized deal store from Pipedrive pipeline 28
CREATE TABLE IF NOT EXISTS squad_deals (
  deal_id          INTEGER PRIMARY KEY,
  title            TEXT,
  stage_id         INTEGER,
  status           TEXT NOT NULL,           -- open, won, lost
  user_id          INTEGER,
  owner_name       TEXT,
  add_time         TIMESTAMPTZ,
  won_time         TIMESTAMPTZ,
  lost_time        TIMESTAMPTZ,
  update_time      TIMESTAMPTZ,
  canal            TEXT,                    -- raw FIELD_CANAL value
  is_marketing     BOOLEAN GENERATED ALWAYS AS (canal = '12') STORED,
  empreendimento_id TEXT,                   -- raw enum ID
  empreendimento   TEXT,                    -- nome resolvido via EMPREENDIMENTO_MAP
  qualificacao_date DATE,                   -- FIELD_QUALIFICACAO (SQL date)
  reuniao_date     DATE,                    -- FIELD_REUNIAO (OPP date)
  stage_order      INTEGER,                 -- STAGE_ORDER[stage_id] current
  max_stage_order  INTEGER,                 -- max stage ever reached (via Flow API for lost)
  flow_fetched     BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_deals_marketing_emp ON squad_deals (empreendimento, add_time DESC)
  WHERE is_marketing = TRUE AND empreendimento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_flow_pending ON squad_deals (deal_id)
  WHERE flow_fetched = FALSE AND status = 'lost';
CREATE INDEX IF NOT EXISTS idx_deals_status ON squad_deals (status);
CREATE INDEX IF NOT EXISTS idx_deals_update ON squad_deals (update_time DESC);

-- RPC for Planejamento: counts by month/empreendimento using max_stage_order
CREATE OR REPLACE FUNCTION get_planejamento_counts(months_back int DEFAULT 12)
RETURNS TABLE (month text, empreendimento text, mql bigint, sql bigint, opp bigint, won bigint)
AS $$
  SELECT
    to_char(add_time, 'YYYY-MM') AS month,
    empreendimento,
    COUNT(*) FILTER (WHERE max_stage_order >= 2) AS mql,
    COUNT(*) FILTER (WHERE max_stage_order >= 5) AS sql,
    COUNT(*) FILTER (WHERE max_stage_order >= 9) AS opp,
    COUNT(*) FILTER (WHERE status = 'won') AS won
  FROM squad_deals
  WHERE is_marketing = TRUE
    AND empreendimento IS NOT NULL
    AND add_time >= (NOW() - (months_back || ' months')::interval)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$ LANGUAGE sql STABLE;
