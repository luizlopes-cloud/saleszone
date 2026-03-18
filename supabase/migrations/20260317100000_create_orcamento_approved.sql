-- Budget recomendado aprovado por empreendimento/mês
-- Valores só mudam quando o usuário aprova explicitamente
CREATE TABLE IF NOT EXISTS squad_orcamento_approved (
  mes TEXT NOT NULL,
  empreendimento TEXT NOT NULL,
  budget_recomendado NUMERIC NOT NULL DEFAULT 0,
  explicacao TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  PRIMARY KEY (mes, empreendimento)
);

-- Seed com valores aprovados em 2026-03-16
INSERT INTO squad_orcamento_approved (mes, empreendimento, budget_recomendado, explicacao, approved_by)
VALUES
  ('2026-03', 'Ponta das Canas Spot II', 1353, 'Campanha ativa com WON nos 90d. Escalar.', 'seed'),
  ('2026-03', 'Itacaré Spot', 300, 'Piso mínimo.', 'seed'),
  ('2026-03', 'Marista 144 Spot', 300, 'Piso mínimo.', 'seed'),
  ('2026-03', 'Natal Spot', 1618, 'Campanha ativa com WON nos 90d. Reduzir -10%.', 'seed'),
  ('2026-03', 'Novo Campeche Spot II', 1895, 'Campanha ativa com WON nos 90d.', 'seed'),
  ('2026-03', 'Caraguá Spot', 300, 'Piso mínimo.', 'seed'),
  ('2026-03', 'Bonito Spot II', 300, 'Piso mínimo.', 'seed'),
  ('2026-03', 'Jurerê Spot II', 300, 'Piso mínimo.', 'seed'),
  ('2026-03', 'Jurerê Spot III', 300, 'Piso mínimo.', 'seed'),
  ('2026-03', 'Barra Grande Spot', 1610, 'Campanha ativa com WON nos 90d. Manter.', 'seed'),
  ('2026-03', 'Vistas de Anitá II', 300, 'Piso mínimo.', 'seed')
ON CONFLICT (mes, empreendimento) DO NOTHING;
