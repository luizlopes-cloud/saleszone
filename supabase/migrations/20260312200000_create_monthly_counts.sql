-- Create squad_monthly_counts table for historical aggregation
CREATE TABLE IF NOT EXISTS squad_monthly_counts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month text NOT NULL,
  empreendimento text NOT NULL,
  tab text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE (month, empreendimento, tab)
);

-- Backfill from existing daily data
INSERT INTO squad_monthly_counts (month, empreendimento, tab, count)
SELECT TO_CHAR(date::date, 'YYYY-MM'), empreendimento, tab, SUM(count)
FROM squad_daily_counts WHERE tab IN ('mql','sql','opp','won')
GROUP BY 1, 2, 3
ON CONFLICT (month, empreendimento, tab) DO UPDATE SET count = EXCLUDED.count;
