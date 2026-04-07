"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { T, SQUAD_COLORS, SQUADS, MONTHS_PT, NUM_DAYS } from "@/lib/constants";
import type { RatioHistoryData, RatioSnapshot } from "@/lib/types";

const RATIO_KEYS = ["mql_sql", "sql_opp", "opp_won", "mql_won"] as const;
type RatioKey = typeof RATIO_KEYS[number];

const RATIO_LABELS: Record<RatioKey, string> = {
  mql_sql: "MQL → SQL",
  sql_opp: "SQL → OPP",
  opp_won: "OPP → WON",
  mql_won: "MQL → WON",
};

const LINE_COLORS: Record<RatioKey, string> = {
  mql_sql: T.azul600,
  sql_opp: T.roxo600,
  opp_won: T.laranja500,
  mql_won: T.verde600,
};

const PERIODS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

const SQUAD_OPTIONS = [
  { id: 0, label: "Global" },
  { id: 1, label: "Squad 1" },
  { id: 2, label: "Squad 2" },
];

const SZS_SQUAD_OPTIONS = [
  { id: 0, label: "Global" },
  { id: 1, label: "Squad 1" },
  { id: 2, label: "Squad 2" },
  { id: 3, label: "Squad 3" },
];

const SZS_SQUAD_COLORS: Record<number, string> = {
  1: T.azul600, 2: T.roxo600, 3: T.teal600,
};

interface Props {
  data: RatioHistoryData | null;
  loading: boolean;
  daysBack: number;
  onDaysChange: (days: number) => void;
  moduleId?: string;
}

function ratioToConvPct(ratio: number): number {
  return ratio > 0 ? (1 / ratio) * 100 : 0;
}

function getTrend(history: RatioSnapshot[], squadId: number, ratioKey: RatioKey, daysAgo: number): { diff: number; direction: "better" | "worse" | "neutral" } | null {
  const sqHistory = history.filter(r => r.squad_id === squadId).sort((a, b) => b.date.localeCompare(a.date));
  if (sqHistory.length < 2) return null;

  const current = sqHistory[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAgo);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  const past = sqHistory.find(r => r.date <= cutoffStr);
  if (!past) return null;

  const currentPct = ratioToConvPct(getRatio(current, ratioKey));
  const pastPct = ratioToConvPct(getRatio(past, ratioKey));
  if (pastPct === 0) return null;

  const diff = currentPct - pastPct;
  const direction = Math.abs(diff) < 0.05 ? "neutral" : diff > 0 ? "better" : "worse";
  return { diff, direction };
}

const RATIO_FORMULAS: Record<RatioKey, { num: "sql" | "opp" | "won"; den: "mql" | "sql" | "opp"; desc: string }> = {
  mql_sql: { num: "sql", den: "mql", desc: "Taxa de conversão MQL → SQL" },
  sql_opp: { num: "opp", den: "sql", desc: "Taxa de conversão SQL → OPP" },
  opp_won: { num: "won", den: "opp", desc: "Taxa de conversão OPP → WON" },
  mql_won: { num: "won", den: "mql", desc: "Taxa de conversão ponta a ponta" },
};

// Get ratio value from snapshot — mql_won is computed, others come from JSONB
function getRatio(snap: RatioSnapshot, key: RatioKey): number {
  if (key === "mql_won") {
    return snap.counts_90d.won > 0 ? snap.counts_90d.mql / snap.counts_90d.won : 0;
  }
  return snap.ratios[key as keyof typeof snap.ratios];
}

