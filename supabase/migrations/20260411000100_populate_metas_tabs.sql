BEGIN;

-- Limpa e popula metas por tab em nekt_meta26_metas
-- Ratios 90d: mql_sql=4.12, sql_opp=3.47, opp_won=6.01

-- 2026-01
UPDATE nekt_meta26_metas SET
  mql_meta_szi = 2189, sql_meta_szi = 530, opp_meta_szi = 153,
  mql_meta_szs = 280, sql_meta_szs = 68, opp_meta_szs = 20
WHERE data = '01/01/2026';

-- 2026-02
UPDATE nekt_meta26_metas SET
  mql_meta_szi = 2758, sql_meta_szi = 668, opp_meta_szi = 192,
  mql_meta_szs = 267, sql_meta_szs = 65, opp_meta_szs = 19
WHERE data = '01/02/2026';

-- 2026-03
UPDATE nekt_meta26_metas SET
  mql_meta_szi = 2338, sql_meta_szi = 566, opp_meta_szi = 164,
  mql_meta_szs = 305, sql_meta_szs = 74, opp_meta_szs = 21
WHERE data = '01/03/2026';

-- 2026-04
UPDATE nekt_meta26_metas SET
  mql_meta_szi = 1576, sql_meta_szi = 382, opp_meta_szi = 110,
  mql_meta_szs = 196, sql_meta_szs = 48, opp_meta_szs = 14
WHERE data = '01/04/2026';

-- 2026-05
UPDATE nekt_meta26_metas SET
  mql_meta_szi = 1920, sql_meta_szi = 466, opp_meta_szi = 134,
  mql_meta_szs = 173, sql_meta_szs = 42, opp_meta_szs = 12
WHERE data = '01/05/2026';

-- 2026-06
UPDATE nekt_meta26_metas SET
  mql_meta_szi = 1526, sql_meta_szi = 370, opp_meta_szi = 106,
  mql_meta_szs = 235, sql_meta_szs = 57, opp_meta_szs = 16
WHERE data = '01/06/2026';

COMMIT;