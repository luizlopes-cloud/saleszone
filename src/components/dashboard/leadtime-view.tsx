"use client";

import { useState } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { LeadtimeData, LeadtimeStageRow, LeadtimeDealRow } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: LeadtimeData | null;
  loading: boolean;
  daysBack: number;
  onDaysChange: (days: number) => void;
  lastUpdated?: Date | null;
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const PERIOD_OPTIONS = [
  { label: "30d", value: 30 },
  { label: "60d", value: 60 },
  { label: "90d", value: 90 },
  { label: "180d", value: 180 },
  { label: "12m", value: 365 },
];

const cardStyle = (accent?: string): React.CSSProperties => ({
  backgroundColor: "#FFF",
  border: `1px solid ${accent ? accent + "33" : T.border}`,
  borderRadius: "12px",
  padding: "16px 20px",
  flex: "1 1 0",
  minWidth: "140px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
});

const thStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: T.cinza600,
  textTransform: "uppercase",
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: `1px solid ${T.border}`,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: "13px",
  color: T.fg,
  padding: "8px 10px",
  borderBottom: `1px solid ${T.cinza100}`,
  fontVariantNumeric: "tabular-nums",
};

function daysColor(val: number, avg: number): string {
  if (avg === 0) return T.fg;
  if (val <= avg * 0.8) return "#15803D";
  if (val >= avg * 1.2) return "#E7000B";
  return T.fg;
}

export function LeadtimeView({ data, loading, daysBack, onDaysChange, lastUpdated }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando leadtime...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Sem dados de leadtime</p>
      </div>
    );
  }

  const stagesWithData = data.stages.filter((s) => s.wonDeals > 0 || s.openDeals > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header + Period Filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: 0 }}>
          Leadtime do Funil
        </h2>
        <div style={{ display: "flex", gap: "2px", backgroundColor: T.cinza50, borderRadius: "9999px", padding: "3px", border: `1px solid ${T.border}` }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDaysChange(opt.value)}
              style={{
                padding: "4px 12px",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 500,
                transition: "all 0.15s",
                letterSpacing: "0.02em",
                backgroundColor: daysBack === opt.value ? T.azul600 : "transparent",
                color: daysBack === opt.value ? "#FFF" : T.cinza600,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ ...cardStyle(), backgroundColor: T.fg, border: "none" }}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", marginBottom: "4px" }}>Leadtime Medio</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#FFF" }}>{fmt(data.avgCycleDays)}d</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Criacao a Venda</div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>Mediana</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: T.azul600 }}>{fmt(data.medianCycleDays)}d</div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>P90</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#92400E" }}>{fmt(data.p90CycleDays)}d</div>
        </div>
        <div style={cardStyle("#5EA500")}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>Deals Ganhos</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#15803D" }}>{data.totalWonDeals}</div>
        </div>
        <div style={cardStyle("#0055FF")}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>Deals Abertos</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: T.azul600 }}>{data.totalOpenDeals}</div>
        </div>
      </div>

      {/* Leadtime por Etapa */}
      <div style={{ backgroundColor: "#FFF", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>Leadtime por Etapa</div>
        <div style={{ fontSize: "11px", color: T.cinza600, marginBottom: "12px" }}>Tempo estimado por etapa (deals ganhos) + lead aberto mais antigo</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Etapa</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ordem</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Media (dias)</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Mediana</th>
                <th style={{ ...thStyle, textAlign: "right" }}>P90</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Deals Ganhos</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Abertos</th>
                <th style={thStyle}>Lead + Antigo</th>
              </tr>
            </thead>
            <tbody>
              {stagesWithData.map((s) => (
                <StageRow key={s.stageOrder} stage={s} globalAvg={data.avgCycleDays} />
              ))}
              <tr style={{ backgroundColor: T.cinza50 }}>
                <td style={{ ...tdStyle, fontWeight: 700 }} colSpan={2}>Total</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(data.avgCycleDays)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(data.medianCycleDays)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(data.p90CycleDays)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{data.totalWonDeals}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{data.totalOpenDeals}</td>
                <td style={tdStyle} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Leadtime por Closer */}
      <CloserSection byCloser={data.byCloser} globalAvg={data.avgCycleDays} />
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}

type DealFilter = "all" | "open";

function computeStats(deals: LeadtimeDealRow[]): { avg: number; median: number; count: number } {
  const days = deals.map((d) => d.cycleDays).filter((d) => d > 0);
  if (days.length === 0) return { avg: 0, median: 0, count: 0 };
  const sorted = [...days].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const average = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return { avg: Math.round(average * 10) / 10, median: Math.round(med * 10) / 10, count: days.length };
}

