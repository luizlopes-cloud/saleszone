-- Tabela de orçamento mensal global SZI
CREATE TABLE squad_orcamento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mes text NOT NULL UNIQUE,          -- 'YYYY-MM'
  orcamento_total numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE squad_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON squad_orcamento FOR ALL USING (true) WITH CHECK (true);
