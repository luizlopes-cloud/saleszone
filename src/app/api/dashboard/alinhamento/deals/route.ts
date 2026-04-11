import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SQUADS, PV_COLS, V_COLS, SQUAD_V_MAP } from "@/lib/constants";
import { paginate } from "@/lib/paginate";
import type { MisalignedDeal } from "@/lib/types";

export const dynamic = "force-dynamic";

// squad_deals lives in the squad project, NOT the main saleszone project
const SQUAD_SUPABASE_URL = "https://cncistmevwwghtaiyaao.supabase.co";

const PIPEDRIVE_DOMAIN = "seazone-fd92b9.pipedrive.com";

function nfd(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchOwner(colName: string, ownerName: string): boolean {
  if (!colName || !ownerName) return false;
  const c = nfd(colName);
  const o = nfd(ownerName);
  return o.includes(c) || c.includes(o);
}

// SZI Pipeline 28 stage_ids (from nekt_pipedrive_stages)
const SZI_STAGE_IDS = new Set([392, 184, 186, 338, 346, 339, 187, 340, 208, 312, 313, 311, 191, 192]);

export async function GET() {
  try {
    const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!srvKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
    const admin = createClient(SQUAD_SUPABASE_URL, srvKey);

    // Read all open deals from squad_deals for SZI pipeline
    const deals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("deal_id, title, owner_name, stage_id, stage_order, empreendimento")
        .eq("status", "open")
        .in("stage_id", [...SZI_STAGE_IDS])
        .not("lost_reason", "eq", "Duplicado/Erro")
        .range(o, o + ps - 1),
    );

    // Build squad map: empreendimento → { correctPV, correctVIndices }
    const squadMap = new Map<string, { correctPV: string; correctVIndices: number[] }>();
    for (const sq of SQUADS) {
      const vIndices = SQUAD_V_MAP[sq.id] || [];
      for (const emp of sq.empreendimentos) {
        squadMap.set(emp, { correctPV: sq.preVenda, correctVIndices: vIndices });
      }
    }

    // Group misaligned deals by person (PV or V column name)
    const byPerson = new Map<string, { role: "pv" | "v"; deals: MisalignedDeal[] }>();

    for (const deal of deals) {
      if (!deal.empreendimento) continue;
      const info = squadMap.get(deal.empreendimento);
      if (!info) continue; // skip unknown empreendimentos

      const dealInfo: MisalignedDeal = {
        deal_id: deal.deal_id,
        title: deal.title || `Deal #${deal.deal_id}`,
        owner_name: deal.owner_name || "Sem dono",
        empreendimento: deal.empreendimento,
        link: `https://${PIPEDRIVE_DOMAIN}/deal/${deal.deal_id}`,
      };

      // Determine which column the current owner matches (PV or V)
      let matchedPV: string | null = null;
      let matchedV: string | null = null;

      for (const col of PV_COLS) {
        if (matchOwner(col, deal.owner_name || "")) { matchedPV = col; break; }
      }
      for (const col of V_COLS) {
        if (matchOwner(col, deal.owner_name || "")) { matchedV = col; break; }
      }

      // Check PV misalignment
      if (matchedPV && !matchOwner(info.correctPV, deal.owner_name || "")) {
        if (!byPerson.has(matchedPV)) byPerson.set(matchedPV, { role: "pv", deals: [] });
        byPerson.get(matchedPV)!.deals.push(dealInfo);
      }

      // Check V misalignment
      if (matchedV) {
        const vIdx = V_COLS.indexOf(matchedV);
        if (!info.correctVIndices.includes(vIdx)) {
          if (!byPerson.has(matchedV)) byPerson.set(matchedV, { role: "v", deals: [] });
          byPerson.get(matchedV)!.deals.push(dealInfo);
        }
      }
    }

    const result = Array.from(byPerson.entries()).map(([person, data]) => ({
      person,
      role: data.role,
      deals: data.deals.sort((a, b) => a.empreendimento.localeCompare(b.empreendimento)),
    }));

    return NextResponse.json({ byPerson: result });
  } catch (error) {
    console.error("Alinhamento deals error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
