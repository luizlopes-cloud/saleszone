-- Update RPC: days_back=-1 means no date filter (full history)
CREATE OR REPLACE FUNCTION get_planejamento_counts(months_back int DEFAULT 12, days_back int DEFAULT 0)
RETURNS TABLE (month text, empreendimento text, mql bigint, sql bigint, opp bigint, won bigint)
AS $$
  SELECT
    to_char(add_time, 'YYYY-MM') AS month,
    d.empreendimento,
    COUNT(*) FILTER (WHERE max_stage_order >= 2) AS mql,
    COUNT(*) FILTER (WHERE max_stage_order >= 5) AS sql,
    COUNT(*) FILTER (WHERE max_stage_order >= 9) AS opp,
    COUNT(*) FILTER (WHERE status = 'won') AS won
  FROM squad_deals d
  WHERE is_marketing = TRUE
    AND d.empreendimento IS NOT NULL
    AND (
      CASE
        WHEN days_back = -1 THEN TRUE
        WHEN days_back > 0 THEN add_time >= NOW() - (days_back || ' days')::interval
        ELSE add_time >= NOW() - (months_back || ' months')::interval
      END
    )
    AND (lost_reason IS NULL OR lost_reason <> 'Duplicado/Erro')
    AND rd_source ILIKE '%paga%'
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$ LANGUAGE sql STABLE;
