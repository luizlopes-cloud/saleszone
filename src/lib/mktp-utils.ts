// MKTP canal ID → display name mapping

const CANAL_NAME_FROM_ID: Record<string, string> = {
  "12": "Marketing",
  "276": "Prospecção Ativa",
  "582": "Ind. Corretor",
  "583": "Ind. Franquia",
  "543": "Ind. Colaborador",
  "623": "Cliente SZN",
  "10": "Ind. Clientes",
  "804": "Evento",
  "4551": "Mônica",
  "3189": "Spots",
  "3142": "Construtora",
};

export function getMktpCanalName(canalId: string | null | undefined): string {
  if (!canalId) return "Outros";
  return CANAL_NAME_FROM_ID[canalId] || "Outros";
}
