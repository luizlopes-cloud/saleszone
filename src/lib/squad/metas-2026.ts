// Metas Comerciais 2026 — dados do Google Sheets BP26
// Fonte: https://docs.google.com/spreadsheets/d/11x0XPuXgnGtJyXzQxJiIOXJmD8flDKTj0lBO69exNzs

// Metas mensais por pipeline e canal [Jan..Dez] (índice 0-11)
export const METAS_2026: Record<string, Record<string, number[]>> = {
  szi: {
    'Parceiros': [53, 67, 55, 69, 78, 84, 82, 80, 64, 83, 73, 75],
    'Diretas': [36, 44, 40, 45, 53, 67, 71, 66, 52, 62, 57, 60],
    'Grupo': [1, 0, 1, 1, 1, 1, 1, 4, 2, 2, 1, 1],
  },
  marketplace: {
    'Parceiros': [6, 6, 6, 11, 11, 11, 14, 14, 14, 14, 14, 14],
    'Diretas': [9, 9, 9, 19, 19, 19, 26, 26, 26, 26, 26, 26],
  },
  decor: {
    'Expansão': [7, 7, 9, 10, 11, 11, 12, 12, 12, 14, 14, 14],
    'Spot': [54, 54, 53, 53, 57, 53, 72, 79, 68, 62, 66, 63],
  },
  szs: {
    'Marketing': [66, 69, 70, 73, 73, 73, 71, 71, 78, 71, 73, 75],
    'Parceiros': [67, 71, 73, 75, 77, 77, 75, 89, 101, 114, 128, 139],
    'Expansão': [72, 84, 95, 102, 109, 114, 121, 120, 140, 140, 141, 139],
    'Spot': [48, 17, 39, 17, 0, 49, 0, 0, 28, 0, 0, 0],
    'Outros': [27, 26, 28, 31, 26, 33, 29, 31, 32, 29, 29, 31],
  },
}

export const METAS_SZS_SUBREGIOES: Record<string, number[]> = {
  'Salvador': [18, 18, 19, 20, 20, 21, 22, 23, 24, 25, 27, 28],
  'SP': [6, 25, 21, 27, 20, 9, 19, 21, 22, 23, 26, 27],
}

const PARCEIROS_CANAL_IDS = ['583', '582']

export function classificarCanal(pipelineSlug: string, canalOptionId: string | number | null | undefined): string {
  const id = String(canalOptionId || '')
  switch (pipelineSlug) {
    case 'szi':
    case 'marketplace':
      return PARCEIROS_CANAL_IDS.includes(id) ? 'Parceiros' : 'Diretas'
    case 'decor':
      return id === '3189' ? 'Spot' : 'Expansão'
    case 'szs': {
      if (id === '12' || id === '4550') return 'Marketing'
      if (PARCEIROS_CANAL_IDS.includes(id)) return 'Parceiros'
      if (id === '1748') return 'Expansão'
      if (id === '3189') return 'Spot'
      return 'Outros'
    }
    default:
      return 'Outros'
  }
}

export function getMetaMensal(pipelineSlug: string, canal: string, mes: number): number {
  return METAS_2026[pipelineSlug]?.[canal]?.[mes] ?? 0
}

export function getMetaTotalMensal(pipelineSlug: string, mes: number): number {
  const canais = METAS_2026[pipelineSlug]
  if (!canais) return 0
  return Object.values(canais).reduce((sum, arr) => sum + (arr[mes] ?? 0), 0)
}

export function getCanaisMeta(pipelineSlug: string): string[] {
  return Object.keys(METAS_2026[pipelineSlug] || {})
}

export function getDiasUteis(ano: number, mes: number): number {
  const firstDay = new Date(ano, mes, 1)
  const lastDay = new Date(ano, mes + 1, 0)
  let count = 0
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export function getDiasUteisPassados(ano: number, mes: number, dia: number): number {
  const firstDay = new Date(ano, mes, 1)
  const targetDay = new Date(ano, mes, dia)
  let count = 0
  for (let d = new Date(firstDay); d <= targetDay; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}
