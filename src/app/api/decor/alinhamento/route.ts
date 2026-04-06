// Decor module — alinhamento por empreendimento
import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { AlinhamentoData } from "@/lib/types";
import { paginate } from "@/lib/paginate";

const mc = getModuleConfig("decor");

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
        .from("decor_deals")
        .select("empreendimento, owner_name, lost_reason")
        .eq("status", "open")
        .range(o, o + ps - 1)
    );

    // Group by empreendimento × owner
    const groupOwner = new Map<string, Map<string, number>>();
    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const emp = d.empreendimento || "Sem empreendimento";
      if (!groupOwner.has(emp)) groupOwner.set(emp, new Map());
      const ownerMap = groupOwner.get(emp)!;
      const owner = d.owner_name || "Sem owner";
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    }

    const PV_COLS = mc.presellers;
    const V_COLS = mc.closers;

    const rows: AlinhamentoData["rows"] = [];
    const allEmps = Array.from(groupOwner.keys()).sort();

    for (const emp of allEmps) {
      const owners = groupOwner.get(emp) || new Map<string, number>();
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
        sqName: mc.squads[0]?.name || "Decor",
        emp,
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
    console.error("Decor Alinhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
