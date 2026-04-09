-- SZS (Seazone Serviços) pg_cron jobs
-- Edge Functions são chamadas sem Authorization header.
-- Funciona porque o botão "Atualizar" do frontend também chama sem Authorization.

-- pg_cron: every 2h (same schedule as SZI cron)
SELECT cron.schedule('szs-daily-open', '3 * * * *',
  $$ SELECT net.http_post(
    url=>'https://ewgqbkdriflarmmifrvs.supabase.co/functions/v1/sync-szs-dashboard',
    headers=>'{"Content-Type":"application/json"}'::jsonb,
    body=>'{"mode":"daily-open"}'::jsonb
  ); $$);

SELECT cron.schedule('szs-daily-won', '5 * * * *',
  $$ SELECT net.http_post(
    url=>'https://ewgqbkdriflarmmifrvs.supabase.co/functions/v1/sync-szs-dashboard',
    headers=>'{"Content-Type":"application/json"}'::jsonb,
    body=>'{"mode":"daily-won"}'::jsonb
  ); $$);

SELECT cron.schedule('szs-daily-lost', '7 * * * *',
  $$ SELECT net.http_post(
    url=>'https://ewgqbkdriflarmmifrvs.supabase.co/functions/v1/sync-szs-dashboard',
    headers=>'{"Content-Type":"application/json"}'::jsonb,
    body=>'{"mode":"daily-lost"}'::jsonb
  ); $$);

SELECT cron.schedule('szs-alignment', '9 * * * *',
  $$ SELECT net.http_post(
    url=>'https://ewgqbkdriflarmmifrvs.supabase.co/functions/v1/sync-szs-dashboard',
    headers=>'{"Content-Type":"application/json"}'::jsonb,
    body=>'{"mode":"alignment"}'::jsonb
  ); $$);

SELECT cron.schedule('szs-metas', '11 * * * *',
  $$ SELECT net.http_post(
    url=>'https://ewgqbkdriflarmmifrvs.supabase.co/functions/v1/sync-szs-dashboard',
    headers=>'{"Content-Type":"application/json"}'::jsonb,
    body=>'{"mode":"metas"}'::jsonb
  ); $$);

-- Daily at 7h BRT (10h UTC)
SELECT cron.schedule('szs-calendar', '0 10 * * *',
  $$ SELECT net.http_post(
    url=>'https://ewgqbkdriflarmmifrvs.supabase.co/functions/v1/sync-szs-calendar',
    headers=>'{"Content-Type":"application/json"}'::jsonb
  ); $$);
