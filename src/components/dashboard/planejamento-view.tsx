"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { T, SQUAD_COLORS, SQUADS } from "@/lib/constants";
import type { PlanejamentoData, PlanejamentoEmpRow, PlanejamentoMetrics, HistoricoAdRow, HistoricoCampanhasData } from "@/lib/types";
import { TH, cellStyle, cellRightStyle, Tag } from "./ui";

interface PlanejamentoViewProps {
  data: PlanejamentoData | null;
  loading: boolean;
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

function SummaryCard({ label, currentValue, histValue, format }: {
  label: string;
  currentValue: number;
  histValue: number;
  format: "number" | "money" | "pct";
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
        Total 12m: {fmtFn(histValue)}
      </div>
    </div>
  );
}

function HistEmpRow({ row }: { row: PlanejamentoEmpRow }) {
  const h = row.historical;
  const color = SQUAD_COLORS[row.squadId] || T.azul600;

  return (
    <tr>
      <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "3px", height: "16px", borderRadius: "2px", backgroundColor: color }} />
          {row.emp.replace(" Spot", "").replace(" II", " II").replace(" III", " III")}
        </div>
      </td>
      <td style={cellRightStyle}>{fmt(h.mql)}</td>
      <td style={cellRightStyle}>{fmt(h.sql)}</td>
      <td style={cellRightStyle}>{fmt(h.opp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(h.won)}</td>
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
  return (
    <tr style={{ backgroundColor: T.cinza50 }}>
      <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 700 }}>{label}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.mql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.sql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.opp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(m.won)}</td>
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

type SortDir = "asc" | "desc";

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
}

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

function MetricsCells({ r, avgCpl }: { r: { spend: number; leads: number; mql: number; sql: number; opp: number; won: number; impressions: number; clicks: number; cpl: number; cmql: number; csql: number; copp: number; cpw: number; ctr: number; cpc: number; cpm: number }; avgCpl: number }) {
  const cplColor = r.cpl > 0 && avgCpl > 0 ? (r.cpl <= avgCpl ? T.verde600 : T.destructive) : undefined;
  return (
    <>
      <td style={cellRightStyle}>{fmtMoney(r.spend)}</td>
      <td style={cellRightStyle}>{fmt(r.leads)}</td>
      <td style={{ ...cellRightStyle, color: cplColor, fontWeight: cplColor ? 600 : 400 }}>{r.cpl > 0 ? fmtMoney(r.cpl) : "—"}</td>
      <td style={cellRightStyle}>{fmt(r.mql)}</td>
      <td style={cellRightStyle}>{r.cmql > 0 ? fmtMoney(r.cmql) : "—"}</td>
      <td style={cellRightStyle}>{fmt(r.sql)}</td>
      <td style={cellRightStyle}>{r.csql > 0 ? fmtMoney(r.csql) : "—"}</td>
      <td style={cellRightStyle}>{fmt(r.opp)}</td>
      <td style={cellRightStyle}>{r.copp > 0 ? fmtMoney(r.copp) : "—"}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700, color: r.won > 0 ? T.verde600 : undefined }}>{fmt(r.won)}</td>
      <td style={cellRightStyle}>{r.cpw > 0 ? fmtMoney(r.cpw) : "—"}</td>
      <td style={cellRightStyle}>{fmt(r.impressions)}</td>
      <td style={cellRightStyle}>{fmt(r.clicks)}</td>
      <td style={cellRightStyle}>{fmtPctDirect(r.ctr)}</td>
      <td style={cellRightStyle}>{r.cpc > 0 ? fmtMoney(r.cpc) : "—"}</td>
      <td style={cellRightStyle}>{r.cpm > 0 ? fmtMoney(r.cpm) : "—"}</td>
    </>
  );
}

