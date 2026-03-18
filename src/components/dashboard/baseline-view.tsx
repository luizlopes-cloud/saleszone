"use client";

import React, { useState, useMemo } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { BaselineData, BaselineCloserData } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: BaselineData | null;
  loading: boolean;
  lastUpdated?: Date | null;
}

type CellMode = "conversion" | "opp" | "won";

const thStyle: React.CSSProperties = {
  padding: "8px 6px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  backgroundColor: "#f8f8fa",
  textAlign: "center",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 6px",
  borderBottom: "1px solid #E6E7EA",
  fontSize: "12px",
  fontWeight: 400,
  color: "#141A3C",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
};

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMonthZero(mz: string): string {
  const [y, m] = mz.split("-");
  return `${MONTHS_PT[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function conversionColor(value: number, hasData: boolean): { bg: string; color: string } {
  if (!hasData) return { bg: "#f3f3f5", color: "#9C9FAD" };
  if (value >= 25) return { bg: "#dcfce7", color: "#16a34a" };
  if (value >= 15) return { bg: "#fef3c7", color: "#d97706" };
  if (value >= 5) return { bg: "#ffedd5", color: "#ea580c" };
  return { bg: "#fee2e2", color: "#dc2626" };
}

function volumeIntensity(value: number, max: number): { bg: string; color: string } {
  if (value === 0) return { bg: "#f3f3f5", color: "#9C9FAD" };
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.75) return { bg: "#dbeafe", color: "#1d4ed8" };
  if (ratio >= 0.5) return { bg: "#e0f2fe", color: "#0369a1" };
  if (ratio >= 0.25) return { bg: "#f0f9ff", color: "#0284c7" };
  return { bg: "#f8fafc", color: "#64748b" };
}

function rate(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function SummaryCards({ closers }: { closers: BaselineCloserData[] }) {
  const activeCount = closers.length;

  const longestVintage = useMemo(() => {
    if (closers.length === 0) return "—";
    const sorted = [...closers].sort((a, b) => b.monthsActive - a.monthsActive);
    return `${sorted[0].name.split(" ")[0]} — ${sorted[0].monthsActive}m`;
  }, [closers]);

  const bestConversion = useMemo(() => {
    if (closers.length === 0) return "—";
    const sorted = [...closers].sort((a, b) => b.totals.oppToWon - a.totals.oppToWon);
    return `${sorted[0].name.split(" ")[0]} — ${sorted[0].totals.oppToWon}%`;
  }, [closers]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#FFF",
    border: "1px solid #E6E7EA",
    borderRadius: "12px",
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  };

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
      <div style={cardStyle}>
        <span style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Closers Ativos</span>
        <span style={{ fontSize: "22px", fontWeight: 800, color: T.fg, fontVariantNumeric: "tabular-nums" }}>{activeCount}</span>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Maior Vintage</span>
        <span style={{ fontSize: "14px", fontWeight: 700, color: T.azul600 }}>{longestVintage}</span>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Melhor OPP→WON</span>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#16a34a" }}>{bestConversion}</span>
      </div>
    </div>
  );
}

function CellToggle({ mode, setMode }: { mode: CellMode; setMode: (m: CellMode) => void }) {
  const options: { key: CellMode; label: string }[] = [
    { key: "conversion", label: "Conversão %" },
    { key: "opp", label: "Volume OPP" },
    { key: "won", label: "Volume WON" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        backgroundColor: T.cinza50,
        borderRadius: "9999px",
        padding: "3px",
        border: `1px solid ${T.border}`,
        marginBottom: "16px",
        width: "fit-content",
      }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => setMode(o.key)}
          style={{
            padding: "5px 14px",
            borderRadius: "9999px",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            transition: "all 0.15s",
            letterSpacing: "0.02em",
            backgroundColor: mode === o.key ? T.fg : "transparent",
            color: mode === o.key ? "#FFF" : T.cinza600,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CohortTable({ data, mode }: { data: BaselineData; mode: CellMode }) {
  const maxVolumeOpp = useMemo(() => {
    let max = 0;
    for (const c of data.closers) {
      for (const m of c.months) {
        if (m.opp > max) max = m.opp;
      }
    }
    return max;
  }, [data]);

  const maxVolumeWon = useMemo(() => {
    let max = 0;
    for (const c of data.closers) {
      for (const m of c.months) {
        if (m.won > max) max = m.won;
      }
    }
    return max;
  }, [data]);

  const medianTotal = useMemo(() => {
    const values = data.closers.map((c) =>
      mode === "conversion" ? c.totals.oppToWon : mode === "opp" ? c.totals.opp : c.totals.won
    );
    return median(values);
  }, [data, mode]);

  return (
    <div
      style={{
        backgroundColor: T.card,
        borderRadius: "12px",
        border: `1px solid ${T.border}`,
        boxShadow: T.elevSm,
        overflow: "auto",
        marginBottom: "20px",
      }}
    >
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 2, backgroundColor: "#f8f8fa", minWidth: 120 }}>Closer</th>
            <th style={{ ...thStyle, minWidth: 60 }}>Contratação</th>
            <th style={{ ...thStyle, minWidth: 60 }}>Total</th>
            <th style={{ ...thStyle, minWidth: 70 }}>vs Mediana</th>
            {Array.from({ length: data.maxMonthOffset + 1 }, (_, i) => (
              <th key={i} style={{ ...thStyle, minWidth: 52 }}>M{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.closers.map((closer) => {
            const sqColor = SQUAD_COLORS[closer.squadId] || T.azul600;
            const closerTotal = mode === "conversion" ? closer.totals.oppToWon : mode === "opp" ? closer.totals.opp : closer.totals.won;
            const aboveMedian = closerTotal >= medianTotal;
            return (
              <tr key={closer.name}>
                <td style={{ ...tdStyle, textAlign: "left", position: "sticky", left: 0, zIndex: 1, backgroundColor: "#FFF", fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sqColor, flexShrink: 0 }} />
                    {closer.name.split(" ")[0]}
                  </div>
                </td>
                <td style={{ ...tdStyle, fontSize: "11px", color: T.cinza600 }}>{formatMonthZero(closer.monthZero)}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>
                  {mode === "conversion" ? `${closer.totals.oppToWon}%` : mode === "opp" ? closer.totals.opp : closer.totals.won}
                </td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: aboveMedian ? "#dcfce7" : "#fee2e2",
                      color: aboveMedian ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {aboveMedian ? "Acima" : "Abaixo"}
                  </span>
                </td>
                {Array.from({ length: data.maxMonthOffset + 1 }, (_, i) => {
                  const monthData = closer.months[i];
                  if (!monthData || i > closer.monthsActive) {
                    return <td key={i} style={{ ...tdStyle, backgroundColor: "#f9fafb" }} />;
                  }

                  let cellBg: string;
                  let cellColor: string;
                  let cellValue: string;

                  if (mode === "conversion") {
                    const hasData = monthData.opp > 0;
                    const colors = conversionColor(monthData.oppToWon, hasData);
                    cellBg = colors.bg;
                    cellColor = colors.color;
                    cellValue = hasData ? `${monthData.oppToWon}%` : "—";
                  } else if (mode === "opp") {
                    const colors = volumeIntensity(monthData.opp, maxVolumeOpp);
                    cellBg = colors.bg;
                    cellColor = colors.color;
                    cellValue = String(monthData.opp);
                  } else {
                    const colors = volumeIntensity(monthData.won, maxVolumeWon);
                    cellBg = colors.bg;
                    cellColor = colors.color;
                    cellValue = String(monthData.won);
                  }

                  return (
                    <td
                      key={i}
                      style={{
                        ...tdStyle,
                        backgroundColor: cellBg,
                        color: cellColor,
                        fontWeight: 600,
                        fontSize: "11px",
                      }}
                      title={`M${i}: OPP=${monthData.opp} WON=${monthData.won} Conv=${monthData.oppToWon}%`}
                    >
                      {cellValue}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const CHART_PERIODS = [
  { label: "90d", months: 3 },
  { label: "180d", months: 6 },
  { label: "12m", months: 12 },
  { label: "Tudo", months: 0 },
] as const;

const CHART_MODE_LABELS: Record<CellMode, string> = {
  conversion: "OPP→WON % desde contratação",
  opp: "OPP acumulado desde contratação",
  won: "WON acumulado desde contratação",
};

function getValue(m: { opp: number; won: number; oppToWon: number; wonAccumulated: number; oppAccumulated: number }, mode: CellMode): number {
  if (mode === "conversion") return m.oppToWon;
  if (mode === "opp") return m.oppAccumulated;
  return m.wonAccumulated;
}

function formatLabel(v: number, mode: CellMode): string {
  if (mode === "conversion") return `${v}%`;
  return String(v);
}

function BaselineChart({ data, cellMode }: { data: BaselineData; cellMode: CellMode }) {
  const [periodMonths, setPeriodMonths] = useState(0);

  const W = 800, H = 320, PAD = { top: 20, right: 160, bottom: 40, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxX = periodMonths > 0 ? periodMonths : data.maxMonthOffset;

  const lines = useMemo(() => {
    // Pre-compute oppAccumulated per closer
    return data.closers.map((c) => {
      let oppAccum = 0;
      const pts = c.months
        .filter((m) => m.monthOffset <= maxX)
        .map((m) => {
          oppAccum += m.opp;
          return { monthOffset: m.monthOffset, opp: m.opp, won: m.won, oppToWon: m.oppToWon, wonAccumulated: m.wonAccumulated, oppAccumulated: oppAccum };
        });
      return {
        name: c.name,
        color: SQUAD_COLORS[c.squadId] || T.azul600,
        points: pts,
      };
    });
  }, [data, maxX]);

  // Compute median line: at each monthOffset, median of all closers that have data
  const medianLine = useMemo(() => {
    const pts: { monthOffset: number; value: number }[] = [];
    for (let mo = 0; mo <= maxX; mo++) {
      const vals: number[] = [];
      for (const l of lines) {
        const pt = l.points.find((p) => p.monthOffset === mo);
        if (pt) vals.push(getValue(pt, cellMode));
      }
      if (vals.length >= 2) {
        pts.push({ monthOffset: mo, value: median(vals) });
      }
    }
    return pts;
  }, [lines, maxX, cellMode]);

  if (lines.length === 0) return null;

  const allValues = [
    ...lines.flatMap((s) => s.points.map((p) => getValue(p, cellMode))),
    ...medianLine.map((p) => p.value),
  ];
  const rawMax = Math.max(...allValues, 1);
  const isPercent = cellMode === "conversion";
  const step = isPercent
    ? (rawMax <= 30 ? 10 : rawMax <= 60 ? 10 : 20)
    : (rawMax <= 20 ? 5 : rawMax <= 50 ? 10 : rawMax <= 100 ? 20 : 50);
  const maxY = Math.ceil((rawMax + step / 2) / step) * step;

  const x = (i: number) => PAD.left + (i / Math.max(maxX, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += step) yTicks.push(v);

  const xLabels: number[] = [];
  const xStep = Math.max(1, Math.floor(maxX / 12));
  for (let i = 0; i <= maxX; i += xStep) xLabels.push(i);
  if (!xLabels.includes(maxX)) xLabels.push(maxX);

  // Spread end labels vertically to avoid overlap
  const endLabels = lines
    .filter((s) => s.points.length > 0)
    .map((s) => {
      const lastPt = s.points[s.points.length - 1];
      return { name: s.name, color: s.color, yVal: getValue(lastPt, cellMode) };
    })
    .sort((a, b) => b.yVal - a.yVal);
  const labelPositions: Record<string, number> = {};
  let lastLabelY = -999;
  for (const lb of endLabels) {
    let posY = y(lb.yVal) + 4;
    if (posY - lastLabelY < 14) posY = lastLabelY + 14;
    labelPositions[lb.name] = posY;
    lastLabelY = posY;
  }

  return (
    <div
      style={{
        backgroundColor: T.card,
        borderRadius: "12px",
        border: `1px solid ${T.border}`,
        boxShadow: T.elevSm,
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza700 }}>{CHART_MODE_LABELS[cellMode]}</div>
        <div
          style={{
            display: "flex",
            gap: "2px",
            backgroundColor: T.cinza50,
            borderRadius: "9999px",
            padding: "2px",
            border: `1px solid ${T.border}`,
          }}
        >
          {CHART_PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPeriodMonths(p.months)}
              style={{
                padding: "3px 10px",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 500,
                transition: "all 0.15s",
                letterSpacing: "0.02em",
                backgroundColor: periodMonths === p.months ? T.fg : "transparent",
                color: periodMonths === p.months ? "#FFF" : T.cinza600,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", maxHeight: "360px" }}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={y(v)} x2={PAD.left + plotW} y2={y(v)} stroke={T.cinza200} strokeWidth={0.5} />
            <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill={T.cinza600}>{isPercent ? `${v}%` : v}</text>
          </g>
        ))}
        {xLabels.map((i) => (
          <g key={i}>
            <text x={x(i)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill={T.cinza600}>M{i}</text>
          </g>
        ))}
        {/* Median baseline */}
        {medianLine.length >= 2 && (() => {
          const medPathD = medianLine.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.monthOffset)} ${y(p.value)}`).join(" ");
          const lastMed = medianLine[medianLine.length - 1];
          return (
            <g>
              <path d={medPathD} fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="8 4" />
              <text
                x={x(lastMed.monthOffset) + 8}
                y={y(lastMed.value) + 4}
                fontSize="11"
                fontWeight={700}
                fill="#f59e0b"
              >
                Mediana {formatLabel(Math.round(lastMed.value * 10) / 10, cellMode)}
              </text>
            </g>
          );
        })()}
        {lines.map((s) => {
          if (s.points.length === 0) return null;
          const pathD = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.monthOffset)} ${y(getValue(p, cellMode))}`).join(" ");
          const lastPt = s.points[s.points.length - 1];
          const lastVal = getValue(lastPt, cellMode);
          return (
            <g key={s.name}>
              <path d={pathD} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
              {s.points.filter((_, i) => i === 0 || i === s.points.length - 1 || i % 3 === 0).map((p, i) => (
                <circle key={i} cx={x(p.monthOffset)} cy={y(getValue(p, cellMode))} r={2.5} fill={s.color} stroke="#FFF" strokeWidth={1.5} />
              ))}
              <text
                x={x(lastPt.monthOffset) + 8}
                y={labelPositions[s.name]}
                fontSize="11"
                fontWeight={600}
                fill={s.color}
              >
                {s.name.split(" ")[0]} {formatLabel(lastVal, cellMode)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BaselineView({ data, loading, lastUpdated }: Props) {
  const [cellMode, setCellMode] = useState<CellMode>("conversion");

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando Base-Line...</p>
      </div>
    );
  }

  if (!data || data.closers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Sem dados de Base-Line</p>
      </div>
    );
  }

  return (
    <div>
      <SummaryCards closers={data.closers} />
      <CellToggle mode={cellMode} setMode={setCellMode} />
      <CohortTable data={data} mode={cellMode} />
      <BaselineChart data={data} cellMode={cellMode} />
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
