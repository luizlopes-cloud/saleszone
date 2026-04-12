import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import { getMktpCanalName } from "@/lib/mktp-utils";
import { paginate } from "@/lib/paginate";
import type { AlinhamentoData } from "@/lib/types";

const mc = getModuleConfig("mktp");

export const dynamic = "force-dynamic";

function nfd(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchName(colName: string, ownerName: string): boolean {
  if (!colName || !ownerName) return false;
  const c = nfd(colName);
  const o = nfd(ownerName);
  // Match if either contains the other (handles "Nevine" vs "Nevine Saratt")
  return o.includes(c) || c.includes(o);
}

export async function GET() {
  try {
    const admin = createSquadSupabaseAdmin();

    const deals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("canal, owner_name, preseller_name, lost_reason")
        .eq("status", "open")
        .range(o, o + ps - 1)
    );

    // Group by canal → owner / preseller → count
    const group = new Map<string, { owners: Map<string, number>; presellers: Map<string, number> }>();
    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;

      const canal = d.canal || "Outros";
      if (!group.has(canal)) group.set(canal, { owners: new Map(), presellers: new Map() });

      const { owners, presellers } = group.get(canal)!;

      // Closer = owner_name
      const owner = d.owner_name || "Sem owner";
      owners.set(owner, (owners.get(owner) || 0) + 1);

      // Pré-venda = preseller_name (from Pipedrive "Pré Vendedor(a)" field)
      // Use owner_name as fallback when preseller_name is null (some deals may have PV as owner)
      const pvRaw = d.preseller_name || d.owner_name || "Sem PV";
      const pv = pvRaw.includes("@") ? "Sem PV" : pvRaw; // email-like → not a name
      presellers.set(pv, (presellers.get(pv) || 0) + 1);
    }

    const PV_COLS = mc.presellers; // ["Karoane Izabela Soares", "Karoline Borges"]
    const V_COLS = mc.closers;       // ["Nevine Saratt", "Willian Miranda"]

    const rows: AlinhamentoData["rows"] = [];
    const allCanals = Array.from(group.keys()).sort();

    for (const canal of allCanals) {
      const { owners, presellers } = group.get(canal)!;

      const pv: Record<string, number> = {};
      const v: Record<string, number> = {};

      PV_COLS.forEach((col) => {
        let total = 0;
        for (const [pvName, cnt] of presellers) {
          if (matchName(col, pvName)) total += cnt;
        }
        pv[col] = total;
      });

      V_COLS.forEach((col) => {
        let total = 0;
        for (const [ownerName, cnt] of owners) {
          if (matchName(col, ownerName)) total += cnt;
        }
        v[col] = total;
      });

      const canalName = getMktpCanalName(canal);
      rows.push({
        sqId: 1,
        sqName: mc.squads[0]?.name || "Marketplace",
        emp: canalName,
        correctPV: mc.presellers.join(", "),
        correctV: mc.closers.join(", "),
        cells: { pv, v },
      });
    }

    let total = 0;
    let ok = 0;
    rows.forEach((row) => {
      PV_COLS.forEach((p) => { total += row.cells.pv[p] || 0; });
      V_COLS.forEach((p) => { total += row.cells.v[p] || 0; });
    });

    // All matched since MKTP has no misaligned concept here
    const mis = 0;

    const result: AlinhamentoData = {
      rows,
      stats: { total, ok: total, mis },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("MKTP Alinhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}