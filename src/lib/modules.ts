// Module configuration for multi-product dashboard (SZI, MKTP, SZS)

export interface SquadDef {
  id: number;
  name: string;
  marketing: string;
  preVenda: string;
  venda: string;
  empreendimentos: readonly string[];
  canalIds?: readonly number[]; // SZS: canal IDs for squad grouping (Pipedrive canal field)
}

export interface ModuleConfig {
  id: string;                    // "szi" | "mktp" | "szs"
  label: string;                 // "Investimentos" | "Marketplace" | "Serviços"
  shortLabel: string;            // "SZI" | "MKTP" | "SZS"
  pipelineId: number;            // Pipedrive pipeline ID
  metaAdsAccountId: string;      // Meta Ads account ID
  squads: readonly SquadDef[];
  closers: readonly string[];    // V_COLS equivalent
  presellers: readonly string[]; // PV_COLS equivalent
  squadCloserMap: Record<number, number[]>; // SQUAD_V_MAP equivalent
  tablePrefix: string;           // "squad" | "mktp" | "szs"
  apiBase: string;               // "/api/dashboard" | "/api/mktp"
  syncFunctions: string[];       // sync function keys for handleRefresh
}

// --- SZI (Investimentos) — current/default module ---

const SZI_SQUADS: readonly SquadDef[] = [
  {
    id: 1,
    name: "Squad 1",
    marketing: "Mari",
    preVenda: "Luciana Patrício",
    venda: "Priscila Pestana Perrone",
    empreendimentos: ["Ponta das Canas Spot II", "Itacaré Spot", "Marista 144 Spot"],
  },
  {
    id: 2,
    name: "Squad 2",
    marketing: "Jean",
    preVenda: "Natália Saramago",
    venda: "Filipe Padoveze",
    empreendimentos: ["Natal Spot", "Novo Campeche Spot II", "Caraguá Spot", "Bonito Spot II"],
  },
  {
    id: 3,
    name: "Squad 3",
    marketing: "Jean",
    preVenda: "Hellen Dias",
    venda: "Luana Schaikoski",
    empreendimentos: ["Jurerê Spot II", "Jurerê Spot III", "Barra Grande Spot", "Vistas de Anitá II"],
  },
] as const;

const SZI_CONFIG: ModuleConfig = {
  id: "szi",
  label: "Investimentos",
  shortLabel: "SZI",
  pipelineId: 28,
  metaAdsAccountId: "act_205286032338340",
  squads: SZI_SQUADS,
  closers: ["Priscila Pestana Perrone", "Filipe Padoveze", "Luana Schaikoski"],
  presellers: ["Luciana Patrício", "Natália Saramago", "Hellen Dias"],
  squadCloserMap: {
    1: [0],    // Priscila Pestana Perrone
    2: [1],    // Filipe Padoveze
    3: [2],    // Luana Schaikoski
  },
  tablePrefix: "squad",
  apiBase: "/api/dashboard",
  syncFunctions: ["dashboard-light", "meta-ads", "deals-light", "calendar", "presales", "baserow"],
};

// --- MKTP (Marketplace) — single squad, no squad grouping ---

const MKTP_SQUADS: readonly SquadDef[] = [
  {
    id: 1,
    name: "Marketplace",
    marketing: "Rodrigo Guirado",
    preVenda: "Karoane Izabela Soares",  // multiple presellers, using first as squad representative
    venda: "Nevine",
    empreendimentos: [], // TODO: populate with MKTP empreendimentos (all non-active/closed groups)
  },
] as const;

const MKTP_CONFIG: ModuleConfig = {
  id: "mktp",
  label: "Marketplace",
  shortLabel: "MKTP",
  pipelineId: 37,
  metaAdsAccountId: "act_799783985155825",
  squads: MKTP_SQUADS,
  closers: ["Nevine", "Willian Miranda"],
  presellers: ["Karoane Izabela Soares", "Karoline Borges"],
  squadCloserMap: {
    1: [0, 1], // Nevine, Willian Miranda
  },
  tablePrefix: "mktp",
  apiBase: "/api/mktp",
  syncFunctions: ["mktp-dashboard-light", "mktp-meta-ads", "mktp-deals-light", "mktp-calendar", "mktp-presales"],
};

// --- SZS (Serviços) — 3 squads ---

const SZS_SQUADS: readonly SquadDef[] = [
  {
    id: 1,
    name: "Squad 1",
    marketing: "",
    preVenda: "Joyce", // + Larissa Marques
    venda: "Gabriela Lemos",
    canalIds: [12], // Marketing
    empreendimentos: [],
  },
  {
    id: 2,
    name: "Squad 2",
    marketing: "",
    preVenda: "Raynara Lopes",
    venda: "Gabriela Branco",
    canalIds: [582, 583], // Parceiros
    empreendimentos: [],
  },
  {
    id: 3,
    name: "Squad 3",
    marketing: "",
    preVenda: "Raquel",
    venda: "Giovanna de Araujo Zanchetta",
    canalIds: [1748, 3189], // Expansão, Spots — Outros = fallback
    empreendimentos: [],
  },
] as const;

const SZS_CONFIG: ModuleConfig = {
  id: "szs",
  label: "Serviços",
  shortLabel: "SZS",
  pipelineId: 14,
  metaAdsAccountId: "act_721191188358261",
  squads: SZS_SQUADS,
  closers: ["Gabriela Lemos", "Gabriela Branco", "Giovanna de Araujo Zanchetta"],
  presellers: ["Joyce", "Larissa Marques", "Raynara Lopes", "Raquel"],
  squadCloserMap: { 1: [0], 2: [1], 3: [2] },
  tablePrefix: "szs",
  apiBase: "/api/szs",
  syncFunctions: ["szs-dashboard-light", "szs-meta-ads", "szs-deals-light", "szs-calendar", "szs-presales"],
};

// --- Decor — single squad, empreendimento grouping ---

const DECOR_SQUADS: readonly SquadDef[] = [
  {
    id: 1,
    name: "Decor",
    marketing: "",
    preVenda: "Rubia Lorena Santos",
    venda: "Eduardo Albani",
    empreendimentos: [],
  },
] as const;

const DECOR_CONFIG: ModuleConfig = {
  id: "decor",
  label: "Decor",
  shortLabel: "Decor",
  pipelineId: 44,
  metaAdsAccountId: "",
  squads: DECOR_SQUADS,
  closers: ["Eduardo Albani", "Carol Rosário"],
  presellers: ["Rubia Lorena Santos"],
  squadCloserMap: { 1: [0, 1] },
  tablePrefix: "decor",
  apiBase: "/api/decor",
  syncFunctions: ["decor-presales"],
};

// --- Registry ---

export const MODULES: Record<string, ModuleConfig> = {
  szi: SZI_CONFIG,
  mktp: MKTP_CONFIG,
  szs: SZS_CONFIG,
  decor: DECOR_CONFIG,
};

export const MODULE_IDS = Object.keys(MODULES);
export const DEFAULT_MODULE = "szi";

export function getModuleConfig(id: string): ModuleConfig {
  return MODULES[id] ?? MODULES[DEFAULT_MODULE];
}
