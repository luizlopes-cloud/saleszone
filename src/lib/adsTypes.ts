// Nekt usa "Ativa"/"Inativa" (português), Meta usa "ACTIVE"/"PAUSED"/etc.
export function normalizeStatus(s: string): string {
  const lower = s.toLowerCase().trim()
  if (lower === "ativa" || lower === "active") return "ACTIVE"
  if (
    lower === "inativa" || lower === "paused" || lower === "deleted" ||
    lower === "campaign_paused" || lower === "adset_paused" || lower === "archived" ||
    lower === "disapproved" || lower === "pending_review" || lower === "with_issues"
  ) return "PAUSED"
  if (lower) return s.toUpperCase()
  return "ACTIVE"
}

export interface NektRow {
  date: string
  ad_id: string
  ad_name: string
  first_day_ad: string
  adset_name: string
  campaign_name: string
  first_day_campaign: string
  vertical: string
  status: string
  effective_status: string
  plataforma: string
  dias_ativos: number
  spend: number
  lead: number
  mql: number
  sql: number
  opp: number
  won: number
  ctr: number
  adset_id: string
}

export type AdStatus = "MANTER" | "MONITORAR" | "PAUSAR" | "AGUARDAR"
export type Checkpoint = string
export type Tier = "WON" | "OPP" | "SQL" | "MQL" | "SEM_DADOS"
export type Tendencia = "MELHORANDO" | "ESTÁVEL" | "DEGRADANDO" | "SEM_DADOS"

export interface AdPerformance extends NektRow {
  cost_per_mql: number
  cost_per_sql: number
  cost_per_opp: number
  cost_per_won: number
  score: number
  speed_bonus: number
  benchmark_vs_mql: number
  benchmark_vs_sql: number
  benchmark_vs_opp: number
  benchmark_vs_won: number
  ad_status: AdStatus
  checkpoint_atual: Checkpoint
  tier: Tier
  tendencia?: Tendencia
  cost_per_mql_total?: number
  mql_7d?: number
  spend_7d?: number
}

export interface VerticalConfig {
  benchmarks: { cost_per_mql: number; cost_per_sql: number; cost_per_opp: number; cost_per_won: number }
  scoring: {
    won_meta: number; won_teto: number
    opp_meta: number; opp_teto: number
    sql_meta: number; sql_teto: number
    mql_meta: number; mql_teto: number
    taxa_mql_sql: number; taxa_sql_opp: number
  }
  checkpoints: { mql: number; sql: number; opp: number; won: number }
  spendCap?: number
}

export const VERTICAL_CONFIGS: Record<string, VerticalConfig> = {
  Investimentos: {
    benchmarks: { cost_per_mql: 121, cost_per_sql: 435, cost_per_opp: 2953, cost_per_won: 5000 },
    scoring: {
      won_meta: 5000, won_teto: 5000,
      opp_meta: 2953, opp_teto: 4520,
      sql_meta: 435, sql_teto: 579,
      mql_meta: 121, mql_teto: 170,
      taxa_mql_sql: 0.17, taxa_sql_opp: 0.06,
    },
    checkpoints: { mql: 3, sql: 7, opp: 15, won: 35 },
    spendCap: 5000,
  },
  Marketplace: {
    benchmarks: { cost_per_mql: 212.81, cost_per_sql: 876.08, cost_per_opp: 1049.74, cost_per_won: 5391.33 },
    scoring: {
      won_meta: 5391, won_teto: 8087,
      opp_meta: 1050, opp_teto: 1575,
      sql_meta: 876, sql_teto: 1314,
      mql_meta: 213, mql_teto: 260,
      taxa_mql_sql: 0.17, taxa_sql_opp: 0.06,
    },
    checkpoints: { mql: 7, sql: 25, opp: 35, won: 50 },
  },
  SZS: {
    benchmarks: { cost_per_mql: 188.74, cost_per_sql: 851.19, cost_per_opp: 2336.86, cost_per_won: 2971.78 },
    scoring: {
      won_meta: 2972, won_teto: 4458,
      opp_meta: 2337, opp_teto: 3506,
      sql_meta: 851, sql_teto: 1277,
      mql_meta: 189, mql_teto: 230,
      taxa_mql_sql: 0.17, taxa_sql_opp: 0.06,
    },
    checkpoints: { mql: 7, sql: 25, opp: 35, won: 50 },
  },
}

export const DEFAULT_CONFIG = VERTICAL_CONFIGS.Investimentos
