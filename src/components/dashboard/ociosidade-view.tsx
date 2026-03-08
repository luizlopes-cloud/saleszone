"use client";

import { T, SQUAD_COLORS } from "@/lib/constants";
import type { OciosidadeData, OciosidadeCloser } from "@/lib/types";

interface Props {
  data: OciosidadeData | null;
  loading: boolean;
}

// Color scale by occupancy %
function occColor(pct: number): string {
  if (pct === 0) return "#E5E7EB"; // sem dados
  if (pct < 30) return "#EF4444"; // muito ocioso
  if (pct < 45) return "#F97316"; // ocioso
  if (pct <= 65) return "#22C55E"; // ideal
  if (pct < 80) return "#F59E0B"; // acima do ideal
  return "#EF4444"; // sobrecarregado
}

function occLabel(pct: number): string {
  if (pct === 0) return "Sem eventos";
  if (pct < 30) return "Muito ocioso";
  if (pct < 45) return "Ocioso";
  if (pct <= 65) return "Ideal";
  if (pct < 80) return "Acima do ideal";
  return "Sobrecarregado";
}

function occFg(pct: number): string {
  if (pct === 0) return "#9CA3AF";
  if (pct >= 45 && pct <= 65) return "#FFF";
  if (pct < 30 || pct >= 80) return "#FFF";
  return "#FFF";
}

