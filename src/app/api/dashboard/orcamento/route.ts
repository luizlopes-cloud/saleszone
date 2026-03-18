import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { OrcamentoData, OrcamentoSquadBreakdown, OrcamentoEmpBreakdown, OrcamentoLogEntry } from "@/lib/types";

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
    const [orcRes, metaAllRes, metaLatestRes, approvedRes] = await Promise.all([
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
      // Budget aprovado por empreendimento (fixo, só muda com aprovação do usuário)
      supabase
        .from("squad_orcamento_approved")
        .select("empreendimento, budget_recomendado, explicacao")
        .eq("mes", curMonth),
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

    // Gasto por empreendimento e squad
    const empSpend = new Map<string, number>(); // emp -> spend
    let gastoAtual = 0;
    for (const [, data] of adMaxSpend) {
      gastoAtual += data.spend;
      const key = `${data.squadId}:${data.emp}`;
      empSpend.set(key, (empSpend.get(key) || 0) + data.spend);
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

    // ===== Budget recomendado: lê da tabela de aprovados (não calcula dinamicamente) =====
    // Valores só mudam quando o usuário aprova explicitamente via /gestao-orcamento
    const empBudgetRec = new Map<string, number>();
    const empExplicacao = new Map<string, string>();
    for (const row of approvedRes.data || []) {
      empBudgetRec.set(row.empreendimento, Number(row.budget_recomendado) || 0);
      empExplicacao.set(row.empreendimento, row.explicacao || "");
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
          budgetExplicacao: empExplicacao.get(emp) || "",
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

    // ===== Log: detect when real daily spend matches recommended budget exactly =====
    const today = now.toISOString().split("T")[0];
    const logInserts: Array<{ date: string; empreendimento: string; squad_id: number; budget_recomendado: number; budget_real: number; tipo: string; explicacao: string }> = [];

    for (const sq of squadsBreakdown) {
      for (const emp of sq.empreendimentos) {
        const rec = emp.budgetRecomendado || 0;
        const real = emp.gastoDiario;
        if (rec <= 0 || real <= 0) continue;
        // Only log if values match exactly (rounded to integer)
        if (Math.round(real) !== Math.round(rec)) continue;

        // Determine tipo based on delta vs previous spend
        let tipo: string;
        const delta = rec - real;
        if (emp.campaignsActive === 0) {
          tipo = "Escalar"; // was paused, now active
        } else if (delta > real * 0.05) {
          tipo = "Escalar";
        } else if (delta < -real * 0.05) {
          tipo = "Reduzir";
        } else {
          // Check if recommendation was to optimize (CPW above avg) or maintain
          const expl = (emp.budgetExplicacao || "").toLowerCase();
          if (expl.includes("acima da média") || expl.includes("reduzir")) {
            tipo = "Otimizar";
          } else if (expl.includes("escalar") || expl.includes("melhor")) {
            tipo = "Escalar";
          } else {
            tipo = "Manter";
          }
        }

        logInserts.push({
          date: today,
          empreendimento: emp.emp,
          squad_id: sq.id,
          budget_recomendado: rec,
          budget_real: Math.round(real),
          tipo,
          explicacao: emp.budgetExplicacao || "",
        });
      }
    }

    if (logInserts.length > 0) {
      await supabase.from("squad_orcamento_log").upsert(logInserts, { onConflict: "date,empreendimento" });
    }

    // Fetch log entries (last 30 days)
    const logCutoff = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const { data: logRows } = await supabase
      .from("squad_orcamento_log")
      .select("*")
      .gte("date", logCutoff)
      .order("date", { ascending: false })
      .order("empreendimento");

    const log: OrcamentoLogEntry[] = (logRows || []).map((r: Record<string, unknown>) => ({
      date: r.date as string,
      empreendimento: r.empreendimento as string,
      squadId: r.squad_id as number,
      budgetRecomendado: Number(r.budget_recomendado),
      budgetReal: Number(r.budget_real),
      tipo: (r.tipo as OrcamentoLogEntry["tipo"]) || "Manter",
      explicacao: r.explicacao as string,
    }));

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
      log,
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
