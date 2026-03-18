// Squad definitions
export const SQUADS = [
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

// Pre-venda and Venda people for alignment view
export const PV_COLS = ["Luciana Patrício", "Natália Saramago", "Hellen Dias"];
export const V_COLS = ["Laura", "Camila Santos", "Filipe Padoveze", "Luana Schaikoski", "Priscila Pestana Perrone"];

// Squad → índices em V_COLS (quais closers pertencem a cada squad)
export const SQUAD_V_MAP: Record<number, number[]> = {
  1: [0],    // Laura
  2: [1, 2], // Camila Santos, Filipe Padoveze
  3: [3, 4], // Luana Schaikoski, Priscila Pestana Perrone
};

// UI Tokens
export const T = {
  primary: "#0055FF",
  primaryFg: "#FFFFFF",
  bg: "#FFFFFF",
  fg: "#080E32",
  card: "#FFFFFF",
  cardFg: "#141A3C",
  muted: "#E6E7EA",
  mutedFg: "#6B6E84",
  destructive: "#E7000B",
  border: "#E6E7EA",
  elevSm: "0 1px 2px rgba(0,0,0,0.2), 0 0.1px 0.3px rgba(0,0,0,0.1)",
  azul50: "#F0F2FA",
  azul600: "#0055FF",
  cinza50: "#F3F3F5",
  cinza100: "#E6E7EA",
  cinza200: "#CECFD6",
  cinza300: "#B5B7C1",
  cinza400: "#9C9FAD",
  cinza600: "#6B6E84",
  cinza700: "#525670",
  cinza800: "#393E5B",
  verde50: "#F0FDF4",
  verde600: "#5EA500",
  verde700: "#15803D",
  vermelho50: "#FEE2E2",
  vermelho100: "#FECACA",
  laranja500: "#FF6900",
  roxo600: "#9810FA",
  teal600: "#0D9488",
  font: "'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export const SQUAD_COLORS: Record<number, string> = { 1: T.azul600, 2: T.roxo600, 3: T.teal600 };

// MQL Balanceamento — opções possíveis do Baserow (multi-select fields)
export const MQL_INTENCOES = [
  { value: "Investimento - renda com aluguel", label: "Renda" },
  { value: "Investimento - valorização do imóvel", label: "Valorização" },
  { value: "Uso próprio - uso esporádico", label: "Esporádico" },
] as const;

export const MQL_FAIXAS = [
  { value: "R$ 100.001 a R$ 200.000 em até 54 meses", label: "100-200k" },
  { value: "R$ 200.001 a R$ 300.000 em até 54 meses", label: "200-300k" },
  { value: "R$ 300.001 a R$ 400.000 em até 54 meses", label: "300-400k" },
  { value: "Acima de R$ 400.000 em até 54 meses", label: ">400k" },
] as const;

export const MQL_PAGAMENTOS = [
  { value: "À vista via PIX ou boleto", label: "À vista" },
  { value: "Parcelado via PIX ou boleto", label: "Parcelado" },
  { value: "Não tenho condição nessas opções", label: "Sem condição" },
] as const;

export const SQUAD_FROM_COMMERCIAL: Record<string, number> = {
  szi_01: 1,
  szi_02: 2,
  szi_03: 3,
};
export const TAB_COLORS: Record<string, string> = {
  mql: T.azul600,
  sql: T.roxo600,
  opp: T.laranja500,
  won: T.verde600,
};
export const TABS = [
  { key: "mql", label: "MQL" },
  { key: "sql", label: "SQL" },
  { key: "opp", label: "OPP" },
  { key: "won", label: "WON" },
] as const;

// Date helpers
export const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const NUM_DAYS = 28;
