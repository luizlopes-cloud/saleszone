-- Repair: add missing columns that migration 20260317030000 should have added
ALTER TABLE user_access_log ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE user_access_log ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_access_log_session ON user_access_log (session_id);

-- Recreate RPCs that depend on these columns

CREATE OR REPLACE FUNCTION log_user_access(p_email TEXT, p_full_name TEXT DEFAULT NULL, p_session_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_access_log (email, full_name, session_id, last_heartbeat)
  VALUES (p_email, p_full_name, p_session_id, NOW());
END;
$$;

CREATE OR REPLACE FUNCTION update_session_heartbeat(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_access_log
  SET last_heartbeat = NOW()
  WHERE session_id = p_session_id;
END;
$$;

DROP FUNCTION IF EXISTS get_user_access_analytics();
CREATE FUNCTION get_user_access_analytics()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  total_accesses BIGINT,
  last_access TIMESTAMPTZ,
  first_access TIMESTAMPTZ,
  accesses_last_7d BIGINT,
  accesses_last_30d BIGINT,
  avg_session_minutes NUMERIC,
  total_time_7d_minutes NUMERIC
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
    COUNT(*) FILTER (WHERE l.accessed_at >= NOW() - INTERVAL '30 days') AS accesses_last_30d,
    ROUND(AVG(
      CASE WHEN l.last_heartbeat IS NOT NULL
        THEN GREATEST(EXTRACT(EPOCH FROM (l.last_heartbeat - l.accessed_at)) / 60.0, 1)
        ELSE NULL
      END
    )::NUMERIC, 0) AS avg_session_minutes,
    ROUND(COALESCE(SUM(
      CASE WHEN l.last_heartbeat IS NOT NULL AND l.accessed_at >= NOW() - INTERVAL '7 days'
        THEN GREATEST(EXTRACT(EPOCH FROM (l.last_heartbeat - l.accessed_at)) / 60.0, 1)
        ELSE 0
      END
    ), 0)::NUMERIC, 0) AS total_time_7d_minutes
  FROM user_access_log l
  GROUP BY l.email
  ORDER BY MAX(l.accessed_at) DESC;
END;
$$;
