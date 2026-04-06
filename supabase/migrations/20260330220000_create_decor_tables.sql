-- Decor module tables (structure copied from SZS/SZI equivalents)

CREATE TABLE IF NOT EXISTS public.decor_daily_counts (LIKE public.szs_daily_counts INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_deals (LIKE public.szs_deals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_meta_ads (LIKE public.szs_meta_ads INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_calendar_events (LIKE public.szs_calendar_events INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_metas (LIKE public.szs_metas INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_alignment (LIKE public.szs_alignment INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_alignment_deals (LIKE public.szs_alignment_deals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_presales_response (LIKE public.szs_presales_response INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_orcamento (LIKE public.squad_orcamento INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_orcamento_approved (LIKE public.squad_orcamento_approved INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_orcamento_log (LIKE public.squad_orcamento_log INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_baserow_empreendimentos (LIKE public.squad_baserow_empreendimentos INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_ratios_daily (LIKE public.szs_ratios_daily INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.decor_monthly_counts (LIKE public.szs_monthly_counts INCLUDING ALL);

-- RLS: allow anon read (same as other module tables)
ALTER TABLE public.decor_daily_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_alignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_alignment_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_presales_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_orcamento_approved ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_orcamento_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_baserow_empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_ratios_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_monthly_counts ENABLE ROW LEVEL SECURITY;

-- Policies: anon can read all
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg(
      format('CREATE POLICY IF NOT EXISTS "anon_read" ON public.%I FOR SELECT TO anon USING (true);', t),
      E'\n'
    )
    FROM unnest(ARRAY[
      'decor_daily_counts','decor_deals','decor_meta_ads','decor_calendar_events',
      'decor_metas','decor_alignment','decor_alignment_deals','decor_presales_response',
      'decor_orcamento','decor_orcamento_approved','decor_orcamento_log',
      'decor_baserow_empreendimentos','decor_ratios_daily','decor_monthly_counts'
    ]) AS t
  );
END $$;
