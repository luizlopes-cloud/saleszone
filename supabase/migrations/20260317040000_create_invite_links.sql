CREATE TABLE IF NOT EXISTS public.user_invite_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('operador', 'diretor')),
  created_by TEXT NOT NULL,
  max_uses INT NOT NULL DEFAULT 0, -- 0 = ilimitado
  used_count INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

ALTER TABLE public.user_invite_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read invite_links" ON public.user_invite_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert invite_links" ON public.user_invite_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update invite_links" ON public.user_invite_links FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete invite_links" ON public.user_invite_links FOR DELETE TO authenticated USING (true);
