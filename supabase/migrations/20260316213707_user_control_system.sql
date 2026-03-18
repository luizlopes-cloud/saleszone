-- User Control System: access by invite only
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('operador', 'diretor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  invited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('operador', 'diretor')),
  invited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert profiles" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update profiles" ON public.user_profiles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated read invitations" ON public.user_invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert invitations" ON public.user_invitations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete invitations" ON public.user_invitations FOR DELETE TO authenticated USING (true);

-- Seed: diretor inicial
INSERT INTO user_profiles (email, full_name, role) VALUES
  ('matheus.ambrosi@seazone.com.br', 'Matheus Ambrosi', 'diretor')
ON CONFLICT (email) DO NOTHING;
