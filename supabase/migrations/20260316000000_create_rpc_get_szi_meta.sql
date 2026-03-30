-- RPC SECURITY DEFINER to bypass RLS on nekt_meta26_metas
CREATE OR REPLACE FUNCTION get_szi_meta(meta_date TEXT)
RETURNS TABLE (
  won_szi_meta_pago NUMERIC,
  won_szi_meta_direto NUMERIC
) AS $$
  SELECT n.won_szi_meta_pago, n.won_szi_meta_direto
  FROM nekt_meta26_metas n
  WHERE n.data = meta_date
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
