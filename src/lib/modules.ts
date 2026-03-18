// Module configuration for multi-product dashboard (SZI, MKTP, SZS)

export interface SquadDef {
  id: number;
  name: string;
  marketing: string;
  preVenda: string;
  venda: string;
  empreendimentos: readonly string[];
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
    venda: "Laura",
    empreendimentos: ["Ponta das Canas Spot II", "Itacaré Spot", "Marista 144 Spot"],
  },
  {
    id: 2,
    name: "Squad 2",
    marketing: "Jean",
    preVenda: "Natália Saramago",
    venda: "Camila Santos",
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
  closers: ["Laura", "Camila Santos", "Filipe Padoveze", "Luana Schaikoski", "Priscila Pestana Perrone"],
  presellers: ["Luciana Patrício", "Natália Saramago", "Hellen Dias"],
  squadCloserMap: {
    1: [0],    // Laura
    2: [1, 2], // Camila Santos, Filipe Padoveze
    3: [3, 4], // Luana Schaikoski, Priscila Pestana Perrone
  },
  tablePrefix: "squad",
  apiBase: "/api/dashboard",
  syncFunctions: ["dashboard-light", "meta-ads", "deals-light", "calendar", "presales", "baserow"],
};

// --- MKTP (Marketplace) — placeholder, to be filled after Fase 0 discovery ---

const MKTP_CONFIG: ModuleConfig = {
  id: "mktp",
  label: "Marketplace",
  shortLabel: "MKTP",
  pipelineId: 0,                 // TODO: discover via Pipedrive API
  metaAdsAccountId: "act_799783985155825",
  squads: [],                    // TODO: discover team structure
  closers: [],                   // TODO: discover closers
  presellers: [],                // TODO: discover presellers
  squadCloserMap: {},            // TODO: map after discovering squads
  tablePrefix: "mktp",
  apiBase: "/api/mktp",
  syncFunctions: ["mktp-dashboard-light", "mktp-meta-ads", "mktp-deals-light", "mktp-calendar", "mktp-presales"],
};

// --- Registry ---

export const MODULES: Record<string, ModuleConfig> = {
  szi: SZI_CONFIG,
  mktp: MKTP_CONFIG,
  // szs: SZS_CONFIG, // future
};

export const MODULE_IDS = Object.keys(MODULES);
export const DEFAULT_MODULE = "szi";

export function getModuleConfig(id: string): ModuleConfig {
  return MODULES[id] ?? MODULES[DEFAULT_MODULE];
}
