/**
 * Fix stale deal statuses by cross-referencing with nekt_pipedrive_deals.
 * Runs without hitting Pipedrive API — uses Nekt data (updates 4h and 12h).
 *
 * Usage: npx tsx scripts/fix-stale-deals.ts
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TABLES: Array<[string, number]> = [
  ["squad_deals", 28],
  ["mktp_deals", 37],
  ["szs_deals", 14],
  ["decor_deals", 44],
];

async function fixTable(table: string, _pipeline: number) {
  const { data: openDeals } = await sb.from(table).select("deal_id").eq("status", "open");
  const ids = (openDeals || []).map((d) => d.deal_id);
  console.log(`\n${table}: ${ids.length} open deals`);

  let updated = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);

    // Check nekt v1 (most complete)
    const { data: nektRows } = await sb
      .from("nekt_pipedrive_deals")
      .select("nekt_id, status, ganho_em, data_de_perda")
      .in("nekt_id", batch)
      .neq("status", "open");

    for (const n of nektRows || []) {
      const upd: Record<string, unknown> = { status: n.status };
      if (n.ganho_em) upd.won_time = n.ganho_em;
      if (n.data_de_perda) upd.lost_time = n.data_de_perda;
      const { error } = await sb.from(table).update(upd).eq("deal_id", n.nekt_id);
      if (!error) updated++;
    }
  }

  const { count } = await sb.from(table).select("*", { count: "exact", head: true }).eq("status", "open");
  console.log(`  Updated: ${updated} | Open after: ${count}`);
}

async function main() {
  console.log("Fixing stale deal statuses from nekt_pipedrive_deals...");
  for (const [table, pipeline] of TABLES) {
    await fixTable(table, pipeline);
  }
  console.log("\nDone.");
}

main();
