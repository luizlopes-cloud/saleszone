// MKTP (Marketplace) module
import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import { getMktpCanalName } from "@/lib/mktp-utils";
import { paginate } from "@/lib/paginate";
import type { MisalignedDeal } from "@/lib/types";

export const dynamic = "force-dynamic";

const mc = getModuleConfig("mktp");

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

// Build squad map lazily from DB data
function buildSquadMap(dbEmpreendimentos: Set<string>) {
  const map = new Map<string, { correctPV: string; correctVIndices: number[] }>();
  for (const sq of mc.squads) {
    const vIndices = mc.squadCloserMap[sq.id] || [];
    const emps = sq.empreendimentos.length > 0 ? sq.empreendimentos : [...dbEmpreendimentos];
    for (const emp of emps) {
      map.set(emp, { correctPV: sq.preVenda, correctVIndices: vIndices });
    }
  }
  return map;
}

const PV_COLS = mc.presellers;
const V_COLS = mc.closers;

export async function GET() {
  try {
    const admin = createSquadSupabaseAdmin();

    // Read open deals from mktp_deals directly
    // Note: lost_reason is NOT filtered in the Supabase query. Filter in JS instead.
    const deals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("deal_id, canal, title, owner_name, preseller_name, lost_reason")
        .eq("status", "open")
        .range(o, o + ps - 1),
    );

    // Collect unique empreendimentos for lazy squad map
    const dbEmps = new Set<string>();
    for (const deal of deals) {
      if (deal.lost_reason === "Duplicado/Erro") continue;
      if (deal.canal) dbEmps.add(String(deal.canal));
    }

    const squadMap = buildSquadMap(dbEmps);

    // Group misaligned deals by person
    const byPerson = new Map<string, { role: "pv" | "v"; deals: MisalignedDeal[] }>();

    for (const deal of deals) {
      if (deal.lost_reason === "Duplicado/Erro") continue;
      if (!deal.canal) continue;

      const canalKey = String(deal.canal);
      const canalName = getMktpCanalName(canalKey);
      const info = squadMap.get(canalKey);
      if (!info) continue;

      // Use preseller_name for PV, owner_name for V
      const pvRaw = deal.preseller_name || deal.owner_name || "";
      const pvClean = pvRaw.includes("@") ? "" : pvRaw;

      const dealInfo: MisalignedDeal = {
        deal_id: deal.deal_id,
        title: deal.title || `Deal #${deal.deal_id}`,
        owner_name: deal.owner_name || "Sem dono",
        empreendimento: canalName,
        link: `https://${PIPEDRIVE_DOMAIN}/deal/${deal.deal_id}`,
      };

      // Determine which PV/V column matches
      let matchedPV: string | null = null;
      let matchedV: string | null = null;

      for (const col of PV_COLS) {
        if (matchOwner(col, pvClean)) { matchedPV = col; break; }
      }
      for (const col of V_COLS) {
        if (matchOwner(col, deal.owner_name || "")) { matchedV = col; break; }
      }

      // Check PV misalignment (only when multiple squads)
      if (mc.squads.length > 1) {
        if (matchedPV && !matchOwner(info.correctPV, pvClean)) {
          if (!byPerson.has(matchedPV)) byPerson.set(matchedPV, { role: "pv", deals: [] });
          byPerson.get(matchedPV)!.deals.push(dealInfo);
        }
      }

      // Check V misalignment (only when multiple squads)
      if (mc.squads.length > 1) {
        if (matchedV) {
          const vIdx = V_COLS.indexOf(matchedV);
          if (!info.correctVIndices.includes(vIdx)) {
            if (!byPerson.has(matchedV)) byPerson.set(matchedV, { role: "v", deals: [] });
            byPerson.get(matchedV)!.deals.push(dealInfo);
          }
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
    console.error("MKTP Alinhamento deals error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
