-- Allow OPORTUNIDADE as a valid severity value for Meta Ads diagnostics
ALTER TABLE squad_meta_ads DROP CONSTRAINT IF EXISTS squad_meta_ads_severidade_check;
ALTER TABLE squad_meta_ads ADD CONSTRAINT squad_meta_ads_severidade_check
  CHECK (severidade IN ('OK', 'ALERTA', 'CRITICO', 'OPORTUNIDADE'));
