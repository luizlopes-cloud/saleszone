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
  spendMinMql?: number  // Spend mínimo para avaliar checkpoint MQL — abaixo disso retorna AGUARDAR
}

export const VERTICAL_CONFIGS: Record<string, VerticalConfig> = {
  Investimentos: {
    benchmarks: { cost_per_mql: 121, cost_per_sql: 435, cost_per_opp: 2953, cost_per_won: 5000 },
    scoring: {
      won_meta: 5000, won_teto: 5000,
      opp_meta: 2953,  opp_teto: 4520,
      sql_meta: 435,   sql_teto: 579,
      mql_meta: 121,   mql_teto: 170,
      taxa_mql_sql: 0.17, taxa_sql_opp: 0.06,
    },
    checkpoints: { mql: 3, sql: 7, opp: 15, won: 35 },
    spendCap: 5000,
    spendMinMql: 30,
  },
  Marketplace: {
    benchmarks: { cost_per_mql: 123, cost_per_sql: 440, cost_per_opp: 1350, cost_per_won: 5000 },
    scoring: {
      won_meta: 5000,  won_teto: 8964,
      opp_meta: 1350,  opp_teto: 2025,
      sql_meta: 440,   sql_teto: 660,
      mql_meta: 123,   mql_teto: 185,
      taxa_mql_sql: 0.15, taxa_sql_opp: 0.10,
    },
    checkpoints: { mql: 3, sql: 9, opp: 16, won: 50 },
    spendCap: 5000,
    spendMinMql: 30,
  },
  SZS: {
    benchmarks: { cost_per_mql: 131, cost_per_sql: 450, cost_per_opp: 1039, cost_per_won: 1400 },
    scoring: {
      won_meta: 1400,  won_teto: 1400,
      opp_meta: 1039,  opp_teto: 1559,
      sql_meta: 450,   sql_teto: 675,
      mql_meta: 131,   mql_teto: 189,
      taxa_mql_sql: 0.22, taxa_sql_opp: 0.40,
    },
    checkpoints: { mql: 3, sql: 7, opp: 14, won: 35 },
    spendCap: 1400,
    spendMinMql: 30,
  },
}

export const DEFAULT_CONFIG = VERTICAL_CONFIGS.Investimentos
