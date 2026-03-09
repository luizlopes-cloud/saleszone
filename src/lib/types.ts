export type TabKey = "mql" | "sql" | "opp" | "won";

export interface DateColumn {
  date: string; // YYYY-MM-DD
  label: string; // "7 mar"
  weekday: string; // "sex"
  isWeekend: boolean;
  isSunday: boolean;
}

export interface EmpreendimentoRow {
  emp: string;
  daily: number[]; // counts per day (index 0 = most recent)
  totalMes: number;
}

export interface SquadData {
  id: number;
  name: string;
  marketing: string;
  preVenda: string;
  venda: string;
  rows: EmpreendimentoRow[];
  metaToDate: number;
}

export interface AcompanhamentoData {
  squads: SquadData[];
  dates: DateColumn[];
  grand: { totalMes: number; metaToDate: number; daily: number[] };
}

export interface AlinhamentoCell {
  pv: Record<string, number>;
  v: Record<string, number>;
}

export interface AlinhamentoData {
  rows: Array<{
    sqId: number;
    sqName: string;
    emp: string;
    correctPV: string;
    correctV: string;
    cells: AlinhamentoCell;
  }>;
  stats: { total: number; ok: number; mis: number };
}

export interface MetasData {
  squads: Array<{
    id: number;
    name: string;
    metas: Record<TabKey, number>;
  }>;
  ratios: Record<string, number>;
  counts90d: Record<TabKey, number>;
}

export interface DashboardResponse {
  acompanhamento: Record<TabKey, AcompanhamentoData>;
  alinhamento: AlinhamentoData;
  metas: MetasData;
  syncedAt: string;
}

// Campanhas Meta Ads
export interface MetaAdRow {
  ad_id: string;
  campaign_name: string;
  adset_name: string;
  ad_name: string;
  empreendimento: string;
  squad_id: number;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  cpm: number;
  frequency: number;
  cpc: number;
  severidade: "OK" | "ALERTA" | "CRITICO";
  diagnostico: string | null;
  // Funil por ad (rastreamento ad → deal)
  mql: number;
  sql: number;
  opp: number;
  won: number;
  cmql: number;
  csql: number;
  copp: number;
  cpw: number;
}

export interface CampanhasEmpSummary {
  emp: string;
  ads: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  cpc: number;
  cmql: number;
  csql: number;
  copp: number;
  criticos: number;
  alertas: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  cpw: number;
  adsDetail: MetaAdRow[];
}

export interface CampanhasSquadSummary {
  id: number;
  name: string;
  empreendimentos: CampanhasEmpSummary[];
  totalSpend: number;
  totalLeads: number;
  avgCpl: number;
  criticos: number;
  alertas: number;
  totalMql: number;
  totalSql: number;
  totalOpp: number;
  totalWon: number;
  cpw: number;
  totalSpendMonth: number;
  totalLeadsMonth: number;
  spendAlert: boolean;
}

export interface CampanhasSummary {
  totalAds: number;
  totalSpend: number;
  totalLeads: number;
  avgCpl: number;
  criticos: number;
  alertas: number;
  totalMql: number;
  totalSql: number;
  totalOpp: number;
  totalWon: number;
  cpw: number;
  totalSpendMonth: number;
  totalLeadsMonth: number;
}

export interface CampanhasData {
  snapshotDate: string;
  summary: CampanhasSummary;
  squads: CampanhasSquadSummary[];
  top10: MetaAdRow[];
}

// Ociosidade — Ocupação dos closers via Google Calendar
export interface OciosidadeDay {
  date: string; // YYYY-MM-DD
  occupancyPct: number;
  eventCount: number;
  totalMinutes: number;
  cancelledCount: number;
  totalScheduled: number;
  noShowPct: number;
}

export interface OciosidadeCloser {
  email: string;
  name: string;
  squadId: number;
  days: OciosidadeDay[];
  avgPast7: number;
  avgNext7: number;
  avgHistorical: number;
  avgNoShow7: number;
  maxWeek: { weekLabel: string; avg: number };
  minWeek: { weekLabel: string; avg: number };
}

export interface OciosidadeDate {
  date: string;
  label: string;
  weekday: string;
  isWeekend: boolean;
  isPast: boolean;
  isToday: boolean;
}

export interface OciosidadeData {
  closers: OciosidadeCloser[];
  dates: OciosidadeDate[];
  syncedAt: string;
}

// Balanceamento — Regras MQL por Empreendimento
export interface RegrasMqlFonte {
  campaignName: string;
  tipo: "lp" | "campanha";
  labelCurto: string;
  intencoes: string[];
  faixas: string[];
  pagamentos: string[];
  aberturaIntencoes: number;
  aberturaFaixas: number;
  aberturaPagamentos: number;
  aberturaGeral: number;
}

export interface RegrasMqlEmp {
  nome: string;
  fontes: RegrasMqlFonte[];
  aberturaGeral: number;
}

export interface RegrasMqlSquad {
  id: number;
  name: string;
  empreendimentos: RegrasMqlEmp[];
  aberturaMedia: number;
}

export interface RegrasMqlData {
  squads: RegrasMqlSquad[];
}

// Funil Ponta a Ponta — Impressões → Clicks → Leads → MQL → SQL → OPP → WON
export interface FunilEmpreendimento {
  emp: string;
  impressions: number;
  clicks: number;
  leads: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  spend: number;
  // Custos
  cpl: number;   // spend / leads
  cmql: number;  // spend / mql
  csql: number;  // spend / sql
  cpw: number;   // spend / won (Custo por Ganho)
  // Taxas de conversão
  ctr: number;          // clicks / impressions
  clickToLead: number;  // leads / clicks
  leadToMql: number;    // mql / leads
  mqlToSql: number;     // sql / mql
  sqlToOpp: number;     // opp / sql
  oppToWon: number;     // won / opp
}

export interface FunilSquad {
  id: number;
  name: string;
  empreendimentos: FunilEmpreendimento[];
  totals: FunilEmpreendimento; // totais agregados do squad
}

export interface FunilData {
  month: string; // YYYY-MM
  squads: FunilSquad[];
  grand: FunilEmpreendimento; // totais globais
}

// Pré-Venda — Tempo de resposta dos pré-vendedores
export interface PresalesDealRow {
  deal_id: number;
  deal_title: string;
  preseller_name: string;
  transbordo_at: string;
  first_action_at: string | null;
  response_time_minutes: number | null;
  action_type: string | null;
  deal_add_time: string | null;
  last_mia_at: string | null;
}

export interface PresellerSummary {
  name: string;
  squadId: number | null;
  totalDeals: number;
  dealsComAcao: number;
  dealsPendentes: number;
  avgMinutes: number;
  medianMinutes: number;
  pctSub30: number;
  pctSub60: number;
}

export interface PresalesData {
  presellers: PresellerSummary[];
  recentDeals: PresalesDealRow[];
  totals: {
    totalDeals: number;
    dealsComAcao: number;
    dealsPendentes: number;
    avgMinutes: number;
    medianMinutes: number;
    pctSub30: number;
  };
}
