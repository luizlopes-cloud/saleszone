"use client";

import React, { useState, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { ModuleConfig } from "@/lib/modules";
import type { PerformanceData, PerformanceEmpBreakdown, PerformanceEmpRow } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: PerformanceData | null;
  loading: boolean;
  daysBack: number;
  onDaysChange: (d: number) => void;
  moduleConfig: ModuleConfig;
  lastUpdated?: Date | null;
}

const PERIOD_OPTIONS = [
  { label: "30d", value: 30 },
  { label: "60d", value: 60 },
  { label: "90d", value: 90 },
  { label: "180d", value: 180 },
  { label: "12m", value: 365 },
  { label: "Tudo", value: -1 },
];

function pctColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return "#16a34a";
  if (value >= thresholds[0]) return "#d97706";
  return "#dc2626";
}

function pctBg(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return "#dcfce7";
  if (value >= thresholds[0]) return "#fef3c7";
  return "#fee2e2";
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min}` : `${h}h`;
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  backgroundColor: "#f8f8fa",
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

const subRowStyle: React.CSSProperties = {
  ...tdStyle,
  fontSize: "12px",
  color: T.cinza700,
  backgroundColor: T.cinza50,
};

function RateBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "10px",
        fontSize: "12px",
        fontWeight: 700,
        backgroundColor: pctBg(value, thresholds),
        color: pctColor(value, thresholds),
      }}
    >
      {value}%
    </span>
  );
}

function SummaryPill({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div
      style={{
        backgroundColor: bg,
        borderRadius: "12px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        border: `1px solid ${color}22`,
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span style={{ fontSize: "22px", fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

type SortDir = "asc" | "desc";

function SortTh({ label, col, sortKey, sortDir, onSort, align = "center", minW }: {
  label: string; col: string; sortKey: string; sortDir: SortDir;
  onSort: (k: string) => void; align?: "left" | "center" | "right"; minW?: number;
}) {
  const active = sortKey === col;
  const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      style={{ ...thStyle, textAlign: align, minWidth: minW, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(col)}
    >
      {label}{arrow}
    </th>
  );
}

function ExpandChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={12}
      style={{
        transition: "transform 0.15s",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        color: T.cinza400,
        flexShrink: 0,
      }}
    />
  );
}

function PeriodFilter({ daysBack, onDaysChange }: { daysBack: number; onDaysChange: (d: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          gap: "2px",
          backgroundColor: T.cinza50,
          borderRadius: "9999px",
          padding: "3px",
          border: `1px solid ${T.border}`,
        }}
      >
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onDaysChange(opt.value)}
            style={{
              padding: "5px 14px",
              borderRadius: "9999px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
              transition: "all 0.15s",
              letterSpacing: "0.02em",
              backgroundColor: daysBack === opt.value ? T.fg : "transparent",
              color: daysBack === opt.value ? "#FFF" : T.cinza600,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCards({ grandTotals }: { grandTotals: PerformanceData["grandTotals"] }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap", alignItems: "stretch" }}>
      <SummaryPill label="MQL" value={grandTotals.mql.toLocaleString("pt-BR")} color={T.azul600} bg={T.azul50} />
      <SummaryPill label="SQL" value={grandTotals.sql.toLocaleString("pt-BR")} color={T.roxo600} bg="#f5f0ff" />
      <SummaryPill label="OPP" value={grandTotals.opp.toLocaleString("pt-BR")} color={T.laranja500} bg="#fff7ed" />
      <SummaryPill label="WON" value={grandTotals.won.toLocaleString("pt-BR")} color={T.verde600} bg={T.verde50} />
      <SummaryPill
        label="MQL→SQL"
        value={`${grandTotals.mqlToSql}%`}
        color={pctColor(grandTotals.mqlToSql, [15, 25])}
        bg={pctBg(grandTotals.mqlToSql, [15, 25])}
      />
      <SummaryPill
        label="SQL→OPP"
        value={`${grandTotals.sqlToOpp}%`}
        color={pctColor(grandTotals.sqlToOpp, [30, 50])}
        bg={pctBg(grandTotals.sqlToOpp, [30, 50])}
      />
      <SummaryPill
        label="OPP→WON"
        value={`${grandTotals.oppToWon}%`}
        color={pctColor(grandTotals.oppToWon, [15, 25])}
        bg={pctBg(grandTotals.oppToWon, [15, 25])}
      />
      <SummaryPill
        label="MQL→WON"
        value={`${grandTotals.mqlToWon}%`}
        color={pctColor(grandTotals.mqlToWon, [3, 8])}
        bg={pctBg(grandTotals.mqlToWon, [3, 8])}
      />
    </div>
  );
}

// Emp sub-rows for closers table
function CloserEmpRows({ byEmp, colsBefore }: { byEmp: PerformanceEmpBreakdown[]; colsBefore: number }) {
  return (
    <>
      {byEmp.map((e) => (
        <tr key={e.emp}>
          <td colSpan={colsBefore} style={{ ...subRowStyle, paddingLeft: "36px", fontStyle: "italic" }}>{e.emp}</td>
          <td style={{ ...subRowStyle, textAlign: "center" }}>{e.mql}</td>
          <td style={{ ...subRowStyle, textAlign: "center" }}>{e.sql}</td>
          <td style={{ ...subRowStyle, textAlign: "center" }}>{e.opp}</td>
          <td style={{ ...subRowStyle, textAlign: "center", fontWeight: 600, color: T.verde600 }}>{e.won}</td>
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.mqlToSql} thresholds={[15, 25]} /></td>
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.sqlToOpp} thresholds={[30, 50]} /></td>
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.oppToWon} thresholds={[15, 25]} /></td>
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.mqlToWon} thresholds={[3, 8]} /></td>
        </tr>
      ))}
    </>
  );
}

// Emp sub-rows for presellers table (13 columns)
function PresellerEmpRows({ byEmp }: { byEmp: PerformanceEmpBreakdown[] }) {
  return (
    <>
      {byEmp.map((e) => (
        <tr key={e.emp}>
          {/* Name spans: name + papel + squad = 3 cols */}
          <td colSpan={3} style={{ ...subRowStyle, paddingLeft: "36px", fontStyle: "italic" }}>{e.emp}</td>
          {/* Recebidos = mql for this emp */}
          <td style={{ ...subRowStyle, textAlign: "center" }}>{e.mql}</td>
          {/* SQL, OPP, WON */}
          <td style={{ ...subRowStyle, textAlign: "center" }}>{e.sql}</td>
          <td style={{ ...subRowStyle, textAlign: "center" }}>{e.opp}</td>
          <td style={{ ...subRowStyle, textAlign: "center", fontWeight: 600, color: T.verde600 }}>{e.won}</td>
          {/* Rates */}
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.mqlToSql} thresholds={[15, 25]} /></td>
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.sqlToOpp} thresholds={[30, 50]} /></td>
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.oppToWon} thresholds={[15, 25]} /></td>
          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.mqlToWon} thresholds={[3, 8]} /></td>
          <td style={{ ...subRowStyle, textAlign: "center", backgroundColor: "#FFFBF5", color: T.cinza400 }}>—</td>
          <td style={{ ...subRowStyle, textAlign: "center", backgroundColor: "#FFFBF5", color: T.cinza400 }}>—</td>
          <td style={{ ...subRowStyle, textAlign: "center", backgroundColor: "#FFFBF5", color: T.cinza400 }}>—</td>
          <td style={{ ...subRowStyle, textAlign: "center", backgroundColor: "#FFFBF5", color: T.cinza400 }}>—</td>
          <td style={{ ...subRowStyle, textAlign: "center", backgroundColor: "#FFFBF5", color: T.cinza400 }}>—</td>
        </tr>
      ))}
    </>
  );
}

// =============================================
// PERFORMANCE PRÉ-VENDAS (MIA + Pré-Vendedores)
// =============================================
export function PerformancePreVendasView({ data, loading, daysBack, onDaysChange, moduleConfig, lastUpdated }: Props) {
  const isSZS = moduleConfig?.id === "szs";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading && !data) {
    return <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>Carregando dados de performance pré-vendas...</div>;
  }
  if (!data) {
    return <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>Nenhum dado de performance disponível.</div>;
  }

  const { grandTotals, allPresellers, squads } = data;

  return (
    <>
      <PeriodFilter daysBack={daysBack} onDaysChange={onDaysChange} />
      <SummaryCards grandTotals={grandTotals} />

      {/* PRÉ-VENDEDORES + MIA */}
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Pré-Vendedores &amp; MIA
      </h3>
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 160 }}>Nome</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 50 }}>Papel</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 60 }}>{"Squad"}</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Recebidos</th>
              <th style={{ ...thStyle, textAlign: "center" }}>→SQL</th>
              <th style={{ ...thStyle, textAlign: "center" }}>→OPP</th>
              <th style={{ ...thStyle, textAlign: "center" }}>→WON</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Receb→SQL</th>
              <th style={{ ...thStyle, textAlign: "center" }}>SQL→OPP</th>
              <th style={{ ...thStyle, textAlign: "center" }}>OPP→WON</th>
              <th style={{ ...thStyle, textAlign: "center" }}>MQL→WON</th>
              <th style={{ ...thStyle, textAlign: "center", backgroundColor: "#FFF7ED", borderBottom: `2px solid ${T.laranja500}` }}>Ligações</th>
              <th style={{ ...thStyle, textAlign: "center", backgroundColor: "#FFF7ED", borderBottom: `2px solid ${T.laranja500}` }}>Mensagens</th>
              <th style={{ ...thStyle, textAlign: "center", backgroundColor: "#FFF7ED", borderBottom: `2px solid ${T.laranja500}` }}>Reuniões</th>
              <th style={{ ...thStyle, textAlign: "center", backgroundColor: "#FFF7ED", borderBottom: `2px solid ${T.laranja500}` }}>Tempo Médio</th>
              <th style={{ ...thStyle, textAlign: "center", backgroundColor: "#FFF7ED", borderBottom: `2px solid ${T.laranja500}` }}>Mediana</th>
            </tr>
          </thead>
          <tbody>
            {allPresellers.map((p) => {
              const rowKey = `${p.name}-${p.squadId}-${p.role}`;
              const sqColor = SQUAD_COLORS[p.squadId] || T.azul600;
              const sqName = moduleConfig.squads.find((s) => s.id === p.squadId)?.name || "";
              const isMia = p.role === "marketing";
              const recebToSql = p.dealsReceived > 0 ? Math.round((p.sql / p.dealsReceived) * 1000) / 10 : 0;
              const isOpen = expanded.has(rowKey);
              const hasEmp = p.byEmp && p.byEmp.length > 0;
              return (
                <React.Fragment key={rowKey}>
                  <tr
                    onClick={() => hasEmp && toggleExpand(rowKey)}
                    style={{ cursor: hasEmp ? "pointer" : undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f8fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                  >
                    <td style={{ ...tdStyle, display: "flex", alignItems: "center", gap: "6px" }}>
                      {hasEmp && <ExpandChevron open={isOpen} />}
                      {!hasEmp && <span style={{ width: 12 }} />}
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sqColor, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: "10px", color: T.cinza600 }}>{isMia ? "MIA" : "PV"}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: "11px", color: T.cinza600 }}>{sqName}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{p.dealsReceived}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{p.sql}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{p.opp}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: T.verde600 }}>{p.won}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={recebToSql} thresholds={[15, 25]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={p.sqlToOpp} thresholds={[30, 50]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={p.oppToWon} thresholds={[15, 25]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={p.mqlToWon} thresholds={[3, 8]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#FFFBF5", fontWeight: 600, color: isMia ? T.cinza400 : T.fg }}>{isMia ? "—" : (p.actLigacoes || 0).toLocaleString("pt-BR")}</td>
                    <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#FFFBF5", fontWeight: 600, color: isMia ? T.cinza400 : T.fg }}>{isMia ? "—" : (p.actMensagens || 0).toLocaleString("pt-BR")}</td>
                    <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#FFFBF5", fontWeight: 600, color: isMia ? T.cinza400 : T.fg }}>{isMia ? "—" : (p.actReunioes || 0).toLocaleString("pt-BR")}</td>
                    <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#FFFBF5", fontWeight: 600, color: isMia ? T.cinza400 : T.laranja500 }}>{isMia ? "—" : formatMinutes(p.avgResponseMin)}</td>
                    <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#FFFBF5", fontWeight: 600, color: isMia ? T.cinza400 : T.laranja500 }}>{isMia ? "—" : formatMinutes(p.medianResponseMin)}</td>
                  </tr>
                  {isOpen && hasEmp && <PresellerEmpRows byEmp={p.byEmp} />}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* VISÃO POR SQUAD — PV + MIA */}
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Visão por {"Squad"}
      </h3>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {squads.map((sq) => {
          const sqColor = SQUAD_COLORS[sq.id] || T.azul600;
          return (
            <div
              key={sq.id}
              style={{
                flex: "1 1 360px",
                backgroundColor: T.card,
                borderRadius: "12px",
                border: `1px solid ${T.border}`,
                boxShadow: T.elevSm,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  backgroundColor: sqColor,
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "14px" }}>{sq.name}</span>
                <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                  <span>MQL {sq.totals.mql}</span>
                  <span>SQL {sq.totals.sql}</span>
                  <span>OPP {sq.totals.opp}</span>
                  <span style={{ fontWeight: 700 }}>WON {sq.totals.won}</span>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left", fontSize: "9px", padding: "6px 10px" }}>Pessoa</th>
                    <th style={{ ...thStyle, textAlign: "center", fontSize: "9px", padding: "6px 10px" }}>Papel</th>
                    <th style={{ ...thStyle, textAlign: "center", fontSize: "9px", padding: "6px 10px" }}>MQL→SQL</th>
                    <th style={{ ...thStyle, textAlign: "center", fontSize: "9px", padding: "6px 10px" }}>SQL→OPP</th>
                    <th style={{ ...thStyle, textAlign: "center", fontSize: "9px", padding: "6px 10px" }}>OPP→WON</th>
                    <th style={{ ...thStyle, textAlign: "center", fontSize: "9px", padding: "6px 10px" }}>MQL→WON</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...tdStyle, fontSize: "12px", fontWeight: 600 }}>{sq.marketing.name}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: "10px", color: T.cinza600 }}>MIA</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.marketing.mqlToSql} thresholds={[15, 25]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.marketing.sqlToOpp} thresholds={[30, 50]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.marketing.oppToWon} thresholds={[15, 25]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.marketing.mqlToWon} thresholds={[3, 8]} /></td>
                  </tr>
                  <tr>
                    <td style={{ ...tdStyle, fontSize: "12px", fontWeight: 600 }}>{sq.preseller.name}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: "10px", color: T.cinza600 }}>PV</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.preseller.mqlToSql} thresholds={[15, 25]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.preseller.sqlToOpp} thresholds={[30, 50]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.preseller.oppToWon} thresholds={[15, 25]} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={sq.preseller.mqlToWon} thresholds={[3, 8]} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </>
  );
}

// =============================================
// SVG Line Chart — OPP→WON rolling window
// =============================================
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

interface ChartLine {
  name: string;
  color: string;
  points: { month: string; oppToWon: number }[];
}

function closersToLines(closers: PerformanceData["allClosers"]): ChartLine[] {
  return closers
    .filter((c) => c.timeSeries && c.timeSeries.length > 0)
    .map((c) => ({ name: c.name, color: SQUAD_COLORS[c.squadId] || T.azul600, points: c.timeSeries! }));
}

function empsToLines(emps: PerformanceEmpRow[]): ChartLine[] {
  // Use squad color per emp; cycle through distinct colors for variety
  const EMP_COLORS = [T.azul600, T.roxo600, T.teal600, T.laranja500, T.verde600, "#e11d48", "#7c3aed", "#0891b2", "#ca8a04", "#6366f1", "#059669"];
  return emps
    .filter((e) => e.timeSeries && e.timeSeries.length > 0)
    .map((e, i) => ({ name: e.emp, color: SQUAD_COLORS[e.squadId] || EMP_COLORS[i % EMP_COLORS.length], points: e.timeSeries! }));
}

function medianOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function OppToWonChart({ lines, title, maxMonths }: { lines: ChartLine[]; title?: string; maxMonths?: number }) {
  const W = 800, H = 320, PAD = { top: 20, right: 160, bottom: 40, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Trim points based on maxMonths
  const series = useMemo(() => {
    if (!maxMonths || maxMonths <= 0) return lines;
    return lines.map((s) => ({ ...s, points: s.points.slice(-maxMonths) }));
  }, [lines, maxMonths]);

  if (series.length === 0) return null;

  const showMedian = series.length >= 2;

  // Compute median line per month index (only when multiple series)
  const medianLine = useMemo(() => {
    if (!showMedian) return [];
    const maxLen = Math.max(...series.map((s) => s.points.length));
    const pts: { index: number; month: string; value: number }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const vals: number[] = [];
      let monthLabel = "";
      for (const s of series) {
        if (i < s.points.length) {
          vals.push(s.points[i].oppToWon);
          monthLabel = s.points[i].month;
        }
      }
      if (vals.length >= 2) {
        pts.push({ index: i, month: monthLabel, value: Math.round(medianOf(vals) * 10) / 10 });
      }
    }
    return pts;
  }, [series, showMedian]);

  const allValues = [
    ...series.flatMap((s) => s.points.map((p) => p.oppToWon)),
    ...medianLine.map((p) => p.value),
  ];
  const maxY = Math.max(Math.ceil((Math.max(...allValues) + 5) / 10) * 10, 30);
  const months = series[0].points.map((p) => p.month);

  const x = (i: number) => PAD.left + (i / Math.max(months.length - 1, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += 10) yTicks.push(v);

  // Spread end labels vertically to avoid overlap
  const endLabels = series
    .filter((s) => s.points.length > 0)
    .map((s) => ({ name: s.name, color: s.color, yVal: s.points[s.points.length - 1].oppToWon }))
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
        marginBottom: "16px",
      }}
    >
      {title && (
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza700, marginBottom: "8px" }}>{title}</div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", maxHeight: "360px" }}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={y(v)} x2={PAD.left + plotW} y2={y(v)} stroke={T.cinza200} strokeWidth={0.5} />
            <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill={T.cinza600}>{v}%</text>
          </g>
        ))}
        {months.map((m, i) => {
          const [yy, mm] = m.split("-");
          const label = MONTHS_SHORT[parseInt(mm, 10) - 1];
          const showYear = i === 0 || mm === "01";
          return (
            <g key={m}>
              <text x={x(i)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill={T.cinza600}>{label}</text>
              {showYear && <text x={x(i)} y={H - PAD.bottom + 28} textAnchor="middle" fontSize="9" fill={T.cinza400}>{yy}</text>}
            </g>
          );
        })}
        {/* Median baseline */}
        {showMedian && medianLine.length >= 2 && (() => {
          const medPathD = medianLine.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.index)} ${y(p.value)}`).join(" ");
          const lastMed = medianLine[medianLine.length - 1];
          return (
            <g>
              <path d={medPathD} fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="8 4" />
              <text
                x={x(lastMed.index) + 8}
                y={y(lastMed.value) + 4}
                fontSize="11"
                fontWeight={700}
                fill="#f59e0b"
              >
                Mediana {lastMed.value}%
              </text>
            </g>
          );
        })()}
        {series.map((s) => {
          if (s.points.length === 0) return null;
          const pathD = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.oppToWon)}`).join(" ");
          const lastPt = s.points[s.points.length - 1];
          return (
            <g key={s.name}>
              <path d={pathD} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p.oppToWon)} r={3} fill={s.color} stroke="#FFF" strokeWidth={1.5} />
              ))}
              <text
                x={x(s.points.length - 1) + 8}
                y={labelPositions[s.name]}
                fontSize="11"
                fontWeight={600}
                fill={s.color}
              >
                {s.name.split(" ")[0]} {lastPt.oppToWon}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// =============================================
// PERFORMANCE VENDAS (Closers)
// =============================================
export function PerformanceVendasView({ data, loading, daysBack, onDaysChange, moduleConfig, lastUpdated }: Props) {
  const isSZS = moduleConfig?.id === "szs";
  type CloserSortKey = "name" | "opp" | "won" | "oppToWon";
  type ChartView = "consolidado" | "todos" | "squad";
  const [closerSort, setCloserSort] = useState<CloserSortKey>("oppToWon");
  const [closerDir, setCloserDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [chartView, setChartView] = useState<ChartView>("consolidado");

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCloserSort = (key: string) => {
    const k = key as CloserSortKey;
    if (closerSort === k) setCloserDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setCloserSort(k); setCloserDir("desc"); }
  };

  const sortedClosers = useMemo(() => {
    if (!data) return [];
    return [...data.allClosers].sort((a, b) => {
      const va = a[closerSort];
      const vb = b[closerSort];
      if (typeof va === "string" && typeof vb === "string") {
        return closerDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      const na = va as number;
      const nb = vb as number;
      return closerDir === "asc" ? na - nb : nb - na;
    });
  }, [data, closerSort, closerDir]);

  if (loading && !data) {
    return <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>Carregando dados de performance vendas...</div>;
  }
  if (!data) {
    return <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>Nenhum dado de performance disponível.</div>;
  }

  const { grandTotals, squads } = data;

  return (
    <>
      <PeriodFilter daysBack={daysBack} onDaysChange={onDaysChange} />
      <SummaryCards grandTotals={grandTotals} />

      {/* GRÁFICO OPP→WON */}
      {(() => {
        const chartMonths = daysBack > 0 ? Math.max(Math.round(daysBack / 30), 1) : 12;
        const chartLabel = daysBack > 0 ? (daysBack >= 365 ? `${Math.round(daysBack / 30)}m` : `${daysBack}d`) : "Tudo";
        return (<>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          OPP→WON — Média Flutuante {chartLabel}
        </h3>
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
          {(["consolidado", "todos", "squad"] as const).map((v) => {
            const labels: Record<string, string> = { consolidado: "Consolidado", todos: "Por Vendedor", squad: isSZS ? "Por Canal" : "Por Squad" };
            return (
              <button
                key={v}
                onClick={() => setChartView(v)}
                style={{
                  padding: "3px 12px",
                  borderRadius: "9999px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  backgroundColor: chartView === v ? T.fg : "transparent",
                  color: chartView === v ? "#FFF" : T.cinza600,
                }}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>
      </div>
      {chartView === "consolidado" && data.consolidatedTimeSeries && (
        <OppToWonChart lines={[{ name: "Todos Vendedores", color: T.azul600, points: data.consolidatedTimeSeries }]} maxMonths={chartMonths} />
      )}
      {chartView === "todos" && <OppToWonChart lines={closersToLines(data.allClosers)} maxMonths={chartMonths} />}
      {chartView === "squad" && squads.map((sq) => (
        <OppToWonChart key={sq.id} lines={closersToLines(sq.closers)} title={sq.name} maxMonths={chartMonths} />
      ))}
        </>); })()}

      {/* VENDEDORES (Closers) */}
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Vendedores
      </h3>
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortTh label="Nome" col="name" align="left" minW={160} sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
              <th style={{ ...thStyle, textAlign: "center", minWidth: 60 }}>{"Squad"}</th>
              <SortTh label="OPP" col="opp" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
              <SortTh label="WON" col="won" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
              <SortTh label="OPP→WON" col="oppToWon" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
            </tr>
          </thead>
          <tbody>
            {sortedClosers.map((c) => {
              const sqColor = SQUAD_COLORS[c.squadId] || T.azul600;
              const sqName = moduleConfig.squads.find((s) => s.id === c.squadId)?.name || "";
              const isOpen = expanded.has(c.name);
              const hasEmp = c.byEmp && c.byEmp.length > 0;
              return (
                <React.Fragment key={c.name}>
                  <tr
                    onClick={() => hasEmp && toggleExpand(c.name)}
                    style={{ cursor: hasEmp ? "pointer" : undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f8fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                  >
                    <td style={{ ...tdStyle, display: "flex", alignItems: "center", gap: "6px" }}>
                      {hasEmp && <ExpandChevron open={isOpen} />}
                      {!hasEmp && <span style={{ width: 12 }} />}
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sqColor, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: "11px", color: T.cinza600 }}>{sqName}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{c.opp}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: T.verde600 }}>{c.won}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={c.oppToWon} thresholds={[15, 25]} /></td>
                  </tr>
                  {isOpen && hasEmp && (
                    <>
                      {c.byEmp.map((e) => (
                        <tr key={e.emp}>
                          <td colSpan={2} style={{ ...subRowStyle, paddingLeft: "36px", fontStyle: "italic" }}>{e.emp}</td>
                          <td style={{ ...subRowStyle, textAlign: "center" }}>{e.opp}</td>
                          <td style={{ ...subRowStyle, textAlign: "center", fontWeight: 600, color: T.verde600 }}>{e.won}</td>
                          <td style={{ ...subRowStyle, textAlign: "center" }}><RateBadge value={e.oppToWon} thresholds={[15, 25]} /></td>
                        </tr>
                      ))}
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* VISÃO POR SQUAD — Closers */}
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Visão por {"Squad"}
      </h3>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {squads.map((sq) => {
          const sqColor = SQUAD_COLORS[sq.id] || T.azul600;
          return (
            <div
              key={sq.id}
              style={{
                flex: "1 1 360px",
                backgroundColor: T.card,
                borderRadius: "12px",
                border: `1px solid ${T.border}`,
                boxShadow: T.elevSm,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  backgroundColor: sqColor,
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "14px" }}>{sq.name}</span>
                <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                  <span>OPP {sq.totals.opp}</span>
                  <span style={{ fontWeight: 700 }}>WON {sq.totals.won}</span>
                  <span>OPP→WON {sq.totals.oppToWon}%</span>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left", fontSize: "9px", padding: "6px 10px" }}>Closer</th>
                    <th style={{ ...thStyle, textAlign: "center", fontSize: "9px", padding: "6px 10px" }}>OPP→WON</th>
                  </tr>
                </thead>
                <tbody>
                  {sq.closers.map((c) => (
                    <tr key={c.name}>
                      <td style={{ ...tdStyle, fontSize: "12px", fontWeight: 600 }}>{c.name}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={c.oppToWon} thresholds={[15, 25]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* EMPREENDIMENTOS — OPP→WON */}
      <EmpPerformanceSection emps={data.allEmps} squads={squads} daysBack={daysBack} consolidatedTimeSeries={data.consolidatedTimeSeries} maxMonths={daysBack > 0 ? Math.max(Math.round(daysBack / 30), 1) : 0} isSZS={isSZS} />
      <DataSourceFooter lastUpdated={lastUpdated} />
    </>
  );
}

// =============================================
// Empreendimento Performance Section
// =============================================
function EmpPerformanceSection({ emps, squads, daysBack, consolidatedTimeSeries, maxMonths, isSZS }: {
  emps: PerformanceEmpRow[];
  squads: PerformanceData["squads"];
  daysBack: number;
  consolidatedTimeSeries?: PerformanceData["consolidatedTimeSeries"];
  maxMonths?: number;
  isSZS?: boolean;
}) {
  type EmpChartView = "consolidado" | "todos" | "squad";
  type EmpSortKey = "emp" | "opp" | "won" | "oppToWon";
  const [empChartView, setEmpChartView] = useState<EmpChartView>("todos");
  const [empSort, setEmpSort] = useState<EmpSortKey>("oppToWon");
  const [empDir, setEmpDir] = useState<SortDir>("desc");

  const toggleEmpSort = (key: string) => {
    const k = key as EmpSortKey;
    if (empSort === k) setEmpDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setEmpSort(k); setEmpDir("desc"); }
  };

  const sortedEmps = useMemo(() => {
    return [...emps].sort((a, b) => {
      const va = a[empSort];
      const vb = b[empSort];
      if (typeof va === "string" && typeof vb === "string") {
        return empDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return empDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [emps, empSort, empDir]);

  return (
    <>
      {/* Chart */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", marginTop: "32px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          OPP→WON por {isSZS ? "Cidade" : "Empreendimento"} — Média Flutuante {daysBack > 0 ? (daysBack >= 365 ? `${Math.round(daysBack / 30)}m` : `${daysBack}d`) : "Tudo"}
        </h3>
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
          {(["consolidado", "todos", "squad"] as const).map((v) => {
            const labels: Record<string, string> = { consolidado: "Consolidado", todos: isSZS ? "Todas Cidades" : "Todos Emps", squad: isSZS ? "Por Canal" : "Por Squad" };
            return (
              <button
                key={v}
                onClick={() => setEmpChartView(v)}
                style={{
                  padding: "3px 12px",
                  borderRadius: "9999px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  backgroundColor: empChartView === v ? T.fg : "transparent",
                  color: empChartView === v ? "#FFF" : T.cinza600,
                }}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>
      </div>
      {empChartView === "consolidado" && consolidatedTimeSeries && (
        <OppToWonChart lines={[{ name: "Todos Emps", color: T.azul600, points: consolidatedTimeSeries }]} maxMonths={maxMonths} />
      )}
      {empChartView === "todos" && <OppToWonChart lines={empsToLines(emps)} maxMonths={maxMonths} />}
      {empChartView === "squad" && squads.map((sq) => {
        const sqEmps = emps.filter((e) => e.squadId === sq.id);
        if (sqEmps.length === 0) return null;
        return <OppToWonChart key={sq.id} lines={empsToLines(sqEmps)} title={sq.name} maxMonths={maxMonths} />;
      })}

      {/* Table */}
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {isSZS ? "Cidades" : "Empreendimentos"}
      </h3>
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortTh label={isSZS ? "Cidade" : "Empreendimento"} col="emp" align="left" minW={200} sortKey={empSort} sortDir={empDir} onSort={toggleEmpSort} />
              <th style={{ ...thStyle, textAlign: "center", minWidth: 60 }}>{"Squad"}</th>
              <SortTh label="OPP" col="opp" sortKey={empSort} sortDir={empDir} onSort={toggleEmpSort} />
              <SortTh label="WON" col="won" sortKey={empSort} sortDir={empDir} onSort={toggleEmpSort} />
              <SortTh label="OPP→WON" col="oppToWon" sortKey={empSort} sortDir={empDir} onSort={toggleEmpSort} />
            </tr>
          </thead>
          <tbody>
            {sortedEmps.map((e) => {
              const sqColor = SQUAD_COLORS[e.squadId] || T.cinza400;
              const sqName = squads.find((s) => s.id === e.squadId)?.name || "—";
              return (
                <tr
                  key={e.emp}
                  onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = "#f8f8fa")}
                  onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = "")}
                >
                  <td style={{ ...tdStyle, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sqColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{e.emp}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", fontSize: "11px", color: T.cinza600 }}>{sqName}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{e.opp}</td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: T.verde600 }}>{e.won}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><RateBadge value={e.oppToWon} thresholds={[15, 25]} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
