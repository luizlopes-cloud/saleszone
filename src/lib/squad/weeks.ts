// Calcula semanas ISO (seg-dom) de um mês para agrupamento no dashboard

export interface Week {
  weekNumber: number
  startDate: string
  endDate: string
  label: string
  rangeLabel: string
}

export interface WeekData extends Week {
  total: number
  dailyValues: { date: string; value: number }[]
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function getWeeksOfMonth(year: number, month: number): Week[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const weeks: Week[] = []

  let current = new Date(firstDay)
  let weekNum = 1

  while (current <= lastDay) {
    const start = new Date(current)
    let end = new Date(current)
    const dow = current.getDay()
    if (dow !== 0) {
      end.setDate(end.getDate() + (7 - dow))
    }
    if (end > lastDay) end = new Date(lastDay)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    const mesLabel = MESES_CURTO[month]
    const rangeLabel = start.getDate() === end.getDate()
      ? `${start.getDate()} ${mesLabel}`
      : `${start.getDate()}-${end.getDate()} ${mesLabel}`

    const isoWeek = getISOWeekNumber(start)

    weeks.push({
      weekNumber: weekNum,
      startDate: startStr,
      endDate: endStr,
      label: `Sem. ${isoWeek}`,
      rangeLabel,
    })

    current = new Date(end)
    current.setDate(current.getDate() + 1)
    weekNum++
  }

  return weeks
}

export function groupByWeeks(dates: string[], daily: number[], weeks: Week[]): WeekData[] {
  return weeks.map(week => {
    const dailyValues: { date: string; value: number }[] = []
    let total = 0

    const start = new Date(week.startDate + 'T00:00:00')
    const end = new Date(week.endDate + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const idx = dates.indexOf(dateStr)
      const value = idx >= 0 ? daily[idx] : 0
      dailyValues.push({ date: dateStr, value })
      total += value
    }

    return { ...week, total, dailyValues }
  })
}

export function getCurrentWeekNumber(weeks: Week[]): number {
  const today = new Date().toISOString().split('T')[0]
  const week = weeks.find(w => today >= w.startDate && today <= w.endDate)
  return week?.weekNumber ?? 0
}