function trendArrow(past: number, next: number): { symbol: string; color: string } {
  const diff = next - past;
  if (Math.abs(diff) < 5) return { symbol: "\u2192", color: T.cinza600 }; // →
  if (diff > 0) return { symbol: "\u2191", color: "#22C55E" }; // ↑ mais ocupado = verde (bom se estava ocioso)
  return { symbol: "\u2193", color: "#F97316" }; // ↓ menos ocupado
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

export function OciosidadeView({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados de ociosidade...
      </div>
    );
  }

  if (!data || data.closers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Nenhum dado de ociosidade disponível. Execute o sync do calendar primeiro.
      </div>
    );
  }

  const { closers, dates } = data;

  // Group closers by squad
  const squads = new Map<number, OciosidadeCloser[]>();
  for (const c of closers) {
    if (!squads.has(c.squadId)) squads.set(c.squadId, []);
    squads.get(c.squadId)!.push(c);
  }
  const squadIds = Array.from(squads.keys()).sort();

  return (
    <>
      {/* Section 1: KPI Cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {closers.map((c) => {
          const sqColor = SQUAD_COLORS[c.squadId] || T.azul600;
          const bgColor = occColor(c.avgPast7);
          const trend = trendArrow(c.avgPast7, c.avgNext7);

          return (
            <div
              key={c.email}
              style={{
                flex: "1 1 180px",
                maxWidth: "220px",
                backgroundColor: T.card,
                borderRadius: "12px",
                border: `1px solid ${T.border}`,
                boxShadow: T.elevSm,
                overflow: "hidden",
              }}
            >
              {/* Squad color bar */}
              <div style={{ height: "4px", backgroundColor: sqColor }} />
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>{firstName(c.name)}</span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: sqColor,
                      backgroundColor: `${sqColor}15`,
                      padding: "1px 6px",
                      borderRadius: "4px",
                      fontWeight: 500,
                    }}
                  >
                    Sq{c.squadId}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      color: bgColor,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                    }}
                  >
                    {c.avgPast7}%
                  </span>
                  <span style={{ fontSize: "16px", color: trend.color, fontWeight: 600 }} title={`Próx 7d: ${c.avgNext7}%`}>
                    {trend.symbol}
                  </span>
                </div>
                <div style={{ fontSize: "10px", color: T.cinza600, marginTop: "4px" }}>
                  {occLabel(c.avgPast7)} · Próx 7d: {c.avgNext7}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 2: Heatmap */}
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          marginBottom: "20px",
          overflow: "auto",
        }}
      >
        <div style={{ padding: "12px 16px 8px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: T.fg }}>Ocupacao dia-a-dia</span>
          <span style={{ fontSize: "11px", color: T.cinza600, marginLeft: "12px" }}>
            % da jornada (8h) com reunioes
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...hdrStyle, minWidth: 120, textAlign: "left", position: "sticky", left: 0, backgroundColor: T.cinza50, zIndex: 2 }}>
                Closer
              </th>
              {dates.map((d) => (
                <th
                  key={d.date}
                  style={{
                    ...hdrStyle,
                    textAlign: "center",
                    minWidth: 52,
                    backgroundColor: d.isToday ? T.azul50 : T.cinza50,
                    borderLeft: d.isToday ? `2px solid ${T.azul600}` : undefined,
                    borderRight: d.isToday ? `2px solid ${T.azul600}` : undefined,
                  }}
                >
                  <div style={{ fontSize: "10px", fontWeight: 500 }}>{d.weekday}</div>
                  <div style={{ fontSize: "10px", fontWeight: 400, color: T.cinza400 }}>{d.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {squadIds.map((sqId, sqIdx) => {
              const sqClosers = squads.get(sqId)!;
              const sqColor = SQUAD_COLORS[sqId] || T.azul600;

              return sqClosers.map((c, cIdx) => (
                <tr key={c.email}>
                  {/* Closer name cell */}
                  <td
                    style={{
                      padding: "6px 10px",
                      borderBottom: `1px solid ${T.border}`,
                      borderTop: cIdx === 0 && sqIdx > 0 ? `2px solid ${sqColor}` : undefined,
                      position: "sticky",
                      left: 0,
                      backgroundColor: T.card,
                      zIndex: 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: sqColor,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "12px", fontWeight: 500, color: T.fg }}>{firstName(c.name)}</span>
                    </div>
                  </td>
                  {/* Day cells */}
                  {c.days.map((day) => {
                    const dateInfo = dates.find((d) => d.date === day.date);
                    const bg = occColor(day.occupancyPct);
                    const fg = occFg(day.occupancyPct);

                    return (
                      <td
                        key={day.date}
                        title={`${c.name} · ${day.date}\n${day.eventCount} eventos · ${day.totalMinutes}min\n${day.occupancyPct}% ocupacao`}
                        style={{
                          padding: "4px 2px",
                          borderBottom: `1px solid ${T.border}`,
                          borderTop: cIdx === 0 && sqIdx > 0 ? `2px solid ${sqColor}` : undefined,
                          textAlign: "center",
                          borderLeft: dateInfo?.isToday ? `2px solid ${T.azul600}` : undefined,
                          borderRight: dateInfo?.isToday ? `2px solid ${T.azul600}` : undefined,
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: bg,
                            color: fg,
                            borderRadius: "6px",
                            padding: "6px 4px",
                            fontSize: "12px",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                            margin: "0 2px",
                            opacity: dateInfo?.isPast ? 0.85 : 1,
                          }}
                        >
                          {day.occupancyPct > 0 ? `${day.occupancyPct}` : "-"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: T.cinza600, fontWeight: 500 }}>Faixas:</span>
          {[
            { label: "0-29% Muito ocioso", color: "#EF4444" },
            { label: "30-44% Ocioso", color: "#F97316" },
            { label: "45-65% Ideal", color: "#22C55E" },
            { label: "66-79% Acima", color: "#F59E0B" },
            { label: "80%+ Sobrecarregado", color: "#EF4444" },
            { label: "Sem dados", color: "#E5E7EB" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: f.color }} />
              <span style={{ fontSize: "10px", color: T.cinza600 }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Historical Analysis */}
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px 8px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: T.fg }}>Analise Historica</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: T.cinza50 }}>
              <th style={{ ...thStyle, textAlign: "left" }}>Closer</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Squad</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Media Historica</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Ultimos 7d</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Proximos 7d</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Semana Pico</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Semana Vale</th>
              <th style={{ ...thStyle, textAlign: "center" }}>vs Historico</th>
            </tr>
          </thead>
          <tbody>
            {closers.map((c) => {
              const diff = c.avgPast7 - c.avgHistorical;
              const diffLabel = diff > 0 ? `+${diff}pp` : `${diff}pp`;
              const diffColor = Math.abs(diff) < 5 ? T.cinza600 : diff > 0 ? "#22C55E" : "#F97316";

              return (
                <tr
                  key={c.email}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                >
                  <td style={{ ...tdStyle, fontWeight: 500, color: T.fg }}>{c.name}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        color: SQUAD_COLORS[c.squadId] || T.azul600,
                        backgroundColor: `${SQUAD_COLORS[c.squadId] || T.azul600}15`,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 500,
                      }}
                    >
                      Squad {c.squadId}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{ color: occColor(c.avgHistorical), fontWeight: 600 }}>{c.avgHistorical}%</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{ color: occColor(c.avgPast7), fontWeight: 600 }}>{c.avgPast7}%</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{ color: occColor(c.avgNext7), fontWeight: 600 }}>{c.avgNext7}%</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", fontSize: "11px" }}>
                    {c.maxWeek.weekLabel !== "-" ? `${c.maxWeek.weekLabel} (${c.maxWeek.avg}%)` : "-"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", fontSize: "11px" }}>
                    {c.minWeek.weekLabel !== "-" ? `${c.minWeek.weekLabel} (${c.minWeek.avg}%)` : "-"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", color: diffColor, fontWeight: 600 }}>{diffLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "10px", textAlign: "right" }}>
        <span style={{ fontSize: "11px", color: T.cinza400 }}>
          Google Calendar · Closers SZI · Atualizado {new Date(data.syncedAt).toLocaleString("pt-BR")}
        </span>
      </div>
    </>
  );
}

const hdrStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  backgroundColor: "#F3F3F5",
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid #E6E7EA",
  fontSize: "13px",
  fontWeight: 400,
  color: "#141A3C",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
