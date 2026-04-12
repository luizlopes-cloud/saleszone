-- RPC para o Histórico de Campanhas: agrupa snapshots por ad_id, retorna lifetime metrics
CREATE OR REPLACE FUNCTION get_historico_campanhas()
RETURNS TABLE (
  ad_id TEXT,
  campaign_name TEXT,
  adset_name TEXT,
  ad_name TEXT,
  empreendimento TEXT,
  effective_status TEXT,
  spend NUMERIC,
  leads BIGINT,
  impressions BIGINT,
  clicks BIGINT,
  last_seen_date TEXT
) AS $$
  SELECT
    sma.ad_id,
    (ARRAY_AGG(sma.campaign_name ORDER BY sma.snapshot_date DESC))[1],
    (ARRAY_AGG(sma.adset_name ORDER BY sma.snapshot_date DESC))[1],
    (ARRAY_AGG(sma.ad_name ORDER BY sma.snapshot_date DESC))[1],
    (ARRAY_AGG(sma.empreendimento ORDER BY sma.snapshot_date DESC))[1],
    (ARRAY_AGG(sma.effective_status ORDER BY sma.snapshot_date DESC))[1],
    MAX(sma.spend),
    MAX(sma.leads),
    MAX(sma.impressions),
    MAX(sma.clicks),
    MAX(sma.snapshot_date)::TEXT
  FROM squad_meta_ads sma
  GROUP BY sma.ad_id;
$$ LANGUAGE SQL STABLE;

-- Índice para performance da RPC
CREATE INDEX IF NOT EXISTS idx_squad_meta_ads_ad_snapshot
ON squad_meta_ads(ad_id, snapshot_date DESC);
