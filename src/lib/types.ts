// User Control System
export type UserRole = "operador" | "diretor";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: "active" | "inactive";
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  created_at: string;
  expires_at: string;
}

export type MediaFilter = "all" | "paid";

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

export interface MetaInfo {
  wonMetaTotal: number;
  wonPerCloser: number;
  day: number;
  totalDaysInMonth: number;
  squads: Array<{
    id: number;
    closers: number;
    counts90d: { mql: number; sql: number; opp: number; won: number };
    ratios: { mql_sql: number; sql_opp: number; opp_won: number };
  }>;
}

export interface AcompanhamentoData {
  squads: SquadData[];
  dates: DateColumn[];
  grand: { totalMes: number; metaToDate: number; daily: number[] };
  metaInfo?: MetaInfo;
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

export interface MisalignedDeal {
  deal_id: number;
  title: string;
  empreendimento: string;
  owner_name: string;
  link: string;
}

export interface MisalignedDealsData {
  byPerson: Array<{
    person: string;
    role: "pv" | "v";
    deals: MisalignedDeal[];
  }>;
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
  severidade: "OK" | "ALERTA" | "CRITICO" | "OPORTUNIDADE";
  diagnostico: string | null;
  effective_status: "ACTIVE" | "PAUSED";
  // Funil por ad (rastreamento ad → deal)
  mql: number;
  sql: number;
  opp: number;
  won: number;
  wonOutro: number;
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
  wonOutro: number;
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
  cmql: number;
  copp: number;
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
  reserva: number;        // snapshot: deals no stage agora
  contrato: number;       // snapshot: deals no stage agora
  oppEvento: number;      // coorte: deals fechados no mês que passaram por OPP
  reservaEvento: number;  // coorte: deals fechados no mês que passaram por Reserva
  contratoEvento: number; // coorte: deals fechados no mês que passaram por Contrato
  wonEvento: number;      // coorte: deals fechados no mês que viraram WON
  spend: number;
  // Custos
  cpl: number;   // spend / leads
  cmql: number;  // spend / mql
  csql: number;  // spend / sql
  copp: number;  // spend / opp
  cpw: number;   // spend / won (Custo por Ganho)
  // Taxas de conversão
  ctr: number;          // clicks / impressions
  clickToLead: number;  // leads / clicks
  leadToMql: number;    // mql / leads
  mqlToSql: number;     // sql / mql
  sqlToOpp: number;     // opp / sql
  oppToReserva: number;      // reserva / opp
  reservaToContrato: number; // contrato / reserva
  contratoToWon: number;     // won / contrato
  oppToWon: number;          // won / opp (legacy/overall)
}

export interface FunilBairro {
  bairro: string;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  reserva: number;
  contrato: number;
  leads: number;
}

export interface FunilCidade {
  cidade: string;
  bairros: FunilBairro[];
  totals: FunilEmpreendimento;
}

export interface FunilSquad {
  id: number;
  name: string;
  empreendimentos: FunilEmpreendimento[];
  cidades?: FunilCidade[];
  totals: FunilEmpreendimento;
}

export interface FunilData {
  month: string; // YYYY-MM
  squads: FunilSquad[];
  grand: FunilEmpreendimento;
}

// Planejamento — Conversão por mídia paga vs histórico
export interface PlanejamentoMetrics {
  leads: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  spend: number;
  cpl: number;
  cmql: number;
  copp: number;
  cpw: number;
  mqlToSql: number;
  sqlToOpp: number;
  oppToWon: number;
}

export interface PlanejamentoEmpRow {
  emp: string;
  squadId: number;
  current: PlanejamentoMetrics;
  historical: PlanejamentoMetrics;
  efficiency: "high" | "medium" | "low";
}

export interface PlanejamentoData {
  month: string;
  empreendimentos: PlanejamentoEmpRow[];
  totals: { current: PlanejamentoMetrics; historical: PlanejamentoMetrics };
}

// Orçamento — Controle de budget mensal
export interface OrcamentoData {
  mes: string;
  orcamentoTotal: number;
  gastoAtual: number;
  gastoDiario: number;
  diasNoMes: number;
  diasPassados: number;
  projecaoMes: number;
  ritmoIdeal: number;
  status: "ok" | "alerta" | "critico";
  squads: OrcamentoSquadBreakdown[];
  snapshotDate: string;
  log: OrcamentoLogEntry[];
}

export interface OrcamentoLogEntry {
  date: string;
  empreendimento: string;
  squadId: number;
  budgetRecomendado: number;
  budgetReal: number;
  tipo: "Escalar" | "Manter" | "Otimizar" | "Reduzir";
  explicacao: string;
}

export interface OrcamentoEmpBreakdown {
  emp: string;
  gastoAtual: number;
  gastoDiario: number;
  campaignsActive: number;
  budgetRecomendado?: number;
  budgetExplicacao?: string;
}

export interface OrcamentoSquadBreakdown {
  id: number;
  name: string;
  gastoAtual: number;
  gastoDiario: number;
  campaignsActive: number;
  empreendimentos: OrcamentoEmpBreakdown[];
}

// Histórico de Campanhas — acumulado lifetime por ad (latest snapshot)
export interface HistoricoAdRow {
  adId: string;
  adName: string;
  adsetName: string;
  campaignName: string;
  empreendimento: string;
  effectiveStatus: string;
  spend: number;
  leads: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  impressions: number;
  clicks: number;
  cpl: number;
  cmql: number;
  csql: number;
  copp: number;
  cpw: number;
  ctr: number;
  cpc: number;
  cpm: number;
  lastSeenDate: string;
}

export interface HistoricoCampanhasData {
  ads: HistoricoAdRow[];
}

// Performance — Funil por pessoa (closer, preseller, marketing)
export interface PerformanceEmpBreakdown {
  emp: string;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  mqlToSql: number;
  sqlToOpp: number;
  oppToWon: number;
  mqlToWon: number;
}

export interface PerformanceTimePoint {
  month: string; // YYYY-MM
  opp: number;
  won: number;
  oppToWon: number;
}

export interface PerformancePersonRow {
  name: string;
  role: "closer" | "preseller" | "marketing";
  squadId: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  mqlToSql: number;
  sqlToOpp: number;
  oppToWon: number;
  mqlToWon: number;
  byEmp: PerformanceEmpBreakdown[];
  timeSeries?: PerformanceTimePoint[];
}

export interface PerformancePresellerRow extends PerformancePersonRow {
  dealsReceived: number;
  dealsWithAction: number;
  actLigacoes: number;
  actMensagens: number;
  actReunioes: number;
  avgResponseMin: number;
  medianResponseMin: number;
}

export interface PerformanceSquadSummary {
  id: number;
  name: string;
  closers: PerformancePersonRow[];
  preseller: PerformancePresellerRow;
  marketing: PerformancePersonRow;
  totals: { mql: number; sql: number; opp: number; won: number; mqlToSql: number; sqlToOpp: number; oppToWon: number; mqlToWon: number };
}

export interface PerformanceEmpRow {
  emp: string;
  squadId: number;
  opp: number;
  won: number;
  oppToWon: number;
  timeSeries?: PerformanceTimePoint[];
}

export interface PerformanceData {
  squads: PerformanceSquadSummary[];
  allClosers: PerformancePersonRow[];
  allPresellers: PerformancePresellerRow[];
  allMarketing: PerformancePersonRow[];
  allEmps: PerformanceEmpRow[];
  grandTotals: { mql: number; sql: number; opp: number; won: number; mqlToSql: number; sqlToOpp: number; oppToWon: number; mqlToWon: number };
  consolidatedTimeSeries?: PerformanceTimePoint[];
}

// Base-Line — Análise Cohort de Vendedores
export interface BaselineMonthData {
  monthOffset: number;
  opp: number;
  won: number;
  oppToWon: number;
  wonAccumulated: number;
}

export interface BaselineCloserData {
  name: string;
  squadId: number;
  monthZero: string;
  monthsActive: number;
  months: BaselineMonthData[];
  totals: { opp: number; won: number; oppToWon: number };
}

export interface BaselineData {
  closers: BaselineCloserData[];
  maxMonthOffset: number;
}

// Diagnóstico Vendas — Leadtime de Follow-up
export type VendasSeveridade = "CRITICO" | "ALERTA" | "OK";

export interface DiagVendasDealRow {
  deal_id: number;
  title: string;
  owner_name: string;
  empreendimento: string | null;
  stage_order: number;
  stage_name: string;
  last_activity_date: string | null;
  next_activity_date: string | null;
  leadtime_hours: number;
  severidade: VendasSeveridade;
  sem_atividade_futura: boolean;
  atividade_atrasada: boolean;
  link: string;
}

export interface DiagVendasCloserSummary {
  name: string;
  squadId: number;
  totalDeals: number;
  avgLeadtimeHours: number;
  maxLeadtimeHours: number;
  criticos: number;
  alertas: number;
  ok: number;
  semAtividadeFutura: number;
  atividadeAtrasada: number;
  severidade: VendasSeveridade;
}

export interface DiagVendasData {
  closers: DiagVendasCloserSummary[];
  deals: DiagVendasDealRow[];
  totals: {
    totalDeals: number;
    avgLeadtimeHours: number;
    criticos: number;
    alertas: number;
    ok: number;
    semAtividadeFutura: number;
    atividadeAtrasada: number;
  };
}

// Forecast — Previsão de Vendas do Mês
export interface ForecastStageSnapshot {
  stage: string;
  stageOrder: number;
  openDeals: number;
  convRate: number;
  leadtimeDays: number;
  expectedWon: number;
}

export interface ForecastCloserRow {
  name: string;
  squadId: number;
  wonActual: number;
  pipeline: number;
  generation: number;
  total: number;
  meta: number;
  pctMeta: number;
}

export interface ForecastSquadRow {
  id: number;
  name: string;
  closers: ForecastCloserRow[];
  wonActual: number;
  pipeline: number;
  generation: number;
  total: number;
  meta: number;
  pctMeta: number;
  stages: ForecastStageSnapshot[];
}

export interface ForecastData {
  month: string;
  diasPassados: number;
  diasRestantes: number;
  diasNoMes: number;
  wonActual: number;
  pipeline: number;
  generation: number;
  total: number;
  meta: number;
  pctMeta: number;
  ranges: { pessimista: number; esperado: number; otimista: number };
  stages: ForecastStageSnapshot[];
  squads: ForecastSquadRow[];
  metodologia: string;
}

// Leadtime — Tempo médio por etapa do funil
export interface LeadtimeStageRow {
  stageOrder: number;
  stageName: string;
  avgDays: number;
  medianDays: number;
  p90Days: number;
  wonDeals: number;
  openDeals: number;
  oldestOpen: {
    deal_id: number;
    title: string;
    owner_name: string;
    add_time: string;
    ageDays: number;
    link: string;
  } | null;
}

export interface LeadtimeDealRow {
  deal_id: number;
  title: string;
  empreendimento: string;
  stageName: string;
  stageOrder: number;
  add_time: string;
  won_time: string | null;
  cycleDays: number;       // won: won_time - add_time; open: now - add_time
  status: "won" | "open";
  link: string;
}

export interface LeadtimeData {
  avgCycleDays: number;
  medianCycleDays: number;
  p90CycleDays: number;
  totalWonDeals: number;
  totalOpenDeals: number;
  stages: LeadtimeStageRow[];
  byCloser: Array<{
    name: string;
    squadId: number;
    avgCycleDays: number;
    medianCycleDays: number;
    wonDeals: number;
    openDeals: number;
    deals: LeadtimeDealRow[];
  }>;
}

// Backlog — Kanban de Tarefas
export interface BacklogTask {
  id: string;
  title: string;
  description: string;
  type: "feature" | "bug";
  status: "backlog" | "planejado" | "fazendo" | "review" | "done";
  assigned_to: string | null;
  assigned_name?: string | null;
  definition_of_done: string;
  image_url?: string | null;
  priority: number;
  due_date: string | null;
  position: number;
  created_by: string;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BacklogComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
}

export interface ContributorStats {
  name: string;
  email: string | null;
  github_login: string;
  totalCommits: number;
  totalAdded: number;
  totalDeleted: number;
  lastCommitDate: string | null;
  weeks: Array<{
    week: string;
    commits: number;
    added: number;
    deleted: number;
  }>;
}

// Avaliação de Reuniões — Fireflies + Claude
export interface AvaliacaoPilar {
  nota: number;
  justificativa: string;
}

export interface AvaliacaoJSON {
  modelo: string;
  versao: string;
  pilares: {
    conhecimento_produto: AvaliacaoPilar;
    tecnicas_venda: AvaliacaoPilar;
    rapport_empatia: AvaliacaoPilar;
    foco_cta: AvaliacaoPilar;
    objetividade: AvaliacaoPilar;
  };
  nota_final: number;
  avaliado_em: string;
  destaques_positivos: string[];
  pontos_melhoria: string[];
  dados_incorretos: string[];
}

export interface AvaliacaoReuniao {
  eventId: string;
  titulo: string;
  dia: string;
  hora: string;
  closerName: string;
  closerEmail: string;
  empreendimento: string | null;
  firefliesId: string | null;
  transcricaoChars: number;
  avaliacao: AvaliacaoJSON | null;
  diagnostico: string | null;
  cancelou: boolean;
  duracaoMin: number | null;
  invalidReason: string | null; // null = valid; otherwise reason
}

export interface AvaliacaoCloserSummary {
  name: string;
  squadId: number;
  totalReunioes: number;
  transcricoesValidas: number;
  transcricoesInvalidas: number;
  reunioesAvaliadas: number;
  notaMedia: number | null;
  pilares: {
    conhecimento_produto: number | null;
    tecnicas_venda: number | null;
    rapport_empatia: number | null;
    foco_cta: number | null;
    objetividade: number | null;
  };
  reunioes: AvaliacaoReuniao[];
}

export interface AvaliacoesData {
  closers: AvaliacaoCloserSummary[];
  totals: {
    totalReunioes: number;
    transcricoesValidas: number;
    transcricoesInvalidas: number;
    reunioesAvaliadas: number;
    notaMedia: number | null;
  };
  periodo: { from: string; to: string };
}

// Monitor de Losts — Lost deals compliance monitoring (SZS pipeline)
export interface LostDealRow {
  deal_id: number;
  title: string;
  stage_name: string;
  stage_category: "pre_vendas" | "vendas";
  owner_name: string;
  owner_email: string;
  lost_time: string;
  lost_hour: number;
  days_in_funnel: number;
  lost_reason: string;
  canal: string;
  add_time: string | null;
  next_activity_date: string | null;
  pipeline_name: string | null;
}

export interface LostAlert {
  id?: string;
  date: string;
  seller_email: string;
  seller_name: string;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  message: string;
  metric_value: number | null;
  threshold_value: number | null;
}

export interface LostsSummary {
  date: string;
  total: number;
  pre_vendas: number;
  vendas: number;
  pre_vendas_pct: number;
  vendas_pct: number;
  by_reason: Record<string, number>;
  by_owner: Record<string, number>;
  by_canal: Record<string, number>;
  median_days_in_funnel: number | null;
  same_day_lost_pct: number;
  batch_after_18h_pct: number;
}

export type LostsPeriod = "yesterday" | "week" | "month" | "custom";

export interface LostsData {
  date: string;
  period?: LostsPeriod;
  dateRange?: { from: string; to: string };
  summary: LostsSummary;
  deals: LostDealRow[];
  alerts: LostAlert[];
  trend: {
    dates: string[];
    totals: number[];
  };
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

// Histórico de Conversões (Ratios Diários)
export interface RatioSnapshot {
  date: string;
  squad_id: number;
  ratios: { mql_sql: number; sql_opp: number; opp_won: number };
  counts_90d: { mql: number; sql: number; opp: number; won: number };
}

export interface RatioHistoryData {
  current: {
    global: RatioSnapshot;
    squads: RatioSnapshot[];
  };
  history: RatioSnapshot[];
  empDaily?: Record<string, Record<string, Record<string, number>>>; // emp → date → { mql, sql, opp, won }
  dates?: string[]; // 28 dates (most recent first)
}
