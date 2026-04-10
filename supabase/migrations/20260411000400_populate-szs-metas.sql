-- SZS metas by month (from spreadsheet)
DELETE FROM szs_metas;

-- Marketing (squad_id=1): won_szs_meta_pago
INSERT INTO szs_metas (month, squad_id, tab, meta) VALUES
('2026-01-01', 1, 'won', 71),
('2026-02-01', 1, 'won', 70),
('2026-03-01', 1, 'won', 73),
('2026-04-01', 1, 'won', 69),
('2026-05-01', 1, 'won', 70),
('2026-06-01', 1, 'won', 77),
('2026-07-01', 1, 'won', 70),
('2026-08-01', 1, 'won', 72),
('2026-09-01', 1, 'won', 75);

-- Parceiros (squad_id=2): won_szs_meta_parceiro
INSERT INTO szs_metas (month, squad_id, tab, meta) VALUES
('2026-01-01', 2, 'won', 67),
('2026-02-01', 2, 'won', 71),
('2026-03-01', 2, 'won', 73),
('2026-04-01', 2, 'won', 74),
('2026-05-01', 2, 'won', 75),
('2026-06-01', 2, 'won', 77),
('2026-07-01', 2, 'won', 71),
('2026-08-01', 2, 'won', 87),
('2026-09-01', 2, 'won', 100),
('2026-10-01', 2, 'won', 116),
('2026-11-01', 2, 'won', 127),
('2026-12-01', 2, 'won', 141);

-- Expansão (squad_id=4): won_szs_meta_exp
INSERT INTO szs_metas (month, squad_id, tab, meta) VALUES
('2026-01-01', 4, 'won', 72),
('2026-02-01', 4, 'won', 84),
('2026-03-01', 4, 'won', 95);

-- Spots (squad_id=5): won_szs_meta_spot
INSERT INTO szs_metas (month, squad_id, tab, meta) VALUES
('2026-01-01', 5, 'won', 48),
('2026-02-01', 5, 'won', 17),
('2026-03-01', 5, 'won', 39),
('2026-04-01', 5, 'won', 17),
('2026-05-01', 5, 'won', 0),
('2026-06-01', 5, 'won', 49),
('2026-07-01', 5, 'won', 0),
('2026-08-01', 5, 'won', 0),
('2026-09-01', 5, 'won', 28),
('2026-10-01', 5, 'won', 0),
('2026-11-01', 5, 'won', 0),
('2026-12-01', 5, 'won', 0);

-- Outros (squad_id=6): won_szs_meta_direto
INSERT INTO szs_metas (month, squad_id, tab, meta) VALUES
('2026-01-01', 6, 'won', 34),
('2026-02-01', 6, 'won', 28),
('2026-03-01', 6, 'won', 36),
('2026-04-01', 6, 'won', 32),
('2026-05-01', 6, 'won', 32),
('2026-06-01', 6, 'won', 31),
('2026-07-01', 6, 'won', 30),
('2026-08-01', 6, 'won', 31),
('2026-09-01', 6, 'won', 31);