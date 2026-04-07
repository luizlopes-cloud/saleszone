-- ============================================================================
-- SZS (Serviços) Module Tables and RPCs
-- Mirrors the SZI squad_* structure for the Serviços pipeline.
-- Uses CREATE TABLE ... (LIKE ... INCLUDING ALL) to copy columns, constraints,
-- indexes, and defaults from the corresponding squad_* tables.
-- ============================================================================

-- 1. Create SZS tables mirroring squad_* structure
CREATE TABLE IF NOT EXISTS szs_deals (LIKE squad_deals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_daily_counts (LIKE squad_daily_counts INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_alignment (LIKE squad_alignment INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_alignment_deals (LIKE squad_alignment_deals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_metas (LIKE squad_metas INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_ratios (LIKE squad_ratios INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_meta_ads (LIKE squad_meta_ads INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_presales_response (LIKE squad_presales_response INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_calendar_events (LIKE squad_calendar_events INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_monthly_counts (LIKE squad_monthly_counts INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_orcamento (LIKE squad_orcamento INCLUDING ALL);
CREATE TABLE IF NOT EXISTS szs_baserow_empreendimentos (LIKE squad_baserow_empreendimentos INCLUDING ALL);

-- 2. Enable RLS on all SZS tables (allow anon read, service write)
ALTER TABLE szs_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_deals FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_deals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_daily_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_daily_counts FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_daily_counts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_alignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_alignment FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_alignment FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_alignment_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_alignment_deals FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_alignment_deals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_metas FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_metas FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_ratios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_ratios FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_ratios FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_meta_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_meta_ads FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_meta_ads FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_presales_response ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_presales_response FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_presales_response FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_calendar_events FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_calendar_events FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_monthly_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_monthly_counts FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_monthly_counts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_orcamento FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_orcamento FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE szs_baserow_empreendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON szs_baserow_empreendimentos FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON szs_baserow_empreendimentos FOR ALL USING (true) WITH CHECK (true);

-- 3. RPC: get_szs_planejamento_counts
-- Same logic as get_planejamento_counts but reads from szs_deals
CREATE OR REPLACE FUNCTION get_szs_planejamento_counts(p_months_back int DEFAULT 12, p_days_back int DEFAULT 0)
RETURNS TABLE (month text, empreendimento text, mql bigint, sql bigint, opp bigint, won bigint)
AS $$
  SELECT
    to_char(add_time, 'YYYY-MM') AS month,
    d.empreendimento,
    COUNT(*) FILTER (WHERE max_stage_order >= 2) AS mql,
    COUNT(*) FILTER (WHERE max_stage_order >= 5) AS sql,
    COUNT(*) FILTER (WHERE max_stage_order >= 9) AS opp,
    COUNT(*) FILTER (WHERE status = 'won') AS won
  FROM szs_deals d
  WHERE is_marketing = TRUE
    AND d.empreendimento IS NOT NULL
    AND (
      CASE
        WHEN p_days_back = -1 THEN TRUE
        WHEN p_days_back > 0 THEN add_time >= NOW() - (p_days_back || ' days')::interval
        ELSE add_time >= NOW() - (p_months_back || ' months')::interval
      END
    )
    AND (lost_reason IS NULL OR lost_reason <> 'Duplicado/Erro')
    AND rd_source ILIKE '%paga%'
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$ LANGUAGE sql STABLE;

-- 4. RPC: get_szs_historico_campanhas
-- Same logic as get_historico_campanhas but reads from szs_meta_ads
CREATE OR REPLACE FUNCTION get_szs_historico_campanhas()
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
  FROM szs_meta_ads sma
  GROUP BY sma.ad_id;
$$ LANGUAGE SQL STABLE;

-- Index for RPC performance (mirrors idx_squad_meta_ads_ad_snapshot)
CREATE INDEX IF NOT EXISTS idx_szs_meta_ads_ad_snapshot
ON szs_meta_ads(ad_id, snapshot_date DESC);
