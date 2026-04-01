"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { ModuleConfig } from "@/lib/modules";
import type { PlanejamentoData, PlanejamentoEmpRow, PlanejamentoMetrics, HistoricoAdRow, HistoricoCampanhasData } from "@/lib/types";
import { TH, cellStyle, cellRightStyle, Tag, DataSourceFooter } from "./ui";

interface PlanejamentoViewProps {
  data: PlanejamentoData | null;
  loading: boolean;
  daysBack: number;
  onDaysChange: (days: number) => void;
  moduleConfig: ModuleConfig;
  lastUpdated?: Date | null;
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

function fmtMoney(n: number): string {
  if (n === 0) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number): string {
  if (n === 0) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPctDirect(n: number): string {
  if (n === 0) return "—";
  return `${n.toFixed(2)}%`;
}

function Arrow({ current, historical }: { current: number; historical: number }) {
  if (historical === 0 || current === 0) return <span style={{ color: T.cinza400, fontSize: "10px" }}>—</span>;
  const diff = current - historical;
  if (Math.abs(diff / historical) < 0.05) return <span style={{ color: T.cinza400, fontSize: "10px" }}>→</span>;
  if (diff > 0) return <span style={{ color: T.verde600, fontSize: "10px", fontWeight: 600 }}>↑</span>;
  return <span style={{ color: T.destructive, fontSize: "10px", fontWeight: 600 }}>↓</span>;
}

function ArrowInverse({ current, historical }: { current: number; historical: number }) {
  if (historical === 0 || current === 0) return <span style={{ color: T.cinza400, fontSize: "10px" }}>—</span>;
  const diff = current - historical;
  if (Math.abs(diff / historical) < 0.05) return <span style={{ color: T.cinza400, fontSize: "10px" }}>→</span>;
  if (diff < 0) return <span style={{ color: T.verde600, fontSize: "10px", fontWeight: 600 }}>↑</span>;
  return <span style={{ color: T.destructive, fontSize: "10px", fontWeight: 600 }}>↓</span>;
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          backgroundColor: T.cinza200,
          color: T.cinza600,
          fontSize: "10px",
          fontWeight: 700,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        i
      </span>
      {show && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: T.fg,
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "11px",
            lineHeight: "1.5",
            whiteSpace: "pre-line",
            minWidth: "240px",
            maxWidth: "360px",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            pointerEvents: "none",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

const FILTER_TOOLTIP = `Filtros aplicados (equivalente ao Pipedrive):
• Pipeline: SZI (28)
• Canal: Marketing (campo canal = 12)
• [RD] Source: contém "paga"
• Motivo da perda ≠ "Duplicado/Erro"
• Empreendimento: todos os mapeados
• MQL: max_stage_order ≥ 2 (Lead In+)
• SQL: max_stage_order ≥ 5 (Qualificado+)
• OPP: max_stage_order ≥ 9 (Reunião+)`;

type SortDir = "asc" | "desc";
type SortKey = "emp" | "squad" | "mql" | "sql" | "opp" | "won" | "spend" | "cpw" | "mqlToSql" | "sqlToOpp" | "oppToWon" | "mqlToWon" | "efficiency" | "active";


function SortableTH({ label, sortKey, currentSort, onSort, right, center }: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  right?: boolean;
  center?: boolean;
}) {
  const active = currentSort.key === sortKey;
  const arrow = active ? (currentSort.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: "8px 10px",
        fontSize: "10px",
        fontWeight: 600,
        color: active ? T.azul600 : T.cinza600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.04em",
        borderBottom: `1px solid ${T.border}`,
        textAlign: right ? "right" : center ? "center" : "left",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}{arrow}
    </th>
  );
}

function getRowSortValue(row: PlanejamentoEmpRow, key: SortKey, activeEmps: Set<string>): number | string {
  if (key === "emp") return row.emp;
  if (key === "squad") return row.squadId;
  if (key === "efficiency") return row.efficiency === "high" ? 3 : row.efficiency === "medium" ? 2 : 1;
  if (key === "active") return activeEmps.has(row.emp) ? 1 : 0;
  if (key === "mqlToWon") {
    const h = row.historical;
    return h.mql > 0 ? h.won / h.mql : 0;
  }
  return row.historical[key as keyof PlanejamentoMetrics] as number;
}

function sortRows(rows: PlanejamentoEmpRow[], key: SortKey, dir: SortDir, activeEmps: Set<string>): PlanejamentoEmpRow[] {
  return [...rows].sort((a, b) => {
    const va = getRowSortValue(a, key, activeEmps);
    const vb = getRowSortValue(b, key, activeEmps);
    if (typeof va === "string" && typeof vb === "string") {
      return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return dir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

function EfficiencyTag({ efficiency }: { efficiency: "high" | "medium" | "low" }) {
  const labels = { high: "Alta", medium: "Média", low: "Baixa" };
  const colors = { high: T.verde600, medium: T.laranja500, low: T.destructive };
  return <Tag color={colors[efficiency]}>{labels[efficiency]}</Tag>;
}

function RecommendationTag({ row }: { row: PlanejamentoEmpRow }) {
  if (row.efficiency === "high" && row.current.won > 0) {
    return <Tag color={T.verde600}>Aumentar Budget</Tag>;
  }
  if (row.efficiency === "low") {
    return <Tag color={T.destructive}>Revisar</Tag>;
  }
  return <Tag color={T.cinza600}>Manter</Tag>;
}

function SummaryCard({ label, currentValue, histValue, format, periodLabel }: {
  label: string;
  currentValue: number;
  histValue: number;
  format: "number" | "money" | "pct";
  periodLabel?: string;
}) {
  const fmtFn = format === "money" ? fmtMoney : format === "pct" ? fmtPct : fmt;
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: `1px solid ${T.border}`,
        borderRadius: "12px",
        padding: "14px 18px",
        flex: "1 1 160px",
        minWidth: "160px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "22px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
          {fmtFn(currentValue)}
        </span>
        {format === "money" ? (
          <ArrowInverse current={currentValue} historical={histValue} />
        ) : (
          <Arrow current={currentValue} historical={histValue} />
        )}
      </div>
      <div style={{ fontSize: "10px", color: T.cinza400, marginTop: "2px" }}>
        {periodLabel || "Total 12m"}: {fmtFn(histValue)}
      </div>
    </div>
  );
}

function HistEmpRow({ row, activeEmps }: { row: PlanejamentoEmpRow; activeEmps: Set<string> }) {
  const h = row.historical;
  const color = SQUAD_COLORS[row.squadId] || T.azul600;
  const isActive = activeEmps.has(row.emp);
  const mqlToWon = h.mql > 0 ? h.won / h.mql : 0;

  return (
    <tr>
      <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "3px", height: "16px", borderRadius: "2px", backgroundColor: color }} />
          {row.emp.replace(" Spot", "").replace(" II", " II").replace(" III", " III")}
        </div>
      </td>
      <td style={{ ...cellRightStyle, textAlign: "center", fontSize: "11px", color: row.squadId ? color : T.cinza400 }}>
        {row.squadId ? `S${row.squadId}` : "—"}
      </td>
      <td style={{ ...cellRightStyle, textAlign: "center" }}>
        <span style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: isActive ? T.verde600 : T.cinza300,
        }} />
      </td>
      <td style={cellRightStyle}>{fmt(h.mql)}</td>
      <td style={cellRightStyle}>{fmt(h.sql)}</td>
      <td style={cellRightStyle}>{fmt(h.opp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(h.won)}</td>
      <td style={cellRightStyle}>{fmtPct(mqlToWon)}</td>
      <td style={cellRightStyle}>{fmtMoney(h.spend)}</td>
      <td style={cellRightStyle}>{fmtMoney(h.cpw)}</td>
      <td style={cellRightStyle}>{fmtPct(h.mqlToSql)}</td>
      <td style={cellRightStyle}>{fmtPct(h.sqlToOpp)}</td>
      <td style={cellRightStyle}>{fmtPct(h.oppToWon)}</td>
      <td style={{ ...cellRightStyle, textAlign: "center" }}>
        <EfficiencyTag efficiency={row.efficiency} />
      </td>
      <td style={{ ...cellRightStyle, textAlign: "center" }}>
        <RecommendationTag row={row} />
      </td>
    </tr>
  );
}

function HistTotalsRow({ label, m }: { label: string; m: PlanejamentoMetrics }) {
  const mqlToWon = m.mql > 0 ? m.won / m.mql : 0;
  return (
    <tr style={{ backgroundColor: T.cinza50 }}>
      <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 700 }}>{label}</td>
      <td style={{ ...cellRightStyle }} />
      <td style={{ ...cellRightStyle }} />
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.mql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.sql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.opp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(m.won)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtPct(mqlToWon)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(m.spend)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(m.cpw)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtPct(m.mqlToSql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtPct(m.sqlToOpp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtPct(m.oppToWon)}</td>
      <td style={cellRightStyle} />
      <td style={cellRightStyle} />
    </tr>
  );
}

/* ---- Histórico de Campanhas (collapsible section) ---- */

const histThStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  backgroundColor: "#F3F3F5",
};

