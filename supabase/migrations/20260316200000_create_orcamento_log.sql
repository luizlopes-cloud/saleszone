CREATE TABLE IF NOT EXISTS squad_orcamento_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  empreendimento TEXT NOT NULL,
  squad_id INT NOT NULL,
  budget_recomendado NUMERIC NOT NULL,
  budget_real NUMERIC NOT NULL,
  explicacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (date, empreendimento)
);

ALTER TABLE squad_orcamento_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON squad_orcamento_log FOR SELECT USING (true);
CREATE POLICY "Allow service insert" ON squad_orcamento_log FOR INSERT WITH CHECK (true);
