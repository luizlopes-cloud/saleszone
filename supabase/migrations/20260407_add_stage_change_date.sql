ALTER TABLE squad_deals ADD COLUMN IF NOT EXISTS stage_change_date TIMESTAMPTZ;
ALTER TABLE squad_deals ADD COLUMN IF NOT EXISTS tipo_de_venda TEXT;
ALTER TABLE squad_calendar_events ADD COLUMN IF NOT EXISTS attendees_emails JSONB DEFAULT '[]';
