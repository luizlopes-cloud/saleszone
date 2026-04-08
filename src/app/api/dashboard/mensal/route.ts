import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { paginate } from "@/lib/paginate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS = ["mql", "sql", "opp", "won"] as const;

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 100 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const monthsParam = req.nextUrl.searchParams.get("months");
    const numMonths = Math.min(Math.max(Number(monthsParam) || 6, 1), 24);

    // Supabase clients
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!srvKey) throw new Error("No Supabase key available");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) console.warn("[mensal] SUPABASE_SERVICE_ROLE_KEY missing — using anon key fallback");
    const supabaseSR = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      srvKey,
    );

    // Build month ranges (current month + N-1 previous)
    const now = new Date();
    const months: { key: string; label: string; start: string; end: string; metaDate: string }[] = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const label = `${MONTH_LABELS[d.getMonth()]} ${year}`;
      const start = `${key}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${key}-${String(lastDay).padStart(2, "0")}`;
      const metaDate = `01/${String(month).padStart(2, "0")}/${year}`;
      months.push({ key, label, start, end, metaDate });
    }

    const globalStart = months[0].start;
    const globalEnd = months[months.length - 1].end;

    // Fetch all daily counts in the full range (all tabs at once)
    // Must paginate — 6 months × ~30 days × ~11 empreendimentos = ~2000+ rows per tab
    // Fetch deals de squad_deals para MQL/SQL/OPP/WON (cada etapa pela data correta)
    // Todos os canais exceto indicação, sem Duplicado/Erro
    const [mqlDeals, sqlDeals, oppDeals, wonDeals, metaRes] = await Promise.all([
      // MQL: por add_time
      paginate((offset, ps) =>
        supabaseSR
          .from("squad_deals")
          .select("add_time, canal, lost_reason")
          .gte("add_time", globalStart)
          .range(offset, offset + ps - 1),
      ),
      // SQL: por qualificacao_date
      paginate((offset, ps) =>
        supabaseSR
          .from("squad_deals")
          .select("qualificacao_date, canal, lost_reason")
          .gte("qualificacao_date", globalStart)
          .range(offset, offset + ps - 1),
      ),
      // OPP: por reuniao_date
      paginate((offset, ps) =>
        supabaseSR
          .from("squad_deals")
          .select("reuniao_date, canal, lost_reason")
          .gte("reuniao_date", globalStart)
          .range(offset, offset + ps - 1),
      ),
      // WON: por won_time
      paginate((offset, ps) =>
        supabaseSR
          .from("squad_deals")
          .select("won_time, canal, lost_reason")
          .eq("status", "won")
          .gte("won_time", globalStart)
          .range(offset, offset + ps - 1),
      ),
      // Metas (service role to bypass RLS)
      supabaseSR
        .from("nekt_meta26_metas")
        .select("data, won_szi_meta_pago, won_szi_meta_direto")
        .in("data", months.map((m) => m.metaDate)),
    ]);

    if (metaRes?.error) throw new Error(`Meta query error: ${metaRes.error.message}`);

    // Agregar por mês — exclui indicação e Duplicado/Erro
    function aggregateByMonth(deals: Record<string, string | null>[], dateField: string): Map<string, number> {
      const map = new Map<string, number>();
      for (const d of deals) {
        if (d.lost_reason === "Duplicado/Erro") continue;
        const canal = (d.canal || "").toLowerCase();
        if (canal.includes("indica")) continue;
        const dateVal = d[dateField];
        if (!dateVal) continue;
        const monthKey = dateVal.substring(0, 7);
        map.set(monthKey, (map.get(monthKey) || 0) + 1);
      }
      return map;
    }

    const mqlByMonth = aggregateByMonth(mqlDeals, "add_time");
    const sqlByMonth = aggregateByMonth(sqlDeals, "qualificacao_date");
    const oppByMonth = aggregateByMonth(oppDeals, "reuniao_date");
    const wonByMonth = aggregateByMonth(wonDeals, "won_time");

    // Index metas by DD/MM/YYYY → month key
    const metaByMonth = new Map<string, number>();
    for (const row of metaRes.data || []) {
      // data is DD/MM/YYYY, parse to YYYY-MM
      const parts = (row.data as string).split("/");
      if (parts.length === 3) {
        const monthKey = `${parts[2]}-${parts[1]}`;
        const total = (Number(row.won_szi_meta_pago) || 0) + (Number(row.won_szi_meta_direto) || 0);
        metaByMonth.set(monthKey, total);
      }
    }

    // Build response
    const result = months.map((m) => {
      const mql = mqlByMonth.get(m.key) || 0;
      const sql = sqlByMonth.get(m.key) || 0;
      const opp = oppByMonth.get(m.key) || 0;
      const won = wonByMonth.get(m.key) || 0;
      const meta = metaByMonth.get(m.key) || 0;

      return {
        month: m.key,
        monthLabel: m.label,
        mql,
        sql,
        opp,
        won,
        meta,
        pctMeta: pct(won, meta),
        conversions: {
          mqlToSql: pct(sql, mql),
          sqlToOpp: pct(opp, sql),
          oppToWon: pct(won, opp),
          mqlToWon: pct(won, mql),
        },
      };
    });

    return NextResponse.json({
      months: result,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Mensal API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
