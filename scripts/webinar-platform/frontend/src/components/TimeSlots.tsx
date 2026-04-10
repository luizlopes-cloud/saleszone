import type { Session } from "../lib/types";

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface TimeSlotsProps {
  sessions: Session[];
  selectedDate: string;
  onSelect: (session: Session) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseDateParts(dateStr: string): { day: number; month: number } {
  const [, month, day] = dateStr.split("-").map(Number);
  return { day, month: month - 1 };
}

export default function TimeSlots({ sessions, selectedDate, onSelect }: TimeSlotsProps) {
  const { day, month } = parseDateParts(selectedDate);

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">
        Horários para {day} de {MONTH_NAMES[month]}
      </h3>

      {sessions.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          Nenhum horário disponível
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session)}
              className="py-2 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700
                hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {formatTime(session.starts_at)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
