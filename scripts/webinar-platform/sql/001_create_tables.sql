-- webinar_slots: recurring schedule configuration
CREATE TABLE IF NOT EXISTS webinar_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    time timetz NOT NULL,
    duration_minutes int NOT NULL DEFAULT 60,
    max_participants int NOT NULL DEFAULT 50,
    is_active bool NOT NULL DEFAULT true,
    presenter_email text NOT NULL CHECK (presenter_email LIKE '%@seazone.com.br'),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- webinar_sessions: concrete instances from slots
CREATE TABLE IF NOT EXISTS webinar_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id uuid REFERENCES webinar_slots(id) ON DELETE SET NULL,
    date date NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    google_meet_link text,
    calendar_event_id text,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
    cta_active bool NOT NULL DEFAULT false,
    cancelled_at timestamptz,
    cancel_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webinar_sessions_status ON webinar_sessions(status);
CREATE INDEX idx_webinar_sessions_date ON webinar_sessions(date);
CREATE UNIQUE INDEX idx_webinar_sessions_slot_date ON webinar_sessions(slot_id, date) WHERE slot_id IS NOT NULL;

-- webinar_registrations: lead sign-ups
CREATE TABLE IF NOT EXISTS webinar_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
    access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    pipedrive_deal_id int,
    confirmed_at timestamptz,
    attended_at timestamptz,
    cancelled_at timestamptz,
    converted bool NOT NULL DEFAULT false,
    converted_at timestamptz,
    cta_response jsonb,
    reminder_24h_sent_at timestamptz,
    reminder_1h_sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(session_id, email)
);

CREATE INDEX idx_webinar_registrations_session ON webinar_registrations(session_id);
CREATE INDEX idx_webinar_registrations_email ON webinar_registrations(email);
CREATE INDEX idx_webinar_registrations_token ON webinar_registrations(access_token);

-- webinar_messages: live chat
CREATE TABLE IF NOT EXISTS webinar_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
    registration_id uuid REFERENCES webinar_registrations(id) ON DELETE SET NULL,
    sender_type text NOT NULL DEFAULT 'lead' CHECK (sender_type IN ('lead', 'presenter')),
    presenter_email text,
    content text NOT NULL CHECK (char_length(content) <= 500),
    is_deleted bool NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webinar_messages_session ON webinar_messages(session_id, created_at);

-- RLS policies
ALTER TABLE webinar_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_messages ENABLE ROW LEVEL SECURITY;

-- Public read for slots and sessions (scheduling page)
CREATE POLICY "anon_read_slots" ON webinar_slots FOR SELECT USING (true);
CREATE POLICY "anon_read_sessions" ON webinar_sessions FOR SELECT USING (true);

-- Public read for messages (Realtime needs this)
CREATE POLICY "anon_read_messages" ON webinar_messages FOR SELECT USING (true);

-- Service role can do everything (Flask backend uses service role key)
CREATE POLICY "service_all_slots" ON webinar_slots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_sessions" ON webinar_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_registrations" ON webinar_registrations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_messages" ON webinar_messages FOR ALL USING (auth.role() = 'service_role');

-- Enable Realtime for messages and sessions (CTA sync)
ALTER PUBLICATION supabase_realtime ADD TABLE webinar_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE webinar_sessions;
