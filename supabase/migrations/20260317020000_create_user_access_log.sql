-- Tabela para registrar acessos dos usuários
CREATE TABLE IF NOT EXISTS user_access_log (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_access_log_email ON user_access_log (email);
CREATE INDEX IF NOT EXISTS idx_user_access_log_accessed_at ON user_access_log (accessed_at DESC);

-- RPC para registrar acesso (chamada do frontend no login)
CREATE OR REPLACE FUNCTION log_user_access(p_email TEXT, p_full_name TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_access_log (email, full_name)
  VALUES (p_email, p_full_name);
END;
$$;

-- RPC para buscar analytics de acesso (últimos 30 dias)
CREATE OR REPLACE FUNCTION get_user_access_analytics()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  total_accesses BIGINT,
  last_access TIMESTAMPTZ,
  first_access TIMESTAMPTZ,
  accesses_last_7d BIGINT,
  accesses_last_30d BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.email,
    MAX(l.full_name) AS full_name,
    COUNT(*) AS total_accesses,
    MAX(l.accessed_at) AS last_access,
    MIN(l.accessed_at) AS first_access,
    COUNT(*) FILTER (WHERE l.accessed_at >= NOW() - INTERVAL '7 days') AS accesses_last_7d,
    COUNT(*) FILTER (WHERE l.accessed_at >= NOW() - INTERVAL '30 days') AS accesses_last_30d
  FROM user_access_log l
  GROUP BY l.email
  ORDER BY MAX(l.accessed_at) DESC;
END;
$$;

-- RPC para buscar acessos recentes (timeline)
CREATE OR REPLACE FUNCTION get_recent_accesses(p_limit INT DEFAULT 50)
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  accessed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT l.email, l.full_name, l.accessed_at
  FROM user_access_log l
  ORDER BY l.accessed_at DESC
  LIMIT p_limit;
END;
$$;