// Aggregated row (campaign or adset level)
interface AggRow {
  name: string;
  empreendimento: string;
  spend: number;
  leads: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  impressions: number;
  clicks: number;
  cpl: number;
  cmql: number;
  csql: number;
  copp: number;
  cpw: number;
  ctr: number;
  cpc: number;
  cpm: number;
  adCount: number;
  lastSeenDate: string;
  hasActiveAds: boolean;
  activeCount: number;
  pausedCount: number;
}

// Column visibility groups
type ColGroup = "conversoes" | "custos" | "midia";
const COL_GROUPS: { key: ColGroup; label: string }[] = [
  { key: "conversoes", label: "Conversões" },
  { key: "custos", label: "Custos" },
  { key: "midia", label: "Mídia" },
];
const DEFAULT_VISIBLE: Set<ColGroup> = new Set(["conversoes", "custos", "midia"]);

function aggregate(ads: HistoricoAdRow[], nameKey: "campaignName" | "adsetName"): AggRow[] {
  const map = new Map<string, { ads: HistoricoAdRow[]; emp: string; lastDate: string }>();
  for (const ad of ads) {
    const key = ad[nameKey];
    const existing = map.get(key);
    if (existing) {
      existing.ads.push(ad);
      if (ad.lastSeenDate > existing.lastDate) existing.lastDate = ad.lastSeenDate;
    } else {
      map.set(key, { ads: [ad], emp: ad.empreendimento, lastDate: ad.lastSeenDate });
    }
  }
  const rows: AggRow[] = [];
  for (const [name, { ads: group, emp, lastDate }] of map) {
    const spend = group.reduce((s, a) => s + a.spend, 0);
    const leads = group.reduce((s, a) => s + a.leads, 0);
    const mql = group.reduce((s, a) => s + a.mql, 0);
    const sql = group.reduce((s, a) => s + a.sql, 0);
    const opp = group.reduce((s, a) => s + a.opp, 0);
    const won = group.reduce((s, a) => s + a.won, 0);
    const impressions = group.reduce((s, a) => s + a.impressions, 0);
    const clicks = group.reduce((s, a) => s + a.clicks, 0);
    const activeCount = group.filter(a => a.effectiveStatus === "ACTIVE").length;
    const pausedCount = group.length - activeCount;
    rows.push({
      name,
      empreendimento: emp,
      spend, leads, mql, sql, opp, won, impressions, clicks,
      cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
      cmql: mql > 0 ? Math.round((spend / mql) * 100) / 100 : 0,
      csql: sql > 0 ? Math.round((spend / sql) * 100) / 100 : 0,
      copp: opp > 0 ? Math.round((spend / opp) * 100) / 100 : 0,
      cpw: won > 0 ? Math.round((spend / won) * 100) / 100 : 0,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
      cpm: impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0,
      adCount: group.length,
      lastSeenDate: lastDate,
      hasActiveAds: activeCount > 0,
      activeCount,
      pausedCount,
    });
  }
  return rows;
}

