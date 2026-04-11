import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { paginate } from "@/lib/paginate";

export const dynamic = "force-dynamic";

// MKTP data lives in the squad project, NOT the main saleszone project
const MKTP_SUPABASE_URL = "https://cncistmevwwghtaiyaao.supabase.co";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 100 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const monthsParam = req.nextUrl.searchParams.get("months");
    const numMonths = Math.min(Math.max(Number(monthsParam) || 6, 1), 24);

    const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!srvKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
    const admin = createClient(MKTP_SUPABASE_URL, srvKey);

    // Build month ranges
    const now = new Date();
    const months: { key: string; label: string; start: string; end: string }[] = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const label = `${MONTH_LABELS[d.getMonth()]} ${year}`;
      const start = `${key}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${key}-${String(lastDay).padStart(2, "0")}`;
      months.push({ key, label, start, end });
    }

    const globalStart = months[0].start;

    // Fetch from mktp_deals directly (more reliable than pre-aggregated counts)
    const deals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("add_time, qualificacao_date, reuniao_date, won_time, status, lost_reason")
        .gte("add_time", globalStart)
        .range(o, o + ps - 1),
    );

    // Aggregate by month
    const mqlByMonth = new Map<string, number>();
    const sqlByMonth = new Map<string, number>();
    const oppByMonth = new Map<string, number>();
    const wonByMonth = new Map<string, number>();

    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;

      const mkAdd = d.add_time?.substring(0, 7);
      const mkQual = d.qualificacao_date?.substring(0, 7);
      const mkReun = d.reuniao_date?.substring(0, 7);
      const mkWon = d.won_time?.substring(0, 7);

      if (mkAdd && months.some((m) => m.key === mkAdd)) {
        mqlByMonth.set(mkAdd, (mqlByMonth.get(mkAdd) || 0) + 1);
      }
      if (mkQual && months.some((m) => m.key === mkQual)) {
        sqlByMonth.set(mkQual, (sqlByMonth.get(mkQual) || 0) + 1);
      }
      if (mkReun && months.some((m) => m.key === mkReun)) {
        oppByMonth.set(mkReun, (oppByMonth.get(mkReun) || 0) + 1);
      }
      if (d.status === "won" && mkWon && months.some((m) => m.key === mkWon)) {
        wonByMonth.set(mkWon, (wonByMonth.get(mkWon) || 0) + 1);
      }
    }

    // Metas from mktp_metas table
    const monthDates = months.map((m) => `${m.key}-01`);
    const metaByMonth = new Map<string, number>();

    const metaRows = await paginate((o, ps) =>
      admin
        .from("mktp_metas")
        .select("month, meta, tab")
        .in("month", monthDates)
        .range(o, o + ps - 1),
    );
    for (const m of metaRows) {
      if (m.tab === "won") {
        const mk = m.month?.substring(0, 7);
        if (mk) metaByMonth.set(mk, (metaByMonth.get(mk) || 0) + (m.meta || 0));
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
    console.error("MKTP Mensal error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}