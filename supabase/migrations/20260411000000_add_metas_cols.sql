-- Adiciona colunas de metas por tab em nekt_meta26_metas
-- squad_metas é sobrescrita pelo sync a cada 2h, entao metas por tab vao pra nekt_meta26_metas

ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS mql_meta_szi NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS sql_meta_szi NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS opp_meta_szi NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS mql_meta_szs NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS sql_meta_szs NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS opp_meta_szs NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS mql_meta_mktp NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS sql_meta_mktp NUMERIC DEFAULT 0;
ALTER TABLE nekt_meta26_metas ADD COLUMN IF NOT EXISTS opp_meta_mktp NUMERIC DEFAULT 0;