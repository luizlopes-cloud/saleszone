-- Allow authenticated @seazone.com.br users to read squad_deals
-- Uses auth.jwt() to restrict to Seazone domain users only (no anon access)
-- Needed by geral/route.ts which uses service role or authenticated anon fallback
CREATE POLICY "Allow authenticated seazone read" ON squad_deals FOR SELECT
  USING (auth.jwt() ->> 'email' LIKE '%@seazone.com.br');
