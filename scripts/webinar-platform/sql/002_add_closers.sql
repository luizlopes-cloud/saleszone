-- webinar_closers: one row per closer
CREATE TABLE IF NOT EXISTS webinar_closers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    calendar_id text NOT NULL,
    avatar_url text,
    is_active bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webinar_closers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_closers" ON webinar_closers FOR SELECT USING (true);
CREATE POLICY "service_all_closers" ON webinar_closers FOR ALL USING (auth.role() = 'service_role');

-- Add closer_id to slots and sessions
ALTER TABLE webinar_slots ADD COLUMN closer_id uuid REFERENCES webinar_closers(id) ON DELETE CASCADE;
ALTER TABLE webinar_sessions ADD COLUMN closer_id uuid REFERENCES webinar_closers(id) ON DELETE CASCADE;

CREATE INDEX idx_webinar_slots_closer ON webinar_slots(closer_id);
CREATE INDEX idx_webinar_sessions_closer ON webinar_sessions(closer_id);

-- Seed initial closer for testing
INSERT INTO webinar_closers (slug, name, email, calendar_id) VALUES
    ('gabriela-lemos', 'Gabriela Lemos', 'gabriela.lemos@seazone.com.br', 'gabriela.lemos@seazone.com.br');
