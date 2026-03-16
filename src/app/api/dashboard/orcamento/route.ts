import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { OrcamentoData, OrcamentoSquadBreakdown, OrcamentoEmpBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const curMonth = `${year}-${String(month).padStart(2, "0")}`;
    const diasNoMes = getDaysInMonth(year, month);
    const diasPassados = now.getDate();
    const startDate = `${curMonth}-01`;

    // Último snapshot date
    const { data: latestSnap } = await supabase
      .from("squad_meta_ads")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);

    const snapshotDate = latestSnap?.[0]?.snapshot_date || now.toISOString().split("T")[0];

    // Queries paralelas
    const [orcRes, metaAllRes, metaLatestRes, funnel90Res, funnelAllRes] = await Promise.all([
      supabase.from("squad_orcamento").select("*").eq("mes", curMonth).maybeSingle(),
      // Todos snapshots do mês para max spend_month por ad
      supabase
        .from("squad_meta_ads")
        .select("ad_id, spend_month, leads_month, squad_id, empreendimento")
        .gte("snapshot_date", startDate),
      // Último snapshot para campaign_name + effective_status (contagem de campanhas ativas)
      supabase
        .from("squad_meta_ads")
        .select("ad_id, campaign_name, effective_status, squad_id, empreendimento")
        .eq("snapshot_date", snapshotDate),
      // Funil 90 dias (para budget recomendado)
      supabase.rpc("get_planejamento_counts", { months_back: 12, days_back: 90 }),
      // Funil histórico completo
      supabase.rpc("get_planejamento_counts", { months_back: -1, days_back: -1 }),
    ]);

    if (orcRes.error) console.warn("Orcamento query error:", orcRes.error.message);
    if (metaAllRes.error) console.warn("Meta all query error:", metaAllRes.error.message);
    if (metaLatestRes.error) console.warn("Meta latest query error:", metaLatestRes.error.message);

    const orcamentoTotal = Number(orcRes.data?.orcamento_total) || 0;

    // Max spend_month por ad_id em todos os snapshots do mês
    const adMaxSpend = new Map<string, { spend: number; leads: number; squadId: number; emp: string }>();
    for (const row of metaAllRes.data || []) {
      const spend = Number(row.spend_month) || 0;
      const leads = Number(row.leads_month) || 0;
      const cur = adMaxSpend.get(row.ad_id);
      if (!cur || spend > cur.spend) {
        adMaxSpend.set(row.ad_id, { spend, leads, squadId: row.squad_id, emp: row.empreendimento });
      }
    }

    // Gasto e leads por empreendimento e squad
    const empSpend = new Map<string, number>(); // emp -> spend
    const empLeads = new Map<string, number>(); // emp -> leads (for CPL)
    let gastoAtual = 0;
    for (const [, data] of adMaxSpend) {
      gastoAtual += data.spend;
      const key = `${data.squadId}:${data.emp}`;
      empSpend.set(key, (empSpend.get(key) || 0) + data.spend);
      empLeads.set(key, (empLeads.get(key) || 0) + data.leads);
    }
    gastoAtual = Math.round(gastoAtual * 100) / 100;

    // Campanhas ativas por empreendimento (dedupadas por campaign_name)
    const empCampaigns = new Map<string, Set<string>>(); // "sqId:emp" -> Set<campaign_name>
    for (const row of metaLatestRes.data || []) {
      if (row.effective_status !== "ACTIVE") continue;
      const key = `${row.squad_id}:${row.empreendimento}`;
      if (!empCampaigns.has(key)) empCampaigns.set(key, new Set());
      empCampaigns.get(key)!.add(row.campaign_name);
    }

    // Gasto diário = gasto atual / dias passados (campanhas ativas)
    // Calcular gasto de campanhas ativas apenas
    let gastoAtivo = 0;
    const activeCampaigns = new Set<string>();
    for (const row of metaLatestRes.data || []) {
      if (row.effective_status === "ACTIVE") activeCampaigns.add(row.ad_id);
    }
    for (const [adId, data] of adMaxSpend) {
      if (activeCampaigns.has(adId)) gastoAtivo += data.spend;
    }
    const gastoDiario = diasPassados > 0
      ? Math.round((gastoAtivo / diasPassados) * 100) / 100
      : 0;

    // Projeção
    const projecaoMes = diasPassados >= 3
      ? Math.round((gastoAtual / diasPassados) * diasNoMes * 100) / 100
      : Math.round(gastoDiario * diasNoMes * 100) / 100;

    const ritmoIdeal = orcamentoTotal > 0
      ? Math.round((orcamentoTotal / diasNoMes) * diasPassados * 100) / 100
      : 0;

    // Status
    let status: "ok" | "alerta" | "critico" = "ok";
    if (orcamentoTotal > 0) {
      const ratio = projecaoMes / orcamentoTotal;
      if (ratio > 1.15) status = "critico";
      else if (ratio > 1.05) status = "alerta";
    }

    // ===== Budget recomendado por empreendimento =====
    // Aggregate funnel data by empreendimento
    type FunnelAgg = { mql: number; sql: number; opp: number; won: number };
    const funnel90 = new Map<string, FunnelAgg>();
    const funnelAll = new Map<string, FunnelAgg>();
    for (const row of funnel90Res.data || []) {
      const cur = funnel90.get(row.empreendimento) || { mql: 0, sql: 0, opp: 0, won: 0 };
      cur.mql += Number(row.mql); cur.sql += Number(row.sql);
      cur.opp += Number(row.opp); cur.won += Number(row.won);
      funnel90.set(row.empreendimento, cur);
    }
    for (const row of funnelAllRes.data || []) {
      const cur = funnelAll.get(row.empreendimento) || { mql: 0, sql: 0, opp: 0, won: 0 };
      cur.mql += Number(row.mql); cur.sql += Number(row.sql);
      cur.opp += Number(row.opp); cur.won += Number(row.won);
      funnelAll.set(row.empreendimento, cur);
    }

    // CPL médio da conta
    const totalLeads = Array.from(empLeads.values()).reduce((s, l) => s + l, 0);
    const cplConta = totalLeads > 0 ? gastoAtual / totalLeads : 50;

    // Identify performing emps (active campaigns + WON in 90d) — keep their budget
    const diasRestantes = diasNoMes - diasPassados;
    const budgetDiarioTotal = diasRestantes > 0 && orcamentoTotal > 0
      ? (orcamentoTotal - gastoAtual) / diasRestantes
      : 0;

    // For each emp: determine if "performing" (has active campaigns AND WON in 90d)
    const allEmps = new Set<string>();
    for (const sq of SQUADS) for (const e of sq.empreendimentos) allEmps.add(e);

    const empBudgetRec = new Map<string, number>();
    let budgetPerformando = 0;

    // Step 1: performing emps (active + WON 90d) — keep near current, adjust by efficiency
    // Calculate CPW for performing emps to rank them
    const perfCpw = new Map<string, number>();
    const perfDaily = new Map<string, number>();

    for (const emp of allEmps) {
      const f90 = funnel90.get(emp);
      let hasActive = false;
      for (const sq of SQUADS) {
        const key = `${sq.id}:${emp}`;
        if ((empCampaigns.get(key)?.size || 0) > 0) hasActive = true;
      }
      const hasWon90 = f90 && f90.won > 0;

      if (hasActive && hasWon90) {
        let dailySpend = 0;
        for (const sq of SQUADS) {
          const key = `${sq.id}:${emp}`;
          const s = empSpend.get(key) || 0;
          const campCount = empCampaigns.get(key)?.size || 0;
          if (campCount > 0) dailySpend += s / (diasPassados || 1);
        }
        perfDaily.set(emp, dailySpend);
        // CPW estimate for this performing emp
        const taxa90 = f90!.mql > 0 ? f90!.won / f90!.mql : 0;
        let empCpl = cplConta;
        for (const sq of SQUADS) {
          const key = `${sq.id}:${emp}`;
          const s = empSpend.get(key) || 0;
          const l = empLeads.get(key) || 0;
          if (l > 0) empCpl = s / l;
        }
        perfCpw.set(emp, taxa90 > 0 ? empCpl / taxa90 : 999999);
      }
    }

    // Avg CPW of performing emps
    const perfCpwVals = Array.from(perfCpw.values()).filter(v => v < 999999);
    const avgPerfCpw = perfCpwVals.length > 0
      ? perfCpwVals.reduce((a, b) => a + b, 0) / perfCpwVals.length
      : 999999;

    // Performing emps: adjust +15% if below avg CPW, -10% if above, keep if near avg
    for (const [emp, daily] of perfDaily) {
      const cpw = perfCpw.get(emp) || 999999;
      let adjusted: number;
      if (cpw < avgPerfCpw * 0.8) {
        adjusted = Math.round(daily * 1.15); // best performer: +15%
      } else if (cpw > avgPerfCpw * 1.2) {
        adjusted = Math.round(daily * 0.90); // worst performer: -10%
      } else {
        adjusted = Math.round(daily); // near average: keep
      }
      empBudgetRec.set(emp, adjusted);
      budgetPerformando += adjusted;
    }

    // Step 2: distribute remaining budget among non-performing emps proportionally to 1/CPW
    const budgetOutros = Math.max(0, budgetDiarioTotal - budgetPerformando);
    const empScores = new Map<string, number>();
    let totalScore = 0;

    for (const emp of allEmps) {
      if (empBudgetRec.has(emp)) continue; // already locked

      const f90 = funnel90.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
      const fAll = funnelAll.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };

      // Blend MQL→WON rate (90d weighted by sample size + historical)
      const taxa90 = f90.mql > 0 ? f90.won / f90.mql : 0;
      const taxaHist = fAll.mql > 0 ? fAll.won / fAll.mql : 0;
      let w90 = f90.mql >= 100 && f90.won > 0 ? 0.7 : f90.mql >= 30 ? 0.5 : f90.mql >= 10 ? 0.2 : 0;
      if (taxa90 === 0 && taxaHist > 0) w90 = Math.min(w90, 0.2);
      let taxaBlend = taxa90 * w90 + taxaHist * (1 - w90);

      // Fallback to account average if no WON data at all
      if (taxaBlend === 0) {
        const totalWon = Array.from(funnelAll.values()).reduce((s, f) => s + f.won, 0);
        const totalMql = Array.from(funnelAll.values()).reduce((s, f) => s + f.mql, 0);
        taxaBlend = totalMql > 0 ? totalWon / totalMql : 0.004;
      }

      // CPL for this emp (use emp-specific if available, else account average)
      let empCpl = cplConta;
      for (const sq of SQUADS) {
        const key = `${sq.id}:${emp}`;
        const s = empSpend.get(key) || 0;
        const l = empLeads.get(key) || 0;
        if (l > 0) empCpl = s / l;
      }

      const cpw = taxaBlend > 0 ? empCpl / taxaBlend : 999999;
      const score = cpw < 999999 ? 1 / cpw : 0;
      empScores.set(emp, score);
      totalScore += score;
    }

    // Allocate proportionally with min floor R$150/dia
    const pisoMin = 150;
    if (totalScore > 0 && budgetOutros > 0) {
      // First pass: raw allocation
      const rawAlloc = new Map<string, number>();
      for (const [emp, score] of empScores) {
        rawAlloc.set(emp, (score / totalScore) * budgetOutros);
      }
      // Second pass: enforce floor, redistribute
      let lockedBudget = 0;
      let lockedScore = 0;
      const needsRedist: string[] = [];
      for (const [emp, alloc] of rawAlloc) {
        if (alloc < pisoMin && alloc > 0) {
          empBudgetRec.set(emp, pisoMin);
          lockedBudget += pisoMin;
          lockedScore += empScores.get(emp) || 0;
        } else {
          needsRedist.push(emp);
        }
      }
      const remainBudget = budgetOutros - lockedBudget;
      const remainScore = totalScore - lockedScore;
      for (const emp of needsRedist) {
        const score = empScores.get(emp) || 0;
        const alloc = remainScore > 0 ? (score / remainScore) * remainBudget : pisoMin;
        empBudgetRec.set(emp, Math.round(Math.max(pisoMin, alloc)));
      }
    }

    // Breakdown por squad com empreendimentos
    const squadsBreakdown: OrcamentoSquadBreakdown[] = SQUADS.map((sq) => {
      const empreendimentos: OrcamentoEmpBreakdown[] = sq.empreendimentos.map((emp) => {
        const key = `${sq.id}:${emp}`;
        const empGasto = Math.round((empSpend.get(key) || 0) * 100) / 100;
        const empCampCount = empCampaigns.get(key)?.size || 0;
        return {
          emp,
          gastoAtual: empGasto,
          gastoDiario: empCampCount > 0 && diasPassados > 0 ? Math.round((empGasto / diasPassados) * 100) / 100 : 0,
          campaignsActive: empCampCount,
          budgetRecomendado: empBudgetRec.get(emp) || 0,
        };
      });

      const sqGasto = empreendimentos.reduce((s, e) => s + e.gastoAtual, 0);
      const sqCampaigns = empreendimentos.reduce((s, e) => s + e.campaignsActive, 0);

      return {
        id: sq.id,
        name: sq.name,
        gastoAtual: Math.round(sqGasto * 100) / 100,
        gastoDiario: diasPassados > 0 ? Math.round((sqGasto / diasPassados) * 100) / 100 : 0,
        campaignsActive: sqCampaigns,
        empreendimentos,
      };
    });

    const result: OrcamentoData = {
      mes: curMonth,
      orcamentoTotal,
      gastoAtual,
      gastoDiario,
      diasNoMes,
      diasPassados,
      projecaoMes,
      ritmoIdeal,
      status,
      squads: squadsBreakdown,
      snapshotDate,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Orcamento GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mes, orcamentoTotal } = body as { mes: string; orcamentoTotal: number };

    if (!mes || typeof orcamentoTotal !== "number") {
      return NextResponse.json({ error: "mes e orcamentoTotal são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("squad_orcamento")
      .upsert({ mes, orcamento_total: orcamentoTotal, updated_at: new Date().toISOString() }, { onConflict: "mes" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Orcamento POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
