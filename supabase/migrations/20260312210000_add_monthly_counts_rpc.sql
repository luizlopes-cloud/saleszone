-- RPC function for additive upsert into squad_monthly_counts
-- Used by backfill to accumulate counts from open + won + lost deals
CREATE OR REPLACE FUNCTION add_monthly_counts(rows jsonb)
RETURNS void AS $$
INSERT INTO squad_monthly_counts (month, empreendimento, tab, count, synced_at)
SELECT r->>'month', r->>'empreendimento', r->>'tab', (r->>'count')::int, now()
FROM jsonb_array_elements(rows) r
ON CONFLICT (month, empreendimento, tab)
DO UPDATE SET count = squad_monthly_counts.count + EXCLUDED.count,
             synced_at = now();
$$ LANGUAGE sql;
