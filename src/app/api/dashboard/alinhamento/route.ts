import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS, PV_COLS, V_COLS, SQUAD_V_MAP } from "@/lib/constants";
import type { AlinhamentoData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch alignment data from Supabase
    const { data: alignRows, error } = await supabase
      .from("squad_alignment")
      .select("empreendimento, owner_name, count");

    if (error) throw new Error(`Supabase error: ${error.message}`);

    // Build owner counts map: empreendimento → { owner → count }
    const ownerCounts = new Map<string, Map<string, number>>();
    for (const row of alignRows || []) {
      if (!ownerCounts.has(row.empreendimento)) {
        ownerCounts.set(row.empreendimento, new Map());
      }
      ownerCounts.get(row.empreendimento)!.set(row.owner_name, row.count);
    }

    // Match owner names (case-insensitive, accent-insensitive partial match)
    function normalize(s: string): string {
      return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }
    function matchOwner(colName: string, ownerName: string): boolean {
      return normalize(ownerName).includes(normalize(colName));
    }

    // Build flat rows
    const rows = SQUADS.flatMap((sq) =>
      sq.empreendimentos.map((emp) => {
        const counts = ownerCounts.get(emp) || new Map<string, number>();
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
          sqId: sq.id,
          sqName: sq.name,
          emp,
          correctPV: sq.preVenda,
          correctV: sq.venda,
          cells: { pv, v },
        };
      })
    );

    // Stats
    let total = 0;
    let mis = 0;
    rows.forEach((row) => {
      PV_COLS.forEach((p) => {
        const val = row.cells.pv[p] || 0;
        total += val;
        if (val > 0 && p !== row.correctPV) mis += val;
      });
      const sqVIndices = SQUAD_V_MAP[row.sqId] || [];
      V_COLS.forEach((p, idx) => {
        const val = row.cells.v[p] || 0;
        total += val;
        if (val > 0 && !sqVIndices.includes(idx)) mis += val;
      });
    });

    const result: AlinhamentoData = {
      rows,
      stats: { total, ok: total - mis, mis },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Alinhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