function RatioCard({ label, ratioKey, ratio, counts, trend7d, trend30d, accentColor }: {
  label: string;
  ratioKey: RatioKey;
  ratio: number;
  counts: { mql: number; sql: number; opp: number; won: number };
  trend7d: ReturnType<typeof getTrend>;
  trend30d: ReturnType<typeof getTrend>;
  accentColor?: string;
}) {
  const formula = RATIO_FORMULAS[ratioKey];
  const numVal = counts[formula.num];
  const denVal = counts[formula.den];
  const convPct = ratioToConvPct(ratio);

  return (
    <div style={{
      flex: "1 1 0",
      minWidth: "180px",
      backgroundColor: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: "12px",
      padding: "16px 20px",
      boxShadow: T.elevSm,
      borderTop: accentColor ? `3px solid ${accentColor}` : undefined,
    }}>
      <div style={{ fontSize: "11px", fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color: T.cardFg, fontVariantNumeric: "tabular-nums" }}>
        {convPct.toFixed(1)}%
      </div>
      <div style={{ fontSize: "11px", color: T.cinza400, marginTop: "4px", lineHeight: "1.5" }}>
        <span style={{ color: T.cinza600, fontWeight: 500 }}>{numVal.toLocaleString("pt-BR")}</span>
        {" "}{formula.num.toUpperCase()} ÷{" "}
        <span style={{ color: T.cinza600, fontWeight: 500 }}>{denVal.toLocaleString("pt-BR")}</span>
        {" "}{formula.den.toUpperCase()}
        <span style={{ color: T.cinza400 }}>{" "}(90d)</span>
      </div>
      <div style={{ fontSize: "10px", color: T.cinza400, marginTop: "2px" }}>
        {formula.desc}
      </div>
      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        {trend7d && <TrendBadge label="7d" {...trend7d} />}
        {trend30d && <TrendBadge label="30d" {...trend30d} />}
      </div>
    </div>
  );
}

function TrendBadge({ label, diff, direction }: { label: string; diff: number; direction: "better" | "worse" | "neutral" }) {
  const color = direction === "better" ? T.verde600 : direction === "worse" ? T.destructive : T.cinza400;
  const Icon = direction === "better" ? TrendingUp : direction === "worse" ? TrendingDown : Minus;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
      <Icon size={12} color={color} />
      <span style={{ fontSize: "11px", fontWeight: 500, color }}>
        {diff > 0 ? "+" : ""}{diff.toFixed(1)}pp ({label})
      </span>
    </div>
  );
}