type CampSortKey = "name" | "empreendimento" | "spend" | "leads" | "mql" | "sql" | "opp" | "won" | "cpl" | "cmql" | "csql" | "copp" | "cpw" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm" | "adCount" | "lastSeenDate";
const STRING_COLS = new Set<CampSortKey>(["name", "empreendimento", "lastSeenDate"]);

function SortTh({ label, col, sortKey, sortDir, onSort, align, minW }: {
  label: string; col: CampSortKey; align: "left" | "right" | "center"; minW?: number;
  sortKey: CampSortKey; sortDir: SortDir; onSort: (k: CampSortKey) => void;
}) {
  const active = sortKey === col;
  const arrow = active ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";
  return (
    <th
      style={{ ...histThStyle, textAlign: align, minWidth: minW, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(col)}
    >
      {label}{arrow}
    </th>
  );
}

function MetricsCells({ r, avgCpl, vis }: { r: { spend: number; leads: number; mql: number; sql: number; opp: number; won: number; impressions: number; clicks: number; cpl: number; cmql: number; csql: number; copp: number; cpw: number; ctr: number; cpc: number; cpm: number }; avgCpl: number; vis: Set<ColGroup> }) {
  const cplColor = r.cpl > 0 && avgCpl > 0 ? (r.cpl <= avgCpl ? T.verde600 : T.destructive) : undefined;
  const groupBorder = "2px solid #E2E4EA";
  return (
    <>
      {vis.has("conversoes") && <>
        <td style={cellRightStyle}>{fmt(r.leads)}</td>
        <td style={cellRightStyle}>{fmt(r.mql)}</td>
        <td style={cellRightStyle}>{fmt(r.sql)}</td>
        <td style={cellRightStyle}>{fmt(r.opp)}</td>
        <td style={{ ...cellRightStyle, fontWeight: 700, color: r.won > 0 ? T.verde600 : undefined, borderRight: groupBorder }}>{fmt(r.won)}</td>
      </>}
      {vis.has("custos") && <>
        <td style={cellRightStyle}>{fmtMoney(r.spend)}</td>
        <td style={{ ...cellRightStyle, color: cplColor, fontWeight: cplColor ? 600 : 400 }}>{r.cpl > 0 ? fmtMoney(r.cpl) : "—"}</td>
        <td style={cellRightStyle}>{r.cmql > 0 ? fmtMoney(r.cmql) : "—"}</td>
        <td style={cellRightStyle}>{r.csql > 0 ? fmtMoney(r.csql) : "—"}</td>
        <td style={cellRightStyle}>{r.copp > 0 ? fmtMoney(r.copp) : "—"}</td>
        <td style={{ ...cellRightStyle, borderRight: groupBorder }}>{r.cpw > 0 ? fmtMoney(r.cpw) : "—"}</td>
      </>}
      {vis.has("midia") && <>
        <td style={cellRightStyle}>{fmt(r.impressions)}</td>
        <td style={cellRightStyle}>{fmt(r.clicks)}</td>
        <td style={cellRightStyle}>{fmtPctDirect(r.ctr)}</td>
        <td style={cellRightStyle}>{r.cpc > 0 ? fmtMoney(r.cpc) : "—"}</td>
        <td style={cellRightStyle}>{r.cpm > 0 ? fmtMoney(r.cpm) : "—"}</td>
      </>}
    </>
  );
}

function HistoricoCampanhasSection({ moduleConfig }: { moduleConfig: ModuleConfig }) {
  const isSZS = moduleConfig?.id === "szs";
  const ACTIVE_EMPS = useMemo(() => new Set<string>((moduleConfig?.squads || []).flatMap((s) => [...s.empreendimentos])), [moduleConfig]);
  const [histData, setHistData] = useState<HistoricoCampanhasData | null>(null);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CampSortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filtroEmp, setFiltroEmp] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "active" | "paused">("todos");
  const [ocultarCpwZero, setOcultarCpwZero] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColGroup>>(new Set(DEFAULT_VISIBLE));
  const [showColMenu, setShowColMenu] = useState(false);
  const [expandedCamps, setExpandedCamps] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/planejamento/historico");
        if (!res.ok) {
          const text = await res.text();
          console.error("Historico fetch error:", res.status, text);
          let detail = "";
          try { detail = JSON.parse(text).error || text; } catch { detail = text; }
          if (!cancelled) setHistError(`Erro ${res.status}: ${detail}`);
          return;
        }
        const json = await res.json();
        if (!cancelled) setHistData(json);
      } catch (err) {
        console.error("Historico fetch exception:", err);
        if (!cancelled) setHistError(String(err));
      } finally {
        if (!cancelled) setHistLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const toggleSort = useCallback((key: CampSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(STRING_COLS.has(key) ? "asc" : "desc");
    }
  }, [sortKey]);

  const toggleCamp = useCallback((name: string) => {
    setExpandedCamps(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const toggleAdset = useCallback((key: string) => {
    setExpandedAdsets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Filter ads by empreendimento, then aggregate and filter campaigns by status
  const filteredAds = useMemo(() => {
    if (!histData) return [];
    let ads = histData.ads;
    if (filtroEmp === "comercializacao") ads = ads.filter(a => ACTIVE_EMPS.has(a.empreendimento));
    else if (filtroEmp !== "todos") ads = ads.filter(a => a.empreendimento === filtroEmp);
    return ads;
  }, [histData, filtroEmp]);

  const toggleColGroup = useCallback((g: ColGroup) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(g)) { if (next.size > 1) next.delete(g); } else next.add(g);
      return next;
    });
  }, []);

  const campaigns = useMemo(() => {
    let rows = aggregate(filteredAds, "campaignName");
    if (filtroStatus === "active") rows = rows.filter(r => r.hasActiveAds);
    else if (filtroStatus === "paused") rows = rows.filter(r => !r.hasActiveAds);
    if (ocultarCpwZero) rows = rows.filter(r => r.cpw > 0);
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const aVal = a[sortKey as keyof AggRow];
      const bVal = b[sortKey as keyof AggRow];
      if (STRING_COLS.has(sortKey)) {
        return (String(aVal || "")).localeCompare(String(bVal || ""), "pt-BR") * dir;
      }
      return ((aVal as number) - (bVal as number)) * dir;
    });
  }, [filteredAds, filtroStatus, sortKey, sortDir, ocultarCpwZero]);

  // Totals
  const totals = useMemo(() => {
    const spend = filteredAds.reduce((s, a) => s + a.spend, 0);
    const leads = filteredAds.reduce((s, a) => s + a.leads, 0);
    const mql = filteredAds.reduce((s, a) => s + a.mql, 0);
    const sql = filteredAds.reduce((s, a) => s + a.sql, 0);
    const opp = filteredAds.reduce((s, a) => s + a.opp, 0);
    const won = filteredAds.reduce((s, a) => s + a.won, 0);
    const impressions = filteredAds.reduce((s, a) => s + a.impressions, 0);
    const clicks = filteredAds.reduce((s, a) => s + a.clicks, 0);
    return {
      spend, leads, mql, sql, opp, won, impressions, clicks,
      cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
      cmql: mql > 0 ? Math.round((spend / mql) * 100) / 100 : 0,
      csql: sql > 0 ? Math.round((spend / sql) * 100) / 100 : 0,
      copp: opp > 0 ? Math.round((spend / opp) * 100) / 100 : 0,
      cpw: won > 0 ? Math.round((spend / won) * 100) / 100 : 0,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
      cpm: impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0,
    };
  }, [filteredAds]);

  const avgCpl = totals.cpl;

  const empreendimentos = useMemo(() => {
    if (!histData) return [];
    return [...new Set(histData.ads.map(a => a.empreendimento))].sort();
  }, [histData]);

  const selectStyle: React.CSSProperties = {
    padding: "5px 10px",
    borderRadius: "8px",
    border: `1px solid ${T.border}`,
    fontSize: "12px",
    color: T.fg,
    backgroundColor: "#FFF",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: `1px solid ${T.border}`,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: 0 }}>
          Histórico de Campanhas
        </h3>
        <span style={{ fontSize: "10px", color: T.cinza400 }}>
          {histData ? `${histData.ads.length} ads` : histLoading ? "Carregando..." : ""}
        </span>
      </div>

      <div style={{ padding: "12px 16px 16px" }}>
        {histLoading ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.mutedFg }}>
            <p style={{ fontSize: "14px" }}>Carregando histórico da Meta Ads...</p>
          </div>
        ) : histError ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.destructive }}>
            <p style={{ fontSize: "14px" }}>{histError}</p>
          </div>
        ) : histData ? (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <select value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)} style={selectStyle}>
                <option value="todos">{isSZS ? "Todos bairros" : "Todos empreendimentos"}</option>
                <option value="comercializacao">Em comercialização</option>
                {empreendimentos.map(emp => (
                  <option key={emp} value={emp}>{emp || "(sem empreendimento)"}</option>
                ))}
              </select>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as "todos" | "active" | "paused")} style={selectStyle}>
                <option value="todos">Todas campanhas</option>
                <option value="active">Campanhas ativas</option>
                <option value="paused">Campanhas pausadas</option>
              </select>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowColMenu(p => !p)}
                  style={{
                    ...selectStyle,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#FFF",
                  }}
                >
                  Colunas {visibleCols.size < 3 ? `(${visibleCols.size}/3)` : ""}
                  <span style={{ fontSize: "8px" }}>▼</span>
                </button>
                {showColMenu && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "4px",
                    backgroundColor: "#FFF",
                    border: `1px solid ${T.border}`,
                    borderRadius: "8px",
                    padding: "8px 0",
                    zIndex: 30,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    minWidth: "160px",
                  }}>
                    {COL_GROUPS.map(g => (
                      <label
                        key={g.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          color: T.fg,
                          cursor: "pointer",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = T.cinza50)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}
                      >
                        <input
                          type="checkbox"
                          checked={visibleCols.has(g.key)}
                          onChange={() => toggleColGroup(g.key)}
                          style={{ accentColor: T.primary }}
                        />
                        {g.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: T.cinza600, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={ocultarCpwZero}
                  onChange={() => setOcultarCpwZero(p => !p)}
                  style={{ accentColor: T.primary }}
                />
                Somente com WON
              </label>
              <span style={{ fontSize: "11px", color: T.cinza400, marginLeft: "auto" }}>
                {campaigns.length} campanhas | {filteredAds.length} ads | Gasto total: {fmtMoney(totals.spend)}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1600px" }}>
                <thead>
                  <tr>
                    <th colSpan={3} style={{ ...histThStyle, borderBottom: "none" }} />
                    {visibleCols.has("conversoes") && <th colSpan={5} style={{ ...histThStyle, borderBottom: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: T.verde600, borderRight: "2px solid #E2E4EA" }}>CONVERSÕES</th>}
                    {visibleCols.has("custos") && <th colSpan={6} style={{ ...histThStyle, borderBottom: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: T.destructive, borderRight: "2px solid #E2E4EA" }}>CUSTOS</th>}
                    {visibleCols.has("midia") && <th colSpan={5} style={{ ...histThStyle, borderBottom: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: T.primary }}>MÍDIA</th>}
                  </tr>
                  <tr>
                    <SortTh label="" col="name" align="left" minW={24} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Nome" col="name" align="left" minW={200} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label={isSZS ? "Cidade" : "Empreend."} col="empreendimento" align="left" minW={120} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    {visibleCols.has("conversoes") && <>
                      <SortTh label="Leads" col="leads" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="MQL" col="mql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="SQL" col="sql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="OPP" col="opp" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="WON" col="won" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    </>}
                    {visibleCols.has("custos") && <>
                      <SortTh label="Gasto" col="spend" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="CPL" col="cpl" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="CMQL" col="cmql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="CSQL" col="csql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="COPP" col="copp" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="CPW" col="cpw" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    </>}
                    {visibleCols.has("midia") && <>
                      <SortTh label="Impr." col="impressions" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="Clicks" col="clicks" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="CTR" col="ctr" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="CPC" col="cpc" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="CPM" col="cpm" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((camp) => {
                    const isOpen = expandedCamps.has(camp.name);
                    const campAds = filteredAds.filter(a => a.campaignName === camp.name);
                    const adsets = isOpen ? aggregate(campAds, "adsetName").sort((a, b) => b.spend - a.spend) : [];

                    return (
                      <React.Fragment key={camp.name}>
                        {/* Campaign row */}
                        <tr
                          style={{ cursor: "pointer", backgroundColor: isOpen ? T.azul50 : undefined }}
                          onClick={() => toggleCamp(camp.name)}
                        >
                          <td style={{ ...cellStyle, width: "24px", textAlign: "center", fontSize: "10px", color: T.cinza600 }}>
                            {isOpen ? "▼" : "▶"}
                          </td>
                          <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 600, maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis" }} title={camp.name}>
                            <span
                              style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: camp.hasActiveAds ? T.verde600 : T.cinza400,
                                marginRight: "6px",
                                verticalAlign: "middle",
                                flexShrink: 0,
                              }}
                              title={camp.hasActiveAds
                                ? `${camp.activeCount} ativo${camp.activeCount > 1 ? "s" : ""}${camp.pausedCount > 0 ? `, ${camp.pausedCount} pausado${camp.pausedCount > 1 ? "s" : ""}` : ""}`
                                : `${camp.pausedCount} pausado${camp.pausedCount > 1 ? "s" : ""}`
                              }
                            />
                            {camp.name}
                            <span style={{ marginLeft: "6px", fontSize: "10px", fontWeight: 400, color: T.cinza400 }}>
                              ({camp.adCount} ads)
                            </span>
                          </td>
                          <td style={{ ...cellStyle, fontSize: "12px" }}>{camp.empreendimento}</td>
                          <MetricsCells r={camp} avgCpl={avgCpl} vis={visibleCols} />
                        </tr>

                        {/* Adset rows */}
                        {isOpen && adsets.map((adset) => {
                          const adsetKey = `${camp.name}|${adset.name}`;
                          const adsetOpen = expandedAdsets.has(adsetKey);
                          const adsetAds = campAds.filter(a => a.adsetName === adset.name).sort((a, b) => b.spend - a.spend);

                          return (
                            <React.Fragment key={adsetKey}>
                              <tr
                                style={{ cursor: "pointer", backgroundColor: adsetOpen ? "#F8F9FF" : T.cinza50 }}
                                onClick={() => toggleAdset(adsetKey)}
                              >
                                <td style={{ ...cellStyle, width: "24px" }} />
                                <td style={{ ...cellStyle, fontSize: "11px", fontWeight: 500, paddingLeft: "24px" }}>
                                  <span style={{ fontSize: "10px", color: T.cinza600, marginRight: "6px" }}>{adsetOpen ? "▼" : "▶"}</span>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      width: "7px",
                                      height: "7px",
                                      borderRadius: "50%",
                                      backgroundColor: adset.hasActiveAds ? T.verde600 : T.cinza400,
                                      marginRight: "5px",
                                      verticalAlign: "middle",
                                    }}
                                  />
                                  {adset.name}
                                  <span style={{ marginLeft: "6px", fontSize: "10px", fontWeight: 400, color: T.cinza400 }}>
                                    ({adset.adCount} ads)
                                  </span>
                                </td>
                                <td style={cellStyle} />
                                <MetricsCells r={adset} avgCpl={avgCpl} vis={visibleCols} />
                              </tr>

                              {/* Individual ad rows */}
                              {adsetOpen && adsetAds.map((ad) => (
                                <tr key={ad.adId} style={{ backgroundColor: "#FAFBFF" }}>
                                  <td style={{ ...cellStyle, width: "24px" }} />
                                  <td style={{ ...cellStyle, fontSize: "11px", fontWeight: 400, paddingLeft: "48px", color: T.cinza700 }} title={ad.adName}>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        backgroundColor: ad.effectiveStatus === "ACTIVE" ? T.verde600 : T.cinza400,
                                        marginRight: "5px",
                                        verticalAlign: "middle",
                                      }}
                                    />
                                    {ad.adName}
                                    {ad.effectiveStatus !== "ACTIVE" && (
                                      <Tag color={T.cinza400}>Pausado</Tag>
                                    )}
                                  </td>
                                  <td style={cellStyle} />
                                  <MetricsCells r={ad} avgCpl={avgCpl} vis={visibleCols} />
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* Totals row */}
                  <tr style={{ backgroundColor: T.cinza50 }}>
                    <td style={cellStyle} />
                    <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 700 }}>Total</td>
                    <td style={cellStyle} />
                    <MetricsCells r={totals} avgCpl={avgCpl} vis={visibleCols} />
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const DAYS_OPTIONS = [
  { value: -1, label: "Histórico completo" },
  { value: 0, label: "Últimos 12 meses" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 60, label: "Últimos 60 dias" },
  { value: 90, label: "Últimos 90 dias" },
  { value: 180, label: "Últimos 180 dias" },
  { value: 365, label: "Último ano" },
];

export function PlanejamentoView({ data, loading, daysBack, onDaysChange, moduleConfig, lastUpdated }: PlanejamentoViewProps) {
  const isSZS = moduleConfig?.id === "szs";
  const ACTIVE_EMPS = useMemo(() => new Set<string>((moduleConfig?.squads || []).flatMap((s) => [...s.empreendimentos])), [moduleConfig?.squads]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "mql", dir: "desc" });
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [squadFilter, setSquadFilter] = useState<number>(0); // 0 = all
  const [recent90Data, setRecent90Data] = useState<PlanejamentoData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${moduleConfig.apiBase}/planejamento?days=90`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d) setRecent90Data(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [data]); // re-fetch when main data refreshes

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  }, []);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.empreendimentos;
    if (activeFilter === "active") rows = rows.filter((r) => ACTIVE_EMPS.has(r.emp));
    else if (activeFilter === "inactive") rows = rows.filter((r) => !ACTIVE_EMPS.has(r.emp));
    if (squadFilter > 0) rows = rows.filter((r) => r.squadId === squadFilter);
    return rows;
  }, [data, activeFilter, squadFilter]);

  const sortedRows = useMemo(() => sortRows(filteredRows, sort.key, sort.dir, ACTIVE_EMPS), [filteredRows, sort, ACTIVE_EMPS]);

  const filteredTotals = useMemo(() => {
    const sum = (arr: PlanejamentoMetrics[]): PlanejamentoMetrics => {
      const leads = arr.reduce((s, r) => s + r.leads, 0);
      const mql = arr.reduce((s, r) => s + r.mql, 0);
      const sql = arr.reduce((s, r) => s + r.sql, 0);
      const opp = arr.reduce((s, r) => s + r.opp, 0);
      const won = arr.reduce((s, r) => s + r.won, 0);
      const spend = Math.round(arr.reduce((s, r) => s + r.spend, 0) * 100) / 100;
      const rate = (n: number, d: number) => d > 0 ? Math.round((n / d) * 10000) / 10000 : 0;
      const cost = (sp: number, d: number) => d > 0 ? Math.round((sp / d) * 100) / 100 : 0;
      return {
        leads, mql, sql, opp, won, spend,
        cpl: cost(spend, leads), cmql: cost(spend, mql), copp: cost(spend, opp), cpw: cost(spend, won),
        mqlToSql: rate(sql, mql), sqlToOpp: rate(opp, sql), oppToWon: rate(won, opp),
      };
    };
    return {
      current: sum(filteredRows.map((r) => r.current)),
      historical: sum(filteredRows.map((r) => r.historical)),
    };
  }, [filteredRows]);

  const squadSummaries = useMemo(() => {
    const sumMetrics = (rows: PlanejamentoEmpRow[], period: "current" | "historical"): PlanejamentoMetrics => {
      const arr = rows.map((r) => r[period]);
      const leads = arr.reduce((s, r) => s + r.leads, 0);
      const mql = arr.reduce((s, r) => s + r.mql, 0);
      const sql = arr.reduce((s, r) => s + r.sql, 0);
      const opp = arr.reduce((s, r) => s + r.opp, 0);
      const won = arr.reduce((s, r) => s + r.won, 0);
      const spend = Math.round(arr.reduce((s, r) => s + r.spend, 0) * 100) / 100;
      const rate = (n: number, d: number) => d > 0 ? Math.round((n / d) * 10000) / 10000 : 0;
      const cost = (sp: number, d: number) => d > 0 ? Math.round((sp / d) * 100) / 100 : 0;
      return {
        leads, mql, sql, opp, won, spend,
        cpl: cost(spend, leads), cmql: cost(spend, mql), copp: cost(spend, opp), cpw: cost(spend, won),
        mqlToSql: rate(sql, mql), sqlToOpp: rate(opp, sql), oppToWon: rate(won, opp),
      };
    };
    const sumBothPeriods = (rows: PlanejamentoEmpRow[]): PlanejamentoMetrics => {
      const c = rows.map((r) => r.current);
      const h = rows.map((r) => r.historical);
      const all = [...c, ...h];
      const leads = all.reduce((s, r) => s + r.leads, 0);
      const mql = all.reduce((s, r) => s + r.mql, 0);
      const sql = all.reduce((s, r) => s + r.sql, 0);
      const opp = all.reduce((s, r) => s + r.opp, 0);
      const won = all.reduce((s, r) => s + r.won, 0);
      const spend = Math.round(all.reduce((s, r) => s + r.spend, 0) * 100) / 100;
      const rate = (n: number, d: number) => d > 0 ? Math.round((n / d) * 10000) / 10000 : 0;
      const cost = (sp: number, d: number) => d > 0 ? Math.round((sp / d) * 100) / 100 : 0;
      return {
        leads, mql, sql, opp, won, spend,
        cpl: cost(spend, leads), cmql: cost(spend, mql), copp: cost(spend, opp), cpw: cost(spend, won),
        mqlToSql: rate(sql, mql), sqlToOpp: rate(opp, sql), oppToWon: rate(won, opp),
      };
    };
    return moduleConfig.squads.map((sq) => {
      const rows = filteredRows.filter((r) => r.squadId === sq.id);
      // Recent 90 days: use dedicated data, applying same filters
      let recent90Rows = recent90Data?.empreendimentos.filter((r) => r.squadId === sq.id) || [];
      if (activeFilter === "active") recent90Rows = recent90Rows.filter((r) => ACTIVE_EMPS.has(r.emp));
      else if (activeFilter === "inactive") recent90Rows = recent90Rows.filter((r) => !ACTIVE_EMPS.has(r.emp));
      return {
        id: sq.id,
        empreendimentos: rows.map((r) => r.emp),
        recent90: sumBothPeriods(recent90Rows),
        historical: sumMetrics(rows, "historical"),
      };
    });
  }, [filteredRows, recent90Data, activeFilter]);

  const tc = filteredTotals.current;
  const th = filteredTotals.historical;
  // Combined: full selected period (current month + historical)
  const tCombined = useMemo(() => {
    const leads = tc.leads + th.leads;
    const mql = tc.mql + th.mql;
    const sql = tc.sql + th.sql;
    const opp = tc.opp + th.opp;
    const won = tc.won + th.won;
    const spend = Math.round((tc.spend + th.spend) * 100) / 100;
    const r = (n: number, d: number) => d > 0 ? Math.round((n / d) * 10000) / 10000 : 0;
    const c = (sp: number, d: number) => d > 0 ? Math.round((sp / d) * 100) / 100 : 0;
    return {
      leads, mql, sql, opp, won, spend,
      cpl: c(spend, leads), cmql: c(spend, mql), copp: c(spend, opp), cpw: c(spend, won),
      mqlToSql: r(sql, mql), sqlToOpp: r(opp, sql), oppToWon: r(won, opp),
    };
  }, [tc, th]);

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando planejamento...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary cards — mês atual vs histórico */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "-12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>Métricas de Conversão</span>
        <InfoTooltip text={FILTER_TOOLTIP} />
        <select
          value={daysBack}
          onChange={(e) => onDaysChange(Number(e.target.value))}
          style={{
            fontSize: "11px",
            padding: "4px 8px",
            borderRadius: "6px",
            border: `1px solid ${T.border}`,
            backgroundColor: "#FFF",
            color: T.fg,
            cursor: "pointer",
            outline: "none",
            marginLeft: "auto",
          }}
        >
          {DAYS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <SummaryCard label="Investimento Total" currentValue={tCombined.spend} histValue={tc.spend} format="money" periodLabel={`Mês atual`} />
        <SummaryCard label="WON Total" currentValue={tCombined.won} histValue={tc.won} format="number" periodLabel={`Mês atual`} />
        <SummaryCard label="CPW Médio" currentValue={tCombined.cpw} histValue={tc.cpw} format="money" periodLabel={`Mês atual`} />
        <SummaryCard label="MQL→SQL" currentValue={tCombined.mqlToSql} histValue={tc.mqlToSql} format="pct" periodLabel={`Mês atual`} />
        <SummaryCard label="SQL→OPP" currentValue={tCombined.sqlToOpp} histValue={tc.sqlToOpp} format="pct" periodLabel={`Mês atual`} />
        <SummaryCard label="OPP→WON" currentValue={tCombined.oppToWon} histValue={tc.oppToWon} format="pct" periodLabel={`Mês atual`} />
      </div>

      {/* Tabela — somente conversão histórica (média mensal) */}
      <div
        style={{
          backgroundColor: "#FFF",
          border: `1px solid ${T.border}`,
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: 0 }}>
              Conversão Histórica por {isSZS ? "Cidade" : "Empreendimento"}
            </h3>
            <InfoTooltip text={FILTER_TOOLTIP} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as "all" | "active" | "inactive")}
              style={{
                fontSize: "11px",
                padding: "4px 8px",
                borderRadius: "6px",
                border: `1px solid ${T.border}`,
                backgroundColor: "#FFF",
                color: T.fg,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">Todos</option>
              <option value="active">Em comercialização</option>
              <option value="inactive">Fora de comercialização</option>
            </select>
            <select
              value={squadFilter}
              onChange={(e) => setSquadFilter(Number(e.target.value))}
              style={{
                fontSize: "11px",
                padding: "4px 8px",
                borderRadius: "6px",
                border: `1px solid ${T.border}`,
                backgroundColor: "#FFF",
                color: T.fg,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value={0}>Todas as Squads</option>
              <option value={1}>Squad 1</option>
              <option value={2}>Squad 2</option>
            </select>
            <span style={{ fontSize: "10px", color: T.cinza400 }}>
              Total acumulado ({DAYS_OPTIONS.find((o) => o.value === daysBack)?.label.toLowerCase() || "últimos 12 meses"})
            </span>
          </div>
        </div>
        <div style={{ overflowX: "auto", marginTop: "10px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <SortableTH label={isSZS ? "Cidade" : "Empreendimento"} sortKey="emp" currentSort={sort} onSort={handleSort} />
                <SortableTH label="Squad" sortKey="squad" currentSort={sort} onSort={handleSort} center />
                <SortableTH label="Ativo" sortKey="active" currentSort={sort} onSort={handleSort} center />
                <SortableTH label="MQL" sortKey="mql" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="SQL" sortKey="sql" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="OPP" sortKey="opp" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="WON" sortKey="won" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="MQL→WON" sortKey="mqlToWon" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="Invest." sortKey="spend" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="CPW" sortKey="cpw" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="MQL→SQL" sortKey="mqlToSql" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="SQL→OPP" sortKey="sqlToOpp" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="OPP→WON" sortKey="oppToWon" currentSort={sort} onSort={handleSort} right />
                <SortableTH label="Eficiência" sortKey="efficiency" currentSort={sort} onSort={handleSort} center />
                <TH extraStyle={{ textAlign: "center" }}>Ação</TH>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <HistEmpRow key={row.emp} row={row} activeEmps={ACTIVE_EMPS} />
              ))}
              <HistTotalsRow label="Total" m={th} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Resultados por Squad */}
      <div
        style={{
          backgroundColor: "#FFF",
          border: `1px solid ${T.border}`,
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: "0 0 12px 0" }}>
          Resultados por Squad
        </h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {squadSummaries.map((sq) => {
            const color = SQUAD_COLORS[sq.id] || T.azul600;
            const h = sq.historical;
            const r = sq.recent90;
            const mqlToWon = h.mql > 0 ? h.won / h.mql : 0;
            const rows: { label: string; hist: string; cur: string }[] = [
              { label: "MQL", hist: fmt(h.mql), cur: fmt(r.mql) },
              { label: "SQL", hist: fmt(h.sql), cur: fmt(r.sql) },
              { label: "OPP", hist: fmt(h.opp), cur: fmt(r.opp) },
              { label: "WON", hist: fmt(h.won), cur: fmt(r.won) },
              { label: "Invest.", hist: fmtMoney(h.spend), cur: fmtMoney(r.spend) },
              { label: "CPW", hist: h.cpw > 0 ? fmtMoney(h.cpw) : "—", cur: r.cpw > 0 ? fmtMoney(r.cpw) : "—" },
              { label: "MQL→WON", hist: fmtPct(mqlToWon), cur: fmtPct(r.mql > 0 ? r.won / r.mql : 0) },
              { label: "MQL→SQL", hist: fmtPct(h.mqlToSql), cur: fmtPct(r.mqlToSql) },
              { label: "SQL→OPP", hist: fmtPct(h.sqlToOpp), cur: fmtPct(r.sqlToOpp) },
              { label: "OPP→WON", hist: fmtPct(h.oppToWon), cur: fmtPct(r.oppToWon) },
            ];
            return (
              <div
                key={sq.id}
                style={{
                  flex: "1 1 280px",
                  border: `1px solid ${T.border}`,
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <div style={{ backgroundColor: color, padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFF" }}>Squad {sq.id}</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.8)" }}>
                    {sq.empreendimentos.length} emp.
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      <th style={{ fontSize: "10px", fontWeight: 600, color: T.cinza400, padding: "6px 10px", textAlign: "left" }}>Métrica</th>
                      <th style={{ fontSize: "10px", fontWeight: 600, color: T.cinza400, padding: "6px 10px", textAlign: "right" }}>Histórico</th>
                      <th style={{ fontSize: "10px", fontWeight: 600, color: T.cinza400, padding: "6px 10px", textAlign: "right" }}>Últimos 90 dias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label} style={{ borderBottom: `1px solid ${T.cinza50}` }}>
                        <td style={{ fontSize: "11px", fontWeight: 500, color: T.fg, padding: "5px 10px" }}>{r.label}</td>
                        <td style={{ fontSize: "11px", color: T.cinza600, padding: "5px 10px", textAlign: "right" }}>{r.hist}</td>
                        <td style={{ fontSize: "11px", fontWeight: 600, color: T.fg, padding: "5px 10px", textAlign: "right" }}>{r.cur}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "6px 10px", borderTop: `1px solid ${T.border}`, backgroundColor: T.cinza50 }}>
                  <span style={{ fontSize: "10px", color: T.cinza400 }}>
                    {sq.empreendimentos.map((e) => e.replace(" Spot", "")).join(", ")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico de Campanhas — collapsible, lazy load */}
      <HistoricoCampanhasSection moduleConfig={moduleConfig} />
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
