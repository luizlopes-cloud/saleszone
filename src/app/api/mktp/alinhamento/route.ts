// MKTP (Marketplace) module — alinhamento por canal
import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { AlinhamentoData } from "@/lib/types";
import { paginate } from "@/lib/paginate";
import { getMktpCanalName } from "@/lib/mktp-utils";

const mc = getModuleConfig("mktp");

export const dynamic = "force-dynamic";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchOwner(colName: string, ownerName: string): boolean {
  if (!colName || !ownerName) return false;
  return normalize(ownerName).includes(normalize(colName));
}

export async function GET() {
  try {
    const admin = createSquadSupabaseAdmin();

    const deals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("canal, owner_name, lost_reason")
        .eq("status", "open")
        .range(o, o + ps - 1)
    );

    // Group by canal × owner
    const groupOwner = new Map<string, Map<string, number>>();
    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const canalName = getMktpCanalName(d.canal);
      if (!groupOwner.has(canalName)) groupOwner.set(canalName, new Map());
      const ownerMap = groupOwner.get(canalName)!;
      const owner = d.owner_name || "Sem owner";
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    }

    const PV_COLS = mc.presellers;
    const V_COLS = mc.closers;

    const rows: AlinhamentoData["rows"] = [];
    const allCanals = Array.from(groupOwner.keys()).sort();

    for (const canalName of allCanals) {
      const owners = groupOwner.get(canalName) || new Map<string, number>();
      const pv: Record<string, number> = {};
      const v: Record<string, number> = {};

      PV_COLS.forEach((col) => {
        let total = 0;
        for (const [owner, count] of owners) {
          if (matchOwner(col, owner)) total += count;
        }
        pv[col] = total;
      });

      V_COLS.forEach((col) => {
        let total = 0;
        for (const [owner, count] of owners) {
          if (matchOwner(col, owner)) total += count;
        }
        v[col] = total;
      });

      rows.push({
        sqId: 1,
        sqName: mc.squads[0]?.name || "Marketplace",
        emp: canalName,
        correctPV: mc.squads[0]?.preVenda || "",
        correctV: mc.squads[0]?.venda || "",
        cells: { pv, v },
      });
    }

    let total = 0;
    rows.forEach((row) => {
      PV_COLS.forEach((p) => { total += row.cells.pv[p] || 0; });
      V_COLS.forEach((p) => { total += row.cells.v[p] || 0; });
    });

    const result: AlinhamentoData = {
      rows,
      stats: { total, ok: total, mis: 0 },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("MKTP Alinhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