// SVG line chart — one ratio at a time, all squads as separate lines
function RatioChart({ history, selectedRatio, period, squadIds, squadColors: chartColors }: {
  history: RatioSnapshot[];
  selectedRatio: RatioKey;
  period: number;
  squadIds: number[];
  squadColors: Record<number, string>;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const cutoffStr = cutoff.toISOString().substring(0, 10);

    const filtered = history
      .filter(r => r.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    const bySquad = new Map<number, RatioSnapshot[]>();
    for (const r of filtered) {
      if (!bySquad.has(r.squad_id)) bySquad.set(r.squad_id, []);
      bySquad.get(r.squad_id)!.push(r);
    }
    return bySquad;
  }, [history, period]);

  // Need at least 2 dates
  const anyPoints = Array.from(chartData.values()).find(pts => pts.length >= 2);
  if (!anyPoints) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: T.cinza400, fontSize: "13px" }}>
        Dados insuficientes para gráfico. Aguarde 2+ dias de coleta.
      </div>
    );
  }

  const allPoints = Array.from(chartData.values()).flat();
  let minVal = Infinity, maxVal = -Infinity;
  for (const p of allPoints) {
    const v = ratioToConvPct(getRatio(p, selectedRatio));
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  const padding = (maxVal - minVal) * 0.15 || 0.5;
  minVal = Math.max(0, minVal - padding);
  maxVal = maxVal + padding;

  const W = 900, H = 280, PL = 50, PR = 20, PT = 20, PB = 40;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const dates = [...new Set(allPoints.map(p => p.date))].sort();
  const xScale = (date: string) => PL + (dates.indexOf(date) / Math.max(dates.length - 1, 1)) * chartW;
  const yScale = (val: number) => PT + chartH - ((val - minVal) / (maxVal - minVal || 1)) * chartH;

  const yTicks: number[] = [];
  const step = (maxVal - minVal) / 4 || 1;
  for (let i = 0; i <= 4; i++) yTicks.push(minVal + step * i);

  const xLabelStep = Math.max(1, Math.floor(dates.length / 6));
  const xLabels = dates.filter((_, i) => i % xLabelStep === 0 || i === dates.length - 1);

  function buildPath(points: RatioSnapshot[]): string {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.date).toFixed(1)},${yScale(ratioToConvPct(getRatio(p, selectedRatio))).toFixed(1)}`).join(" ");
  }

  const SQUAD_LABELS: Record<number, string> = { 0: "Global", 1: "Squad 1", 2: "Squad 2" };

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: "300px" }}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={yScale(v)} y2={yScale(v)} stroke={T.cinza200} strokeDasharray="4,4" />
            <text x={PL - 8} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill={T.cinza400}>{v.toFixed(1)}%</text>
          </g>
        ))}
        {xLabels.map(d => (
          <text key={d} x={xScale(d)} y={H - 8} textAnchor="middle" fontSize="10" fill={T.cinza400}>
            {d.substring(5).replace("-", "/")}
          </text>
        ))}

        {/* Lines: one per squad */}
        {squadIds.map(sqId => {
          const points = chartData.get(sqId);
          if (!points || points.length < 2) return null;
          const color = sqId === 0 ? T.cinza600 : chartColors[sqId] || T.cinza400;
          const strokeW = sqId === 0 ? 2 : 2.5;
          const dash = sqId === 0 ? "6,4" : undefined;
          return (
            <path
              key={sqId}
              d={buildPath(points)}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              strokeDasharray={dash}
              opacity={0.9}
            />
          );
        })}

        {/* Hover dots for all squads */}
        {[...squadIds.filter(id => id !== 0), 0].map(sqId => {
          const points = chartData.get(sqId);
          if (!points) return null;
          const color = sqId === 0 ? T.cinza600 : chartColors[sqId] || T.cinza400;
          return points.map((p, i) => (
            <circle
              key={`${sqId}-${i}`}
              cx={xScale(p.date)}
              cy={yScale(ratioToConvPct(getRatio(p, selectedRatio)))}
              r={4}
              fill={color}
              opacity={0}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                const rect = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top - 40,
                  content: `${p.date} · ${SQUAD_LABELS[sqId]}\n${RATIO_LABELS[selectedRatio]}: ${ratioToConvPct(getRatio(p, selectedRatio)).toFixed(1)}%\n90d: MQL=${p.counts_90d.mql} SQL=${p.counts_90d.sql} OPP=${p.counts_90d.opp} WON=${p.counts_90d.won}`,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ));
        })}
      </svg>
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y,
          backgroundColor: "#1a1a2e",
          color: "#e0e0e0",
          borderRadius: "6px",
          padding: "8px 12px",
          fontSize: "11px",
          lineHeight: "1.6",
          whiteSpace: "pre",
          pointerEvents: "none",
          zIndex: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          transform: "translateX(-50%)",
        }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

function heatBg(pct: number, allPcts: number[]): string {
  const sorted = [...allPcts].filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0 || pct === 0) return "transparent";
  const min = sorted[0], max = sorted[sorted.length - 1];
  if (min === max) return "rgba(34,197,94,0.12)";
  const ratio = (pct - min) / (max - min);
  // Red (low) → Yellow (mid) → Green (high)
  if (ratio <= 0.5) {
    const t = ratio * 2;
    const r = Math.round(239 + (234 - 239) * t);
    const g = Math.round(68 + (179 - 68) * t);
    const b = Math.round(68 + (8 - 68) * t);
    return `rgba(${r},${g},${b},0.18)`;
  }
  const t = (ratio - 0.5) * 2;
  const r = Math.round(234 + (34 - 234) * t);
  const g = Math.round(179 + (197 - 179) * t);
  const b = Math.round(8 + (94 - 8) * t);
  return `rgba(${r},${g},${b},0.18)`;
}

function RatioHeatmap({ squads, getSnapshot, history }: {
  squads: typeof SQUAD_OPTIONS;
  getSnapshot: (id: number) => RatioSnapshot;
  history: RatioSnapshot[];
}) {
  // Collect all pcts per ratio key for heatmap coloring (column-wise)
  const allPctsByKey: Record<RatioKey, number[]> = { mql_sql: [], sql_opp: [], opp_won: [], mql_won: [] };
  for (const sq of squads) {
    const snap = getSnapshot(sq.id);
    for (const key of RATIO_KEYS) {
      allPctsByKey[key].push(ratioToConvPct(getRatio(snap, key)));
    }
  }

  const cellBase: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: "13px",
    borderBottom: `1px solid ${T.border}`,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    verticalAlign: "middle",
  };

  return (
    <div style={{
      backgroundColor: T.card,
      borderRadius: "12px",
      border: `1px solid ${T.border}`,
      boxShadow: T.elevSm,
      overflow: "hidden",
      marginBottom: "16px",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: T.fg }}>
            <th style={{ ...cellBase, textAlign: "left", color: T.primaryFg, fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", width: "120px" }}>Squad</th>
            {RATIO_KEYS.map(key => (
              <th key={key} style={{ ...cellBase, color: T.primaryFg, fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {RATIO_LABELS[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {squads.map(sq => {
            const snap = getSnapshot(sq.id);
            const color = sq.id === 0 ? T.cinza600 : SQUAD_COLORS[sq.id];
            const isGlobal = sq.id === 0;
            return (
              <tr
                key={sq.id}
                style={{
                  backgroundColor: isGlobal ? T.cinza50 : undefined,
                  borderTop: isGlobal ? undefined : `2px solid ${color}22`,
                }}
                onMouseEnter={(e) => { if (!isGlobal) e.currentTarget.style.backgroundColor = T.cinza50; }}
                onMouseLeave={(e) => { if (!isGlobal) e.currentTarget.style.backgroundColor = ""; }}
              >
                <td style={{ ...cellBase, textAlign: "left", fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "9999px", backgroundColor: color, flexShrink: 0 }} />
                    <span style={{ color: T.cinza800, fontSize: "13px" }}>{sq.label}</span>
                  </div>
                </td>
                {RATIO_KEYS.map(key => {
                  const ratio = getRatio(snap, key);
                  const pct = ratioToConvPct(ratio);
                  const formula = RATIO_FORMULAS[key];
                  const num = snap.counts_90d[formula.num];
                  const den = snap.counts_90d[formula.den];
                  const t7 = getTrend(history, sq.id, key, 7);
                  const t30 = getTrend(history, sq.id, key, 30);
                  const bg = heatBg(pct, allPctsByKey[key]);

                  return (
                    <td key={key} style={{ ...cellBase, backgroundColor: bg }}>
                      <div style={{ fontWeight: 700, fontSize: "16px", color: T.cardFg }}>{pct.toFixed(1)}%</div>
                      <div style={{ fontSize: "10px", color: T.cinza400, marginTop: "2px" }}>
                        {num} {formula.num.toUpperCase()} / {den} {formula.den.toUpperCase()}
                      </div>
                      {(t7 || t30) && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "3px", justifyContent: "flex-end" }}>
                          {t7 && <MiniTrend diff={t7.diff} direction={t7.direction} label="7d" />}
                          {t30 && <MiniTrend diff={t30.diff} direction={t30.direction} label="30d" />}
                        </div>
                      )}
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

// Daily conversion heatmap — same format as acompanhamento heatmap
function DailyConversionHeatmap({ empDaily, dates, selectedRatio, history, getSnapshot, squadDefs, squadColors, empLabel }: {
  empDaily: Record<string, Record<string, Record<string, number>>>;
  dates: string[];
  selectedRatio: RatioKey;
  history: RatioSnapshot[];
  getSnapshot: (id: number) => RatioSnapshot;
  squadDefs: Array<{ id: number; name: string; empreendimentos: readonly string[] }>;
  squadColors: Record<number, string>;
  empLabel: string;
}) {
  const defaultExpanded: Record<number, boolean> = {};
  for (const sq of squadDefs) defaultExpanded[sq.id] = true;
  const [expandedSq, setExpandedSq] = useState<Record<number, boolean>>(defaultExpanded);
  const [hCol, setHCol] = useState<number | null>(null);
  const toggle = (id: number) => setExpandedSq(p => ({ ...p, [id]: !p[id] }));

  const formula = RATIO_FORMULAS[selectedRatio];
  const numTab = formula.num;  // e.g. "sql"
  const denTab = formula.den;  // e.g. "mql"

  // Parse dates for display
  const parsedDates = useMemo(() => dates.map(d => {
    const dt = new Date(d + "T12:00:00");
    const dow = dt.getDay();
    const day = dt.getDate();
    const mon = dt.getMonth();
    return {
      date: d,
      label: `${day}/${mon + 1}`,
      weekday: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][dow],
      isWeekend: dow === 0 || dow === 6,
      isSunday: dow === 0,
    };
  }), [dates]);

  const weekStarts = useMemo(() => {
    const s = new Set<number>();
    parsedDates.forEach((d, i) => { if (d.isSunday && i > 0) s.add(i); });
    return s;
  }, [parsedDates]);

  // For each emp, compute 90d rolling conversion % for each date
  // Same logic as squad ratios: sum counts in 90d window ending on that date
  const allDatesInData = useMemo(() => {
    const s = new Set<string>();
    for (const emp of Object.keys(empDaily)) {
      for (const d of Object.keys(empDaily[emp])) s.add(d);
    }
    return [...s].sort();
  }, [empDaily]);

  function getEmpDailyConv(emp: string): number[] {
    return dates.map(targetDate => {
      // Sum counts in 90d window ending on targetDate
      const cutoff = new Date(targetDate + "T12:00:00");
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().substring(0, 10);
      let cumNum = 0, cumDen = 0;
      for (const d of allDatesInData) {
        if (d > targetDate || d < cutoffStr) continue;
        const counts = empDaily[emp]?.[d];
        if (counts) {
          cumNum += counts[numTab] || 0;
          cumDen += counts[denTab] || 0;
        }
      }
      return cumDen > 0 ? (cumNum / cumDen) * 100 : 0;
    });
  }

  // Squad-level daily conversion from squad_ratios_daily
  function getSquadDailyConv(sqId: number): number[] {
    const sqHistory = history.filter(r => r.squad_id === sqId);
    const byDate = new Map<string, number>();
    for (const r of sqHistory) {
      byDate.set(r.date, ratioToConvPct(getRatio(r, selectedRatio)));
    }
    return dates.map(d => byDate.get(d) || 0);
  }

  // Collect all non-zero values for heat coloring
  const allVals: number[] = [];
  for (const sq of squadDefs) {
    const sqConv = getSquadDailyConv(sq.id);
    sqConv.forEach(v => { if (v > 0) allVals.push(v); });
  }

  const cellBg = (i: number) => hCol === i ? T.azul50 : parsedDates[i]?.isWeekend ? "#FAFAFB" : "transparent";

  const hdrStyle: React.CSSProperties = {
    padding: "4px 2px",
    fontSize: "10px",
    fontWeight: 600,
    color: T.cinza600,
    textAlign: "right",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "5px 4px",
    fontSize: "12px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    borderBottom: `1px solid ${T.border}`,
  };

  return (
    <div style={{
      backgroundColor: T.card,
      borderRadius: "12px",
      border: `1px solid ${T.border}`,
      boxShadow: T.elevSm,
      overflow: "hidden",
      marginBottom: "16px",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1600px" }}>
          <thead>
            <tr style={{ backgroundColor: T.fg }}>
              <th style={{ ...hdrStyle, textAlign: "left", width: "120px", padding: "6px 10px", color: T.primaryFg }}>{empLabel === "Cidade" ? "Canal" : "Squad"}</th>
              <th style={{ ...hdrStyle, width: "170px", textAlign: "left", padding: "6px 10px", color: T.primaryFg }} title={empLabel}>{empLabel}</th>
              <th style={{ ...hdrStyle, width: "60px", color: T.primaryFg }} title="Taxa de conversão nos últimos 30 dias (para comparar com o rolling 90d diário)">30d %</th>
              {parsedDates.map((d, i) => (
                <th
                  key={i}
                  style={{
                    ...hdrStyle,
                    backgroundColor: hCol === i ? T.azul50 : d.isWeekend ? "#FAFAFB" : undefined,
                    borderLeft: weekStarts.has(i) ? `2px solid ${T.cinza200}` : undefined,
                    width: "46px",
                    color: T.primaryFg,
                  }}
                  title={`${d.date}: taxa de conversão ${RATIO_LABELS[selectedRatio]} (rolling 90 dias até este dia)`}
                  onMouseEnter={() => setHCol(i)}
                  onMouseLeave={() => setHCol(null)}
                >
                  <div style={{ lineHeight: "1.1" }}>
                    <div style={{ fontSize: "9px", color: d.isWeekend ? T.cinza400 : T.cinza600, fontWeight: 400 }}>{d.weekday}</div>
                    <div>{d.label}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {squadDefs.map(sq => {
              const isOpen = expandedSq[sq.id] !== false;
              const clr = squadColors[sq.id] || T.azul600;
              const sqConv = getSquadDailyConv(sq.id);
              const sqEmps = sq.empreendimentos;
              // Squad 30d conversion (to compare with 90d daily values)
              const now30 = new Date();
              now30.setDate(now30.getDate() - 30);
              const cutoff30 = now30.toISOString().substring(0, 10);
              let sq30Num = 0, sq30Den = 0;
              for (const emp of sqEmps) {
                for (const d of allDatesInData) {
                  if (d < cutoff30) continue;
                  const c = empDaily[emp]?.[d];
                  if (c) { sq30Num += c[numTab] || 0; sq30Den += c[denTab] || 0; }
                }
              }
              const sqMonthPct = sq30Den > 0 ? (sq30Num / sq30Den) * 100 : 0;

              return [
                <tr
                  key={sq.id}
                  onClick={() => toggle(sq.id)}
                  style={{ cursor: "pointer", borderTop: `2px solid ${clr}33` }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                >
                  <td style={{ ...tdStyle, fontWeight: 700, color: T.fg }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      {isOpen ? <ChevronDown size={12} style={{ color: clr }} /> : <ChevronRight size={12} style={{ color: clr }} />}
                      <span style={{ width: "7px", height: "7px", borderRadius: "9999px", backgroundColor: clr }} />
                      {sq.name}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: T.fg }}>TOTAL</td>
                  <td
                    style={{ ...tdStyle, fontWeight: 700, color: T.fg, backgroundColor: heatBg(sqMonthPct, allVals) }}
                    title={`${sq.name}: ${numTab.toUpperCase()} ÷ ${denTab.toUpperCase()} nos últimos 30 dias = ${sqMonthPct.toFixed(1)}% (${sq30Num} / ${sq30Den})`}
                  >{sqMonthPct.toFixed(1)}%</td>
                  {sqConv.map((v, i) => (
                    <td
                      key={i}
                      style={{
                        ...tdStyle,
                        fontWeight: 600,
                        color: v === 0 ? T.cinza300 : T.cardFg,
                        backgroundColor: heatBg(v, allVals) || cellBg(i),
                        borderLeft: weekStarts.has(i) ? `2px solid ${T.cinza200}` : undefined,
                      }}
                      title={`${parsedDates[i]?.date} · ${sq.name}\n${RATIO_LABELS[selectedRatio]}: ${v.toFixed(1)}%\nRolling 90 dias até esta data`}
                      onMouseEnter={() => setHCol(i)}
                      onMouseLeave={() => setHCol(null)}
                    >
                      {v.toFixed(1)}
                    </td>
                  ))}
                </tr>,
                ...(isOpen ? sqEmps.map((emp, ri) => {
                  const empConv = getEmpDailyConv(emp);
                  // 30d conversion for this emp
                  let e30Num = 0, e30Den = 0;
                  for (const d of allDatesInData) {
                    if (d < cutoff30) continue;
                    const c = empDaily[emp]?.[d];
                    if (c) { e30Num += c[numTab] || 0; e30Den += c[denTab] || 0; }
                  }
                  const eMonthPct = e30Den > 0 ? (e30Num / e30Den) * 100 : 0;
                  return (
                    <tr
                      key={`${sq.id}-${ri}`}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                    >
                      <td style={tdStyle} />
                      <td style={{ ...tdStyle, paddingLeft: "28px", color: T.fg, fontWeight: 500 }}>{emp}</td>
                      <td
                        style={{ ...tdStyle, fontWeight: 600, color: T.fg, backgroundColor: heatBg(eMonthPct, allVals) }}
                        title={`${emp}: ${numTab.toUpperCase()} ÷ ${denTab.toUpperCase()} nos últimos 30 dias = ${eMonthPct.toFixed(1)}% (${e30Num} / ${e30Den})`}
                      >
                        {eMonthPct.toFixed(1)}%
                      </td>
                      {empConv.map((v, i) => (
                        <td
                          key={i}
                          style={{
                            ...tdStyle,
                            color: v === 0 ? T.cinza300 : T.cardFg,
                            backgroundColor: heatBg(v, allVals) || cellBg(i),
                            borderLeft: weekStarts.has(i) ? `2px solid ${T.cinza200}` : undefined,
                          }}
                          title={`${parsedDates[i]?.date} · ${emp}\n${RATIO_LABELS[selectedRatio]}: ${v.toFixed(1)}%\nRolling 90 dias até esta data`}
                          onMouseEnter={() => setHCol(i)}
                          onMouseLeave={() => setHCol(null)}
                        >
                          {v.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  );
                }) : []),
              ];
            })}
            {/* TOTAL GERAL row */}
            {(() => {
              const globalConv = getSquadDailyConv(0);
              // Global 30d
              const now30g = new Date();
              now30g.setDate(now30g.getDate() - 30);
              const cutoff30g = now30g.toISOString().substring(0, 10);
              let g30Num = 0, g30Den = 0;
              for (const emp of Object.keys(empDaily)) {
                for (const d of allDatesInData) {
                  if (d < cutoff30g) continue;
                  const c = empDaily[emp]?.[d];
                  if (c) { g30Num += c[numTab] || 0; g30Den += c[denTab] || 0; }
                }
              }
              const globalMonthPct = g30Den > 0 ? (g30Num / g30Den) * 100 : 0;
              return (
                <tr style={{ backgroundColor: T.fg }}>
                  <td colSpan={2} style={{ ...tdStyle, fontWeight: 700, color: T.primaryFg, borderBottom: "none" }}>TOTAL GERAL</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: T.primaryFg, borderBottom: "none" }}>{globalMonthPct.toFixed(1)}%</td>
                  {globalConv.map((v, i) => (
                    <td
                      key={i}
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        color: T.primaryFg,
                        borderBottom: "none",
                        borderLeft: weekStarts.has(i) ? "2px solid rgba(255,255,255,0.12)" : undefined,
                      }}
                    >
                      {v.toFixed(1)}
                    </td>
                  ))}
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniTrend({ diff, direction, label }: { diff: number; direction: "better" | "worse" | "neutral"; label: string }) {
  const color = direction === "better" ? T.verde600 : direction === "worse" ? T.destructive : T.cinza400;
  return (
    <span style={{ fontSize: "9px", fontWeight: 500, color }}>
      {diff > 0 ? "+" : ""}{diff.toFixed(1)}pp {label}
    </span>
  );
}

export function ConversoesView({ data, loading, daysBack, onDaysChange, moduleId }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [selectedRatio, setSelectedRatio] = useState<RatioKey>("opp_won");
  const isSZS = moduleId === "szs";
  const isMKTP = moduleId === "mktp";

  if (loading && !data) return null;
  if (!data) return null;

  const { current, history } = data;

  // Module-specific config
  const groupOptions = isSZS ? SZS_SQUAD_OPTIONS : SQUAD_OPTIONS.slice(0, isMKTP ? 1 : undefined);
  const groupColors = isSZS ? SZS_SQUAD_COLORS : SQUAD_COLORS;
  const groupLabel = "Squad";
  const empLabel = isSZS ? "Cidade" : "Empreendimento";

  // Build squad defs from empDaily keys grouped by canal/squad
  const squadDefs = isSZS
    ? SZS_SQUAD_OPTIONS.filter(o => o.id !== 0).map(o => ({
        id: o.id,
        name: o.label,
        empreendimentos: Object.keys(data.empDaily || {}).filter(emp => {
          // For SZS, empDaily is keyed by canal_group name
          return emp === o.label;
        }),
      }))
    : isMKTP
    ? [{ id: 0, name: "Global", empreendimentos: Object.keys(data.empDaily || {}) }]
    : SQUADS.map(sq => ({ id: sq.id, name: sq.name, empreendimentos: [...sq.empreendimentos] }));

  // Get snapshot for each squad/canal
  const getSnapshot = (sqId: number): RatioSnapshot => {
    if (sqId === 0) return current.global;
    const sq = current.squads.find(s => s.squad_id === sqId);
    return sq || { date: "", squad_id: sqId, ratios: { mql_sql: 0, sql_opp: 0, opp_won: 0 }, counts_90d: { mql: 0, sql: 0, opp: 0, won: 0 } };
  };

  return (
    <div style={{ marginTop: "24px" }}>
      {/* Section header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          marginBottom: expanded ? "16px" : 0,
          padding: "8px 0",
        }}
      >
        {expanded ? <ChevronDown size={16} color={T.cinza600} /> : <ChevronRight size={16} color={T.cinza600} />}
        <span style={{ fontSize: "14px", fontWeight: 600, color: T.cardFg }}>Histórico de Conversões</span>
        <span style={{ fontSize: "11px", color: T.cinza400, fontWeight: 400 }}>
          Evolução das taxas de conversão {isMKTP ? "global" : "por squad"} (janela 90 dias)
        </span>
      </div>

      {!expanded ? null : (
        <>
          {/* Daily conversion heatmap with ratio selector */}
          {data.empDaily && data.dates && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "3px", backgroundColor: T.bg, borderRadius: "8px", padding: "2px", border: `1px solid ${T.border}` }}>
                  {RATIO_KEYS.map(key => (
                    <button
                      key={key}
                      onClick={() => setSelectedRatio(key)}
                      style={{
                        padding: "5px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 500,
                        backgroundColor: selectedRatio === key ? LINE_COLORS[key] : "transparent",
                        color: selectedRatio === key ? "#FFF" : T.mutedFg,
                      }}
                    >
                      {RATIO_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>
              <DailyConversionHeatmap
                empDaily={data.empDaily}
                dates={data.dates}
                selectedRatio={selectedRatio}
                history={history}
                getSnapshot={getSnapshot}
                squadDefs={squadDefs}
                squadColors={groupColors}
                empLabel={empLabel}
              />
            </>
          )}

          {/* Chart */}
          <div style={{
            backgroundColor: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: "12px",
            padding: "16px 20px",
            boxShadow: T.elevSm,
            marginTop: "16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
              {/* Period selector */}
              <div style={{ display: "flex", gap: "3px", backgroundColor: T.bg, borderRadius: "8px", padding: "2px", border: `1px solid ${T.border}` }}>
                {PERIODS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => onDaysChange(p.days)}
                    style={{
                      padding: "4px 14px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 500,
                      backgroundColor: daysBack === p.days ? T.fg : "transparent",
                      color: daysBack === p.days ? "#FFF" : T.mutedFg,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Ratio selector */}
              <div style={{ display: "flex", gap: "3px", backgroundColor: T.bg, borderRadius: "8px", padding: "2px", border: `1px solid ${T.border}` }}>
                {RATIO_KEYS.map(key => (
                  <button
                    key={key}
                    onClick={() => setSelectedRatio(key)}
                    style={{
                      padding: "4px 14px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 500,
                      backgroundColor: selectedRatio === key ? LINE_COLORS[key] : "transparent",
                      color: selectedRatio === key ? "#FFF" : T.mutedFg,
                    }}
                  >
                    {RATIO_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "8px" }}>
              {groupOptions.map(sq => {
                const color = sq.id === 0 ? T.cinza600 : groupColors[sq.id];
                return (
                  <div key={sq.id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{
                      width: "16px",
                      height: "3px",
                      backgroundColor: color,
                      borderRadius: "2px",
                      display: "inline-block",
                      ...(sq.id === 0 ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 4px, transparent 4px, transparent 7px)`, backgroundColor: "transparent" } : {}),
                    }} />
                    <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600 }}>{sq.label}</span>
                  </div>
                );
              })}
            </div>

            <RatioChart history={history} selectedRatio={selectedRatio} period={daysBack} squadIds={groupOptions.map(o => o.id)} squadColors={groupColors} />
          </div>

          {/* Trend summary badges */}
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {groupOptions.filter(o => o.id !== 0).map(({ id: sqId, label: sqLabel }) => {
              return RATIO_KEYS.map(key => {
                const t30 = getTrend(history, sqId, key, 30);
                if (!t30 || t30.direction === "neutral") return null;
                const isBetter = t30.direction === "better";
                const color = groupColors[sqId] || T.cinza600;
                return (
                  <div key={`${sqId}-${key}`} style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: isBetter ? T.verde600 : T.destructive,
                    backgroundColor: isBetter ? T.verde50 : T.vermelho50,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${isBetter ? T.verde600 : T.destructive}22`,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "9999px", backgroundColor: color, display: "inline-block" }} />
                    {sqLabel} {RATIO_LABELS[key]}: {isBetter ? "+" : ""}{t30.diff.toFixed(1)}pp
                  </div>
                );
              });
            })}
          </div>
        </>
      )}
    </div>
  );
}
