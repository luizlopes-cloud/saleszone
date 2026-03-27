// SZS (Serviços) module — alinhamento por cidade e analista
import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { AlinhamentoData } from "@/lib/types";

const mc = getModuleConfig("szs");

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginate(buildQuery: (offset: number, ps: number) => any): Promise<any[]> {
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

// Agrupar cidades em 4 grupos
function getCidadeGroup(cidade: string): string {
  const lower = cidade.toLowerCase();
  if (lower.includes("são paulo") || lower.includes("sao paulo")) return "São Paulo";
  if (lower.includes("salvador")) return "Salvador";
  if (lower.includes("florianópolis") || lower.includes("florianopolis")) return "Florianópolis";
  return "Outros";
}

const CIDADE_GROUP_ORDER = ["São Paulo", "Salvador", "Florianópolis", "Outros"];

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

    // Buscar deals abertos do SZS direto de szs_deals
    const deals = await paginate((o, ps) =>
      admin
        .from("szs_deals")
        .select("empreendimento, owner_name, preseller_name, lost_reason")
        .eq("status", "open")
        .not("empreendimento", "is", null)
        .range(o, o + ps - 1)
    );

    // Agrupar deals por grupo de cidade × owner
    const groupOwner = new Map<string, Map<string, number>>();
    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const cidade = d.empreendimento;
      if (!cidade) continue;
      const group = getCidadeGroup(cidade);
      if (!groupOwner.has(group)) groupOwner.set(group, new Map());
      const ownerMap = groupOwner.get(group)!;
      const owner = d.owner_name || "Sem owner";
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    }

    const PV_COLS = mc.presellers;
    const V_COLS = mc.closers;

    // Build rows: 4 grupos como "empreendimentos" de 1 squad
    const rows = CIDADE_GROUP_ORDER.map((group, idx) => {
      const owners = groupOwner.get(group) || new Map<string, number>();
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

      return {
        sqId: 1,
        sqName: "Serviços",
        emp: group,
        correctPV: "",
        correctV: "",
        cells: { pv, v },
      };
    });

    // Stats
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
    console.error("SZS Alinhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
