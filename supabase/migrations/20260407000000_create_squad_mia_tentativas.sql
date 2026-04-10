-- squad_mia_tentativas: atividades de Tentativa de contato pela MIA sincronizadas da Nekt
-- Foco: 1ª/2ª Tentativa de contato pela MIA + Encerramento de Fluxo de Cadência
CREATE TABLE IF NOT EXISTS squad_mia_tentativas (
  id                  BIGSERIAL PRIMARY KEY,
  deal_id             INTEGER NOT NULL,
  deal_title          TEXT,
  owner_name          TEXT,
  proprietario        TEXT,
  pipeline_id         INTEGER,
  status              TEXT,                     -- won, lost, open
  etapa               TEXT,
  etapa_order         INTEGER,
  link_conversa       TEXT,
  pessoa_nome         TEXT,
  pessoa_telefone     TEXT,
  cidade              TEXT,
  has_1a_tentativa    BOOLEAN NOT NULL DEFAULT FALSE,
  has_2a_tentativa    BOOLEAN NOT NULL DEFAULT FALSE,
  has_encerramento    BOOLEAN NOT NULL DEFAULT FALSE,
  num_tentativas      INTEGER NOT NULL DEFAULT 0,
  first_attempt_at    TIMESTAMPTZ,
  last_attempt_at     TIMESTAMPTZ,
  encerrmento_at       TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- foreign keys para referencia
  fk_activity_1a      BIGINT,
  fk_activity_2a      BIGINT,
  fk_activity_enc     BIGINT
);

CREATE INDEX IF NOT EXISTS idx_mia_deal_id    ON squad_mia_tentativas (deal_id);
CREATE INDEX IF NOT EXISTS idx_mia_status     ON squad_mia_tentativas (status);
CREATE INDEX IF NOT EXISTS idx_mia_owner      ON squad_mia_tentativas (owner_name);
CREATE INDEX IF NOT EXISTS idx_mia_num_tent   ON squad_mia_tentativas (num_tentativas);
CREATE INDEX IF NOT EXISTS idx_mia_synced    ON squad_mia_tentativas (synced_at DESC);
