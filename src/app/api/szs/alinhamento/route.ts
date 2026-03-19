// SZS (Serviços) module — alinhamento with canal_group as squad
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { AlinhamentoData } from "@/lib/types";

const mc = getModuleConfig("szs");

const CANAL_GROUP_ORDER = ["Marketing", "Parceiros", "Expansão", "Spots", "Outros"];

export const dynamic = "force-dynamic";

// Paginated fetch helper (Supabase 1000-row limit)
async function fetchAllPaginated(query: any): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function GET() {
  try {
    // Fetch alignment data from Supabase
    const alignRows = await fetchAllPaginated(
      supabase
        .from("szs_alignment")
        .select("empreendimento, canal_group, owner_name, count")
    );

    // Build owner counts map: canal_group|cidade → { owner → count }
    const ownerCounts = new Map<string, Map<string, number>>();
    for (const row of alignRows) {
      const canalGroup = row.canal_group || "Outros";
      const cidade = row.empreendimento;
      const gKey = `${canalGroup}|${cidade}`;
      if (!ownerCounts.has(gKey)) {
        ownerCounts.set(gKey, new Map());
      }
      const ownerMap = ownerCounts.get(gKey)!;
      ownerMap.set(row.owner_name, (ownerMap.get(row.owner_name) || 0) + row.count);
    }

    // Match owner names (case-insensitive, accent-insensitive partial match)
    function normalize(s: string): string {
      return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }
    function matchOwner(colName: string, ownerName: string): boolean {
      return normalize(ownerName).includes(normalize(colName));
    }

    const PV_COLS = mc.presellers;
    const V_COLS = mc.closers;

    // Build rows: each canal_group = squad, cidades within each group = empreendimentos
    const rows = CANAL_GROUP_ORDER.flatMap((canalGroup, idx) => {
      const sqId = idx + 1;
      const sqName = canalGroup;

      // Find all cidades for this canal group
      const cidadeSet = new Set<string>();
      for (const gKey of ownerCounts.keys()) {
        if (gKey.startsWith(canalGroup + "|")) {
          cidadeSet.add(gKey.split("|")[1]);
        }
      }
      const sortedCidades = Array.from(cidadeSet).sort();

      return sortedCidades.map((cidade) => {
        const gKey = `${canalGroup}|${cidade}`;
        const counts = ownerCounts.get(gKey) || new Map<string, number>();
        const pv: Record<string, number> = {};
        const v: Record<string, number> = {};

        PV_COLS.forEach((col) => {
          let total = 0;
          for (const [owner, count] of counts) {
            if (matchOwner(col, owner)) total += count;
          }
          pv[col] = total;
        });

        V_COLS.forEach((col) => {
          let total = 0;
          for (const [owner, count] of counts) {
            if (matchOwner(col, owner)) total += count;
          }
          v[col] = total;
        });

        return {
          sqId,
          sqName,
          emp: cidade,
          correctPV: mc.squads[0]?.preVenda || "",
          correctV: mc.squads[0]?.venda || "",
          cells: { pv, v },
        };
      });
    });

    // Stats
    let total = 0;
    let mis = 0;
    rows.forEach((row) => {
      PV_COLS.forEach((p) => {
        const val = row.cells.pv[p] || 0;
        total += val;
        if (val > 0 && p !== row.correctPV) mis += val;
      });
      V_COLS.forEach((p) => {
        const val = row.cells.v[p] || 0;
        total += val;
      });
    });

    const result: AlinhamentoData = {
      rows,
      stats: { total, ok: total - mis, mis },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Alinhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
