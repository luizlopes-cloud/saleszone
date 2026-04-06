/**
 * Paginated fetch from Supabase (handles >1000 rows).
 * Usage: await paginate((o, ps) => supabase.from("table").select("*").range(o, o + ps - 1));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function paginate(buildQuery: (offset: number, ps: number) => any): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await buildQuery(offset, PS);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PS) break;
    offset += PS;
  }
  return rows;
}
