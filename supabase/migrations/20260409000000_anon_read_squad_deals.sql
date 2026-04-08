-- Allow anon key to read squad_deals (needed by geral route on Vercel which uses anon fallback)
CREATE POLICY "Allow anon read" ON squad_deals FOR SELECT USING (true);