function CloserSection({ byCloser, globalAvg }: { byCloser: LeadtimeData["byCloser"]; globalAvg: number }) {
  const [expandedClosers, setExpandedClosers] = useState<Set<string>>(new Set());
  const [dealFilter, setDealFilter] = useState<DealFilter>("all");

  const toggleCloser = (name: string) => {
    setExpandedClosers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Compute global avg for the current filter (for color coding)
  const allFilteredDeals = byCloser.flatMap((c) =>
    dealFilter === "open" ? c.deals.filter((d) => d.status === "open") : c.deals,
  );
  const globalFilteredStats = computeStats(allFilteredDeals);

  return (
    <div style={{ backgroundColor: "#FFF", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase" }}>Leadtime por Closer</div>
          <div style={{ fontSize: "11px", color: T.cinza400, marginTop: "2px" }}>
            {dealFilter === "all" ? "Todos os deals (ganhos + abertos)" : "Somente deals abertos (idade desde criacao)"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "2px", backgroundColor: T.cinza50, borderRadius: "9999px", padding: "3px", border: `1px solid ${T.border}` }}>
          <button
            onClick={() => setDealFilter("all")}
            style={{
              padding: "4px 12px",
              borderRadius: "9999px",
              border: "none",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
              transition: "all 0.15s",
              letterSpacing: "0.02em",
              backgroundColor: dealFilter === "all" ? T.azul600 : "transparent",
              color: dealFilter === "all" ? "#FFF" : T.cinza600,
            }}
          >
            Todos
          </button>
          <button
            onClick={() => setDealFilter("open")}
            style={{
              padding: "4px 12px",
              borderRadius: "9999px",
              border: "none",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
              transition: "all 0.15s",
              letterSpacing: "0.02em",
              backgroundColor: dealFilter === "open" ? T.azul600 : "transparent",
              color: dealFilter === "open" ? "#FFF" : T.cinza600,
            }}
          >
            Abertos
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Closer</th>
              <th style={thStyle}>Squad</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Media (dias)</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Mediana</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Deals</th>
            </tr>
          </thead>
          <tbody>
            {byCloser.map((c) => (
              <CloserRow
                key={c.name}
                closer={c}
                globalFilteredAvg={globalFilteredStats.avg}
                expanded={expandedClosers.has(c.name)}
                onToggle={() => toggleCloser(c.name)}
                dealFilter={dealFilter}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CloserRow({
  closer,
  globalFilteredAvg,
  expanded,
  onToggle,
  dealFilter,
}: {
  closer: LeadtimeData["byCloser"][number];
  globalFilteredAvg: number;
  expanded: boolean;
  onToggle: () => void;
  dealFilter: DealFilter;
}) {
  const sqColor = SQUAD_COLORS[closer.squadId] || T.cinza600;
  const filteredDeals = dealFilter === "open"
    ? closer.deals.filter((d) => d.status === "open")
    : closer.deals;

  const stats = computeStats(filteredDeals);

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: "pointer", backgroundColor: expanded ? T.cinza50 : "transparent" }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = T.cinza50; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <td style={tdStyle}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: T.cinza400, fontSize: "10px" }}>{expanded ? "▼" : "▶"}</span>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: sqColor, display: "inline-block" }} />
            <span style={{ fontWeight: 600 }}>{closer.name}</span>
          </span>
        </td>
        <td style={{ ...tdStyle, color: T.cinza600 }}>{closer.squadId}</td>
        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: stats.count > 0 ? daysColor(stats.avg, globalFilteredAvg) : T.cinza400 }}>
          {stats.count > 0 ? fmt(stats.avg) : "-"}
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {stats.count > 0 ? fmt(stats.median) : "-"}
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>{stats.count}</td>
      </tr>
      {expanded && filteredDeals.length > 0 && (
        <tr>
          <td colSpan={5} style={{ padding: 0 }}>
            <DealTable deals={filteredDeals} />
          </td>
        </tr>
      )}
      {expanded && filteredDeals.length === 0 && (
        <tr>
          <td colSpan={5} style={{ ...tdStyle, paddingLeft: "36px", color: T.cinza400, fontSize: "12px" }}>
            Nenhum deal {dealFilter === "open" ? "aberto" : ""} encontrado
          </td>
        </tr>
      )}
    </>
  );
}

