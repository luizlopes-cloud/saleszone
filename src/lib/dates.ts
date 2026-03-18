import { MONTHS_PT, WEEKDAYS_PT, NUM_DAYS } from "./constants";
import type { DateColumn } from "./types";

export function generateDates(): DateColumn[] {
  const dates: DateColumn[] = [];
  const today = new Date();
  for (let i = 0; i < NUM_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayOfWeek = d.getDay();
    dates.push({
      date: d.toISOString().substring(0, 10),
      label: `${d.getDate()} ${MONTHS_PT[d.getMonth()]}`,
      weekday: WEEKDAYS_PT[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isSunday: dayOfWeek === 0,
    });
  }
  return dates;
}
