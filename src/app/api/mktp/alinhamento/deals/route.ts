// MKTP (Marketplace) module
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";

const mc = getModuleConfig("mktp");

export const dynamic = "force-dynamic";

const PIPEDRIVE_DOMAIN = "seazone-fd92b9.pipedrive.com";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchOwner(colName: string, ownerName: string): boolean {
  return normalize(ownerName).includes(normalize(colName));
}

// Build map: empreendimento → { correctPV, correctVIndices, squadId }
// When sq.empreendimentos is empty, map is populated lazily from DB data
function buildSquadMap(dbEmpreendimentos?: Set<string>) {
  const map = new Map<string, { correctPV: string; correctVIndices: number[]; squadId: number }>();
  for (const sq of mc.squads) {
    const vIndices = mc.squadCloserMap[sq.id] || [];
    const emps = sq.empreendimentos.length > 0 ? sq.empreendimentos : [...(dbEmpreendimentos || [])];
    for (const emp of emps) {
      map.set(emp, { correctPV: sq.preVenda, correctVIndices: vIndices, squadId: sq.id });
    }
  }
  return map;
}

const PV_COLS = mc.presellers;
const V_COLS = mc.closers;

interface MisalignedDeal {
  deal_id: number;
  title: string;
  empreendimento: string;
  owner_name: string;
  link: string;
}

export async function GET() {
  try {
    const { data: deals, error } = await supabase
      .from("mktp_alignment_deals")
      .select("deal_id, title, empreendimento, owner_name");

    if (error) throw new Error(`Supabase error: ${error.message}`);

    // Collect unique empreendimentos from DB data for dynamic discovery
    const dbEmps = new Set<string>();
    for (const deal of deals || []) {
      if (deal.empreendimento) dbEmps.add(deal.empreendimento);
    }

    const squadMap = buildSquadMap(dbEmps);

    // Group misaligned deals by person (PV or V column name)
    const byPerson = new Map<string, { role: "pv" | "v"; deals: MisalignedDeal[] }>();

    for (const deal of deals || []) {
      const info = squadMap.get(deal.empreendimento);
      if (!info) continue;

      // Check which PV/V column this owner matches
      let matchedPV: string | null = null;
      let matchedV: string | null = null;

      for (const col of PV_COLS) {
        if (matchOwner(col, deal.owner_name)) { matchedPV = col; break; }
      }
      for (const col of V_COLS) {
        if (matchOwner(col, deal.owner_name)) { matchedV = col; break; }
      }

      const dealInfo: MisalignedDeal = {
        deal_id: deal.deal_id,
        title: deal.title,
        empreendimento: deal.empreendimento,
        owner_name: deal.owner_name,
        link: `https://${PIPEDRIVE_DOMAIN}/deal/${deal.deal_id}`,
      };

      // Check PV misalignment
      if (matchedPV && !matchOwner(info.correctPV, deal.owner_name)) {
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
    console.error("MKTP Alinhamento deals error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
