import { getModuleConfig } from "@/lib/modules";

const mc = getModuleConfig("szs");

// --- Canal → Squad mapping ---

const CANAL_GROUP_TO_SQUAD: Record<string, number> = {
  Marketing: 1,
  Parceiros: 2, "Ind. Corretor": 2, "Ind. Franquia": 2, "Ind. Outros Parceiros": 2,
  Mônica: 3, Expansão: 3, Spots: 3, Outros: 3,
};

/** Map canal_group name (from szs_daily_counts) to new squad id */
export function getSquadIdFromCanalGroup(canalGroup: string): number {
  return CANAL_GROUP_TO_SQUAD[canalGroup] || 3;
}

/** Map numeric canal ID (from szs_deals.canal) to new squad id */
export function getSquadIdFromCanalId(canalId: string | number): number {
  const id = Number(canalId);
  for (const sq of mc.squads) {
    if (sq.canalIds?.includes(id)) return sq.id;
  }
  return 3; // fallback: Expansão/Spot/Outros
}

/** Get squad name by id */
export function getSquadName(squadId: number): string {
  return mc.squads.find((s) => s.id === squadId)?.name || "Outros";
}

// --- City grouping ---

export function getCidadeGroup(cidade: string): string {
  const lower = cidade.toLowerCase();
  if (lower.includes("são paulo") || lower.includes("sao paulo")) return "São Paulo";
  if (lower.includes("salvador")) return "Salvador";
  if (lower.includes("florianópolis") || lower.includes("florianopolis")) return "Florianópolis";
  return "Outros";
}

export const CIDADE_GROUPS = ["São Paulo", "Salvador", "Florianópolis", "Outros"] as const;

// --- Canal group from Pipedrive canal ID (for szs_deals queries) ---

const CANAL_GROUP_FROM_ID: Record<string, string> = {
  "12": "Marketing",
  "582": "Ind. Corretor",
  "583": "Ind. Franquia",
  "2876": "Ind. Outros Parceiros",
  "1748": "Expansão",
  "4551": "Mônica",
  "3189": "Spots",
};

export function getCanalGroupFromId(canalId: string): string {
  return CANAL_GROUP_FROM_ID[canalId] || "Outros";
}

// --- Metas WON consolidadas por squad ---
// Squad 1 = Marketing, Squad 2 = Parceiros, Squad 3 = Expansão + Spots + Outros

const RAW_METAS: Record<string, Record<string, number>> = {
  "2026-01": { Marketing: 66, Parceiros: 67, Expansão: 72, Spots: 48, Outros: 27 },
  "2026-02": { Marketing: 69, Parceiros: 71, Expansão: 84, Spots: 26, Outros: 26 },
  "2026-03": { Marketing: 70, Parceiros: 73, Expansão: 95, Spots: 39, Outros: 28 },
  "2026-04": { Marketing: 73, Parceiros: 75, Expansão: 102, Spots: 17, Outros: 31 },
  "2026-05": { Marketing: 73, Parceiros: 77, Expansão: 109, Spots: 0, Outros: 26 },
  "2026-06": { Marketing: 73, Parceiros: 77, Expansão: 114, Spots: 49, Outros: 33 },
  "2026-07": { Marketing: 71, Parceiros: 75, Expansão: 121, Spots: 0, Outros: 29 },
  "2026-08": { Marketing: 71, Parceiros: 89, Expansão: 120, Spots: 0, Outros: 31 },
  "2026-09": { Marketing: 78, Parceiros: 101, Expansão: 140, Spots: 28, Outros: 32 },
  "2026-10": { Marketing: 71, Parceiros: 114, Expansão: 140, Spots: 0, Outros: 29 },
  "2026-11": { Marketing: 73, Parceiros: 128, Expansão: 141, Spots: 0, Outros: 29 },
  "2026-12": { Marketing: 75, Parceiros: 139, Expansão: 139, Spots: 31, Outros: 31 },
};

export const SZS_METAS_WON_BY_SQUAD: Record<string, Record<number, number>> = {};
for (const [month, canals] of Object.entries(RAW_METAS)) {
  SZS_METAS_WON_BY_SQUAD[month] = {
    1: canals.Marketing || 0,
    2: canals.Parceiros || 0,
    3: (canals["Expansão"] || 0) + (canals.Spots || 0) + (canals.Outros || 0),
  };
}

// --- Nekt meta fields by city × squad ---
// Used to read city-specific metas from nekt_meta26_metas
export const NEKT_META_FIELDS_BY_CITY: Record<string, Record<number, string[]>> = {
  "São Paulo": {
    1: ["won_szs_sp_meta_pago"],
    2: ["won_szs_sp_meta_parceiro"],
    3: ["won_szs_sp_meta_exp", "won_szs_sp_meta_spot", "won_szs_sp_meta_direto"],
  },
  Salvador: {
    1: ["won_szs_sa_meta_pago"],
    2: ["won_szs_sa_meta_parceiro"],
    3: ["won_szs_sa_meta_exp", "won_szs_sa_meta_spot", "won_szs_sa_meta_direto"],
  },
  // Total (all cities)
  _total: {
    1: ["won_szs_meta_pago"],
    2: ["won_szs_meta_parceiro"],
    3: ["won_szs_meta_exp", "won_szs_meta_spot", "won_szs_meta_direto"],
  },
};

/** Read squad metas from nekt row, optionally filtered by city */
export function getSquadMetasFromNekt(
  nektRow: Record<string, unknown>,
  cityFilter: string | null,
): Record<number, number> {
  const fields = cityFilter && NEKT_META_FIELDS_BY_CITY[cityFilter]
    ? NEKT_META_FIELDS_BY_CITY[cityFilter]
    : NEKT_META_FIELDS_BY_CITY._total;

  const result: Record<number, number> = {};
  for (const [sqIdStr, fieldList] of Object.entries(fields)) {
    const sqId = Number(sqIdStr);
    result[sqId] = fieldList.reduce(
      (sum, field) => sum + (Number(nektRow[field]) || 0), 0,
    );
  }

  // Floripa/Outros = Total - Salvador - SP (no dedicated fields)
  if (cityFilter === "Florianópolis" || cityFilter === "Outros") {
    const total = getSquadMetasFromNekt(nektRow, null);
    const sp = getSquadMetasFromNekt(nektRow, "São Paulo");
    const sa = getSquadMetasFromNekt(nektRow, "Salvador");
    for (const sqId of [1, 2, 3]) {
      result[sqId] = Math.max(0, (total[sqId] || 0) - (sp[sqId] || 0) - (sa[sqId] || 0));
    }
  }

  return result;
}
