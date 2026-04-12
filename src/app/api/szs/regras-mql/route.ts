// SZS (Serviços) module
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";
import { MQL_INTENCOES, MQL_FAIXAS, MQL_PAGAMENTOS, SQUAD_FROM_COMMERCIAL } from "@/lib/constants";
import type { RegrasMqlData, RegrasMqlFonte, RegrasMqlEmp, RegrasMqlSquad } from "@/lib/types";

const mc = getModuleConfig("szs");

export const dynamic = "force-dynamic";

const TOTAL_INT = MQL_INTENCOES.length;
const TOTAL_FAIXAS = MQL_FAIXAS.length;
const TOTAL_PAG = MQL_PAGAMENTOS.length;

const IGNORE_NAMES = new Set(["LP WordPress", "Teste Empreendimento"]);

function extractLabel(campaignName: string, tipo: "lp" | "campanha"): string {
  if (tipo === "lp") return "LP WordPress";
  return campaignName;
}

export async function GET() {
  try {
    // 1. Buscar Baserow — SZS uses szs_baserow_empreendimentos
    const { data: rows, error: errRows } = await supabase
      .from("szs_baserow_empreendimentos")
      .select("nome, campaign_name, commercial_squad, mql_intencoes, mql_faixas, mql_pagamentos, status, id")
      .eq("status", true)
      .neq("nome", "")
      .order("id", { ascending: false });

    if (errRows) throw new Error(`Supabase baserow error: ${errRows.message}`);

    // 2. Buscar campanhas ativas do Meta Ads (snapshot mais recente)
    const { data: metaRows, error: errMeta } = await supabase
      .from("szs_meta_ads")
      .select("campaign_name, snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);

    let latestDate: string | null = null;
    if (!errMeta && metaRows && metaRows.length > 0) {
      latestDate = metaRows[0].snapshot_date;
    }

    const activeCampaigns = new Set<string>();
    if (latestDate) {
      const { data: activeRows } = await supabase
        .from("szs_meta_ads")
        .select("campaign_name")
        .eq("snapshot_date", latestDate);
      if (activeRows) {
        for (const r of activeRows) {
          activeCampaigns.add(r.campaign_name);
        }
      }
    }

    // 3. Filtrar e agrupar por empreendimento
    const empMap = new Map<string, { sqId: number; fontes: RegrasMqlFonte[] }>();

    for (const row of rows || []) {
      if (IGNORE_NAMES.has(row.nome)) continue;
      const sqId = SQUAD_FROM_COMMERCIAL[row.commercial_squad];
      if (!sqId) continue;

      const cn = (row.campaign_name || "") as string;

      let tipo: "lp" | "campanha";
      // TODO: SZS campaign prefix may differ from [SI]
      if (cn.startsWith("LP ")) {
        tipo = "lp";
      } else if (cn.startsWith("[MK]") || cn.startsWith("[SI]")) {
        tipo = "campanha";
        if (!activeCampaigns.has(cn)) continue;
      } else {
        continue;
      }

      const intencoes = (row.mql_intencoes || []) as string[];
      const faixas = (row.mql_faixas || []) as string[];
      const pagamentos = (row.mql_pagamentos || []) as string[];

      const aberturaIntencoes = Math.round((intencoes.length / TOTAL_INT) * 100);
      const aberturaFaixas = Math.round((faixas.length / TOTAL_FAIXAS) * 100);
      const aberturaPagamentos = Math.round((pagamentos.length / TOTAL_PAG) * 100);
      const aberturaGeral = Math.round(((intencoes.length / TOTAL_INT + faixas.length / TOTAL_FAIXAS + pagamentos.length / TOTAL_PAG) / 3) * 100);

      const fonte: RegrasMqlFonte = {
        campaignName: cn,
        tipo,
        labelCurto: extractLabel(cn, tipo),
        intencoes,
        faixas,
        pagamentos,
        aberturaIntencoes,
        aberturaFaixas,
        aberturaPagamentos,
        aberturaGeral,
      };

      if (!empMap.has(row.nome)) {
        empMap.set(row.nome, { sqId, fontes: [] });
      }
      empMap.get(row.nome)!.fontes.push(fonte);
    }

    // 4. Montar empreendimentos e agrupar por squad
    const squadEmps = new Map<number, RegrasMqlEmp[]>();

    for (const [nome, { sqId, fontes }] of empMap) {
      fontes.sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === "campanha" ? -1 : 1;
        return 0;
      });

      const aberturaGeral = fontes.length > 0
        ? Math.round(fontes.reduce((s, f) => s + f.aberturaGeral, 0) / fontes.length)
        : 0;

      const emp: RegrasMqlEmp = { nome, fontes, aberturaGeral };

      if (!squadEmps.has(sqId)) squadEmps.set(sqId, []);
      squadEmps.get(sqId)!.push(emp);
    }

    const squads: RegrasMqlSquad[] = mc.squads.map((sq) => {
      const emps = squadEmps.get(sq.id) || [];
      const aberturaMedia = emps.length > 0
        ? Math.round(emps.reduce((s, e) => s + e.aberturaGeral, 0) / emps.length)
        : 0;
      return {
        id: sq.id,
        name: sq.name,
        empreendimentos: emps.sort((a, b) => a.nome.localeCompare(b.nome)),
        aberturaMedia,
      };
    });

    const result: RegrasMqlData = { squads };
    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Regras MQL error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