function HistoricoCampanhasSection() {
  const [histData, setHistData] = useState<HistoricoCampanhasData | null>(null);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CampSortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filtroEmp, setFiltroEmp] = useState("todos");
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

  // Filter ads, then aggregate
  const filteredAds = useMemo(() => {
    if (!histData) return [];
    let ads = histData.ads;
    if (filtroEmp !== "todos") ads = ads.filter(a => a.empreendimento === filtroEmp);
    return ads;
  }, [histData, filtroEmp]);

  const campaigns = useMemo(() => {
    const rows = aggregate(filteredAds, "campaignName");
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const aVal = a[sortKey as keyof AggRow];
      const bVal = b[sortKey as keyof AggRow];
      if (STRING_COLS.has(sortKey)) {
        return (String(aVal || "")).localeCompare(String(bVal || ""), "pt-BR") * dir;
      }
      return ((aVal as number) - (bVal as number)) * dir;
    });
  }, [filteredAds, sortKey, sortDir]);

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
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px", alignItems: "center" }}>
              <select value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)} style={selectStyle}>
                <option value="todos">Todos empreendimentos</option>
                {empreendimentos.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
              <span style={{ fontSize: "11px", color: T.cinza400, marginLeft: "auto" }}>
                {campaigns.length} campanhas | {filteredAds.length} ads | Gasto total: {fmtMoney(totals.spend)}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1600px" }}>
                <thead>
                  <tr>
                    <SortTh label="" col="name" align="left" minW={24} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Nome" col="name" align="left" minW={200} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Empreend." col="empreendimento" align="left" minW={120} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Gasto" col="spend" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Leads" col="leads" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CPL" col="cpl" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="MQL" col="mql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CMQL" col="cmql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="SQL" col="sql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CSQL" col="csql" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="OPP" col="opp" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="COPP" col="copp" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="WON" col="won" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CPW" col="cpw" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Impr." col="impressions" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Clicks" col="clicks" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CTR" col="ctr" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CPC" col="cpc" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CPM" col="cpm" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
                            {camp.name}
                            <span style={{ marginLeft: "6px", fontSize: "10px", fontWeight: 400, color: T.cinza400 }}>
                              ({camp.adCount} ads)
                            </span>
                          </td>
                          <td style={{ ...cellStyle, fontSize: "12px" }}>{camp.empreendimento}</td>
                          <MetricsCells r={camp} avgCpl={avgCpl} />
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
                                  {adset.name}
                                  <span style={{ marginLeft: "6px", fontSize: "10px", fontWeight: 400, color: T.cinza400 }}>
                                    ({adset.adCount} ads)
                                  </span>
                                </td>
                                <td style={cellStyle} />
                                <MetricsCells r={adset} avgCpl={avgCpl} />
                              </tr>

                              {/* Individual ad rows */}
                              {adsetOpen && adsetAds.map((ad) => (
                                <tr key={ad.adId} style={{ backgroundColor: "#FAFBFF" }}>
                                  <td style={{ ...cellStyle, width: "24px" }} />
                                  <td style={{ ...cellStyle, fontSize: "11px", fontWeight: 400, paddingLeft: "48px", color: T.cinza700 }} title={ad.adName}>
                                    {ad.adName}
                                    {ad.effectiveStatus === "PAUSED" && (
                                      <Tag color={T.cinza400}>Pausado</Tag>
                                    )}
                                  </td>
                                  <td style={cellStyle} />
                                  <MetricsCells r={ad} avgCpl={avgCpl} />
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
                    <MetricsCells r={totals} avgCpl={avgCpl} />
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

export function PlanejamentoView({ data, loading }: PlanejamentoViewProps) {
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

  const tc = data.totals.current;
  const th = data.totals.historical;

  // Ranking by historical efficiency
  const ranked = [...data.empreendimentos].sort((a, b) => {
    const scoreA = (a.efficiency === "high" ? 3 : a.efficiency === "medium" ? 2 : 1);
    const scoreB = (b.efficiency === "high" ? 3 : b.efficiency === "medium" ? 2 : 1);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (a.historical.cpw || Infinity) - (b.historical.cpw || Infinity);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary cards — mês atual vs histórico */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <SummaryCard label="Investimento Total" currentValue={tc.spend} histValue={th.spend} format="money" />
        <SummaryCard label="WON Total" currentValue={tc.won} histValue={th.won} format="number" />
        <SummaryCard label="CPW Médio" currentValue={tc.cpw} histValue={th.cpw} format="money" />
        <SummaryCard label="MQL→SQL" currentValue={tc.mqlToSql} histValue={th.mqlToSql} format="pct" />
        <SummaryCard label="SQL→OPP" currentValue={tc.sqlToOpp} histValue={th.sqlToOpp} format="pct" />
        <SummaryCard label="OPP→WON" currentValue={tc.oppToWon} histValue={th.oppToWon} format="pct" />
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
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: 0 }}>
            Conversão Histórica por Empreendimento
          </h3>
          <span style={{ fontSize: "10px", color: T.cinza400 }}>
            Total acumulado (últimos 12 meses)
          </span>
        </div>
        <div style={{ overflowX: "auto", marginTop: "10px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH>Empreendimento</TH>
                <TH right>MQL</TH>
                <TH right>SQL</TH>
                <TH right>OPP</TH>
                <TH right>WON</TH>
                <TH right>Invest.</TH>
                <TH right>CPW</TH>
                <TH right>MQL→SQL</TH>
                <TH right>SQL→OPP</TH>
                <TH right>OPP→WON</TH>
                <TH extraStyle={{ textAlign: "center" }}>Eficiência</TH>
                <TH extraStyle={{ textAlign: "center" }}>Ação</TH>
              </tr>
            </thead>
            <tbody>
              {data.empreendimentos.map((row) => (
                <HistEmpRow key={row.emp} row={row} />
              ))}
              <HistTotalsRow label="Total" m={th} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking de eficiência */}
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
          Ranking de Eficiência
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {ranked.map((row, i) => {
            const color = SQUAD_COLORS[row.squadId] || T.azul600;
            const effColors = { high: T.verde600, medium: T.laranja500, low: T.destructive };
            const maxOppToWon = Math.max(...data.empreendimentos.map(r => r.historical.oppToWon || 0.01));
            const barWidth = row.historical.oppToWon > 0
              ? Math.min((row.historical.oppToWon / maxOppToWon) * 100, 100)
              : 0;

            return (
              <div key={row.emp} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, width: "16px", textAlign: "right" }}>
                  {i + 1}
                </span>
                <div style={{ width: "3px", height: "20px", borderRadius: "2px", backgroundColor: color }} />
                <span style={{ fontSize: "12px", fontWeight: 500, color: T.fg, width: "180px" }}>
                  {row.emp.replace(" Spot", "")}
                </span>
                <div style={{ flex: 1, height: "18px", backgroundColor: T.cinza50, borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(barWidth, 1)}%`,
                      height: "100%",
                      backgroundColor: effColors[row.efficiency],
                      borderRadius: "4px",
                      opacity: 0.7,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, width: "50px", textAlign: "right" }}>
                  {fmtPct(row.historical.oppToWon)}
                </span>
                <div style={{ width: "80px" }}>
                  <RecommendationTag row={row} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico de Campanhas — collapsible, lazy load */}
      <HistoricoCampanhasSection />
    </div>
  );
}