function DealTable({ deals }: { deals: LeadtimeDealRow[] }) {
  const dealThStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 600,
    color: T.cinza600,
    textTransform: "uppercase",
    padding: "6px 10px",
    textAlign: "left",
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: "nowrap",
    backgroundColor: T.azul50 + "66",
  };
  const dealTdStyle: React.CSSProperties = {
    fontSize: "12px",
    color: T.fg,
    padding: "6px 10px",
    borderBottom: `1px solid ${T.cinza100}`,
    fontVariantNumeric: "tabular-nums",
    backgroundColor: T.azul50 + "33",
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginLeft: "0" }}>
      <thead>
        <tr>
          <th style={{ ...dealThStyle, paddingLeft: "36px" }}>Deal</th>
          <th style={dealThStyle}>Empreendimento</th>
          <th style={dealThStyle}>Etapa</th>
          <th style={dealThStyle}>Status</th>
          <th style={{ ...dealThStyle, textAlign: "right" }}>Dias</th>
          <th style={dealThStyle}>Criacao</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((d) => (
          <tr key={d.deal_id}>
            <td style={{ ...dealTdStyle, paddingLeft: "36px" }}>
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: T.azul600, textDecoration: "none", fontWeight: 500 }}
                title={d.title}
              >
                {d.title.length > 40 ? d.title.substring(0, 40) + "..." : d.title}
              </a>
            </td>
            <td style={{ ...dealTdStyle, fontSize: "11px", color: T.cinza600 }}>
              {d.empreendimento}
            </td>
            <td style={{ ...dealTdStyle, fontSize: "11px", color: T.cinza600 }}>
              {d.stageName}
            </td>
            <td style={dealTdStyle}>
              <span style={{
                display: "inline-block",
                padding: "1px 7px",
                borderRadius: "9999px",
                fontSize: "10px",
                fontWeight: 600,
                backgroundColor: d.status === "won" ? "#f0fdf4" : "#eff6ff",
                color: d.status === "won" ? "#15803D" : T.azul600,
              }}>
                {d.status === "won" ? "Ganho" : "Aberto"}
              </span>
            </td>
            <td style={{
              ...dealTdStyle,
              textAlign: "right",
              fontWeight: 600,
              color: d.cycleDays >= 90 ? "#E7000B" : d.cycleDays >= 30 ? "#92400E" : "#15803D",
            }}>
              {fmt(d.cycleDays)}
            </td>
            <td style={{ ...dealTdStyle, fontSize: "11px", color: T.cinza600 }}>
              {d.add_time ? new Date(d.add_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StageRow({ stage, globalAvg }: { stage: LeadtimeStageRow; globalAvg: number }) {
  const stageAvg = globalAvg / 14; // rough per-stage average for color coding
  return (
    <tr>
      <td style={tdStyle}>{stage.stageName}</td>
      <td style={{ ...tdStyle, textAlign: "right", color: T.cinza600 }}>{stage.stageOrder}</td>
      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: daysColor(stage.avgDays, stageAvg) }}>
        {stage.wonDeals > 0 ? fmt(stage.avgDays) : "-"}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {stage.wonDeals > 0 ? fmt(stage.medianDays) : "-"}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {stage.wonDeals > 0 ? fmt(stage.p90Days) : "-"}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>{stage.wonDeals || "-"}</td>
      <td style={{ ...tdStyle, textAlign: "right" }}>{stage.openDeals || "-"}</td>
      <td style={tdStyle}>
        {stage.oldestOpen ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <a
              href={stage.oldestOpen.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: T.azul600, textDecoration: "none", fontWeight: 500 }}
              title={stage.oldestOpen.title}
            >
              {stage.oldestOpen.title.length > 30 ? stage.oldestOpen.title.substring(0, 30) + "..." : stage.oldestOpen.title}
            </a>
            <span style={{ color: T.cinza600 }}>({stage.oldestOpen.owner_name})</span>
            <span style={{
              padding: "1px 6px",
              borderRadius: "9999px",
              fontSize: "10px",
              fontWeight: 600,
              backgroundColor: stage.oldestOpen.ageDays >= 90 ? "#fee2e2" : stage.oldestOpen.ageDays >= 30 ? "#fef3c7" : "#f0fdf4",
              color: stage.oldestOpen.ageDays >= 90 ? "#E7000B" : stage.oldestOpen.ageDays >= 30 ? "#92400E" : "#15803D",
            }}>
              {stage.oldestOpen.ageDays}d
            </span>
          </span>
        ) : (
          <span style={{ color: T.cinza400 }}>-</span>
        )}
      </td>
    </tr>
  );
}
