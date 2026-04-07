-- Fix: lost_reason is a single value "Duplicado/Erro", not separate values
CREATE OR REPLACE FUNCTION get_planejamento_counts(months_back int DEFAULT 12)
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
    AND add_time >= (NOW() - (months_back || ' months')::interval)
    AND (lost_reason IS NULL OR lost_reason <> 'Duplicado/Erro')
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$ LANGUAGE sql STABLE;
