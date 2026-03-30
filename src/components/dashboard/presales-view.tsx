"use client";

import { useState, useMemo } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { ModuleConfig } from "@/lib/modules";
import type { PresalesData, PresellerSummary } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: PresalesData | null;
  loading: boolean;
  moduleConfig: ModuleConfig;
  lastUpdated?: Date | null;
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h${min}` : `${h}h`;
}

function statusColor(minutes: number | null): string {
  if (minutes == null) return T.cinza400;
  if (minutes <= 30) return "#16a34a";
  if (minutes <= 60) return "#d97706";
  return "#dc2626";
}

function statusBg(minutes: number | null): string {
  if (minutes == null) return "#f3f4f6";
  if (minutes <= 30) return "#dcfce7";
  if (minutes <= 60) return "#fef3c7";
  return "#fee2e2";
}

// Degradê amarelo (#facc15) → vermelho (#dc2626) proporcional ao tempo (0–1080min = 18h)
function gradientColor(minutes: number | null): { bg: string; fg: string } {
  if (minutes == null) return { bg: "#f3f4f6", fg: "#9ca3af" };
  const t = Math.min(Math.max(minutes / 1080, 0), 1);
  const r = Math.round(250 + (220 - 250) * t);
  const g = Math.round(204 + (38 - 204) * t);
  const b = Math.round(21 + (38 - 21) * t);
  const bgR = Math.round(255 + (254 - 255) * t);
  const bgG = Math.round(251 + (226 - 251) * t);
  const bgB = Math.round(235 + (226 - 235) * t);
  return { bg: `rgb(${bgR},${bgG},${bgB})`, fg: `rgb(${r},${g},${b})` };
}

function statusLabel(minutes: number | null): string {
  if (minutes == null) return "Pendente";
  if (minutes <= 30) return "Rápido";
  if (minutes <= 60) return "Aceitável";
  return "Lento";
}

// Legacy SZI fallback — overridden by moduleConfig.presellers at runtime

export function PresalesView({ data, loading, moduleConfig, lastUpdated }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados de pré-venda...
      </div>
    );
  }

  if (!data || data.totals.totalDeals === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Nenhum dado de pré-venda disponível.
      </div>
    );
  }

  const { presellers, recentDeals, totals } = data;

  // Filtros e ordenação da tabela de deals
  const [filtroPV, setFiltroPV] = useState("todos");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  type DealSortKey = "deal_title" | "preseller_name" | "deal_add_time" | "transbordo_at" | "last_mia_at" | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<DealSortKey>("transbordo_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: DealSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const pvNames = useMemo(() => {
    const names = new Set(recentDeals.map((d) => d.preseller_name));
    return Array.from(names).sort();
  }, [recentDeals]);

  const filteredDeals = useMemo(() => {
    let list = recentDeals;
    if (filtroPV !== "todos") list = list.filter((d) => d.preseller_name === filtroPV);
    if (filtroDe) {
      const de = new Date(filtroDe + "T00:00:00");
      list = list.filter((d) => new Date(d.transbordo_at) >= de);
    }
    if (filtroAte) {
      const ate = new Date(filtroAte + "T23:59:59");
      list = list.filter((d) => new Date(d.transbordo_at) <= ate);
    }
    return [...list].sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "status") {
        va = a.first_action_at == null ? Infinity : (a.response_time_minutes ?? 0);
        vb = b.first_action_at == null ? Infinity : (b.response_time_minutes ?? 0);
      } else {
        va = (a as unknown as Record<string, string>)[sortKey] ?? "";
        vb = (b as unknown as Record<string, string>)[sortKey] ?? "";
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [recentDeals, filtroPV, filtroDe, filtroAte, sortKey, sortDir]);
  const pvOrder = moduleConfig.presellers;
  const mainPVs = pvOrder.length > 0
    ? pvOrder
        .map((n) => presellers.find((p) => p.name === n))
        .filter((p): p is PresellerSummary => p != null)
    : presellers;

  return (
    <>
      {/* Summary pills */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "stretch" }}>
        <SummaryPill
          label="Média Tempo de Resposta"
          value={formatMinutes(totals.medianMinutes)}
          color={statusColor(totals.medianMinutes)}
          bg={statusBg(totals.medianMinutes)}
        />
        <SummaryPill label="Deals Open" value={String(totals.totalDeals)} color={T.azul600} bg={T.azul50} />
        <SummaryPill
          label="≤30min"
          value={`${totals.pctSub30}%`}
          color={totals.pctSub30 >= 70 ? "#16a34a" : totals.pctSub30 >= 40 ? "#d97706" : "#dc2626"}
          bg={totals.pctSub30 >= 70 ? "#dcfce7" : totals.pctSub30 >= 40 ? "#fef3c7" : "#fee2e2"}
        />
        <SummaryPill label="Pendentes" value={`${totals.dealsPendentes} (${totals.totalDeals > 0 ? Math.round((totals.dealsPendentes / totals.totalDeals) * 100) : 0}%)`} color="#dc2626" bg="#fee2e2" />
        <CalcDisclaimer />
      </div>

      {/* Tabela PVs */}
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8f8fa" }}>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Tempo de Resposta Após Transbordo</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 80 }}>Tempo de Resposta</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 60 }}>≤30min</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 50 }}>Total</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 70 }}>Com Ligação</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 60 }}>Pendentes</th>
            </tr>
          </thead>
          <tbody>
            {mainPVs.map((ps) => {
              const squad = moduleConfig.squads.find((s) => s.preVenda === ps.name);
              const sqColor = ps.squadId ? SQUAD_COLORS[ps.squadId] || T.azul600 : T.cinza600;
              const barColor = ps.pctSub30 >= 70 ? "#16a34a" : ps.pctSub30 >= 40 ? "#d97706" : "#dc2626";
              const pendColor = ps.dealsPendentes > 5 ? "#dc2626" : ps.dealsPendentes > 0 ? "#d97706" : T.cinza400;
              return (
                <tr key={ps.name}>
                  <td style={{ ...tdStyle, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sqColor, flexShrink: 0 }} />
                    <span>
                      <span style={{ fontWeight: 600 }}>{ps.name}</span>
                      {squad && <span style={{ color: T.cinza400, fontSize: "11px", marginLeft: "6px" }}>{squad.name}</span>}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {(() => {
                      const gc = gradientColor(ps.medianMinutes);
                      return (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: "10px",
                            fontSize: "12px",
                            fontWeight: 700,
                            backgroundColor: gc.bg,
                            color: gc.fg,
                          }}
                        >
                          {formatMinutes(ps.medianMinutes)}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600, color: barColor }}>{ps.pctSub30}%</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{ps.totalDeals}</td>
                  <td style={{ ...tdStyle, textAlign: "center", color: "#16a34a", fontWeight: 600 }}>
                    {ps.dealsComAcao}
                    <span style={{ fontSize: "11px", fontWeight: 400, color: T.cinza400, marginLeft: "4px" }}>
                      ({ps.totalDeals > 0 ? Math.round((ps.dealsComAcao / ps.totalDeals) * 100) : 0}%)
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", color: pendColor, fontWeight: 600 }}>
                    {ps.dealsPendentes}
                    <span style={{ fontSize: "11px", fontWeight: 400, color: T.cinza400, marginLeft: "4px" }}>
                      ({ps.totalDeals > 0 ? Math.round((ps.dealsPendentes / ps.totalDeals) * 100) : 0}%)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tabela deals recentes */}
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Deals Recentes
      </h3>
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={filtroPV}
          onChange={(e) => setFiltroPV(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "12px", padding: "6px 10px", color: T.cinza700, background: T.card }}
        >
          <option value="todos">Todos Pré-Vendedores</option>
          {pvNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label style={{ fontSize: "11px", color: T.cinza600, display: "flex", alignItems: "center", gap: "4px" }}>
          De
          <input type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "12px", padding: "5px 8px", color: T.cinza700 }} />
        </label>
        <label style={{ fontSize: "11px", color: T.cinza600, display: "flex", alignItems: "center", gap: "4px" }}>
          Até
          <input type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "12px", padding: "5px 8px", color: T.cinza700 }} />
        </label>
        {(filtroPV !== "todos" || filtroDe || filtroAte) && (
          <button
            onClick={() => { setFiltroPV("todos"); setFiltroDe(""); setFiltroAte(""); }}
            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "11px", padding: "5px 10px", cursor: "pointer", color: T.cinza600 }}
          >
            Limpar
          </button>
        )}
      </div>
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8f8fa" }}>
              <DealSortTh label="Deal" col="deal_title" align="left" minW={180} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <DealSortTh label="Pré-Vendedor" col="preseller_name" align="left" minW={130} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <DealSortTh label="Criação Deal" col="deal_add_time" align="left" minW={120} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <DealSortTh label="Transbordo" col="transbordo_at" align="left" minW={120} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <DealSortTh label="Última MIA" col="last_mia_at" align="left" minW={120} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <DealSortTh label="Tempo Resp." col="status" align="center" minW={100} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <DealSortTh label="Status" col="status" align="center" minW={80} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {filteredDeals.map((d) => {
              const isPending = d.first_action_at == null;
              const mins = d.response_time_minutes;
              return (
                <tr
                  key={d.deal_id}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f8fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                >
                  <td style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                    <a
                      href={`https://seazone-fd92b9.pipedrive.com/deal/${d.deal_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: T.azul600, textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      {d.deal_title}
                    </a>
                  </td>
                  <td style={tdStyle}>{d.preseller_name}</td>
                  <td style={{ ...tdStyle, fontSize: "12px", color: T.cinza700 }}>
                    {d.deal_add_time ? formatDate(d.deal_add_time) : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "12px", color: T.cinza700 }}>{formatDate(d.transbordo_at)}</td>
                  <td style={{ ...tdStyle, fontSize: "12px", color: T.cinza700 }}>
                    {d.last_mia_at ? formatDate(d.last_mia_at) : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {(() => {
                      const gc = gradientColor(mins);
                      return (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: "10px",
                            fontSize: "12px",
                            fontWeight: 700,
                            backgroundColor: isPending ? "#f3f4f6" : gc.bg,
                            color: isPending ? T.cinza400 : gc.fg,
                          }}
                        >
                          {mins != null ? formatMinutes(mins) : "—"}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: isPending ? "#f3f4f6" : statusBg(mins),
                        color: isPending ? T.cinza400 : statusColor(mins),
                      }}
                    >
                      {isPending ? "Pendente" : statusLabel(mins)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </>
  );
}

// --- Disclaimer regras do cálculo ---
function CalcDisclaimer() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginLeft: "auto", alignSelf: "center", position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none",
          border: `1px solid ${T.border}`,
          borderRadius: "8px",
          padding: "6px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          color: T.cinza600,
        }}
      >
        <span style={{ fontSize: "13px" }}>i</span>
        Regras do cálculo
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "6px",
            width: "360px",
            backgroundColor: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: "10px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "14px 16px",
            zIndex: 100,
            fontSize: "12px",
            color: T.cinza700,
            lineHeight: "1.5",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "8px", color: T.fg, fontSize: "13px" }}>Como a mediana é calculada</div>
          <ol style={{ margin: 0, paddingLeft: "18px" }}>
            <li style={{ marginBottom: "4px" }}>Horário útil: 8h-18h seg-sex (almoço 12h-13h descontado)</li>
            <li style={{ marginBottom: "4px" }}>Transbordo fora do expediente: conta a partir do próximo horário útil</li>
            <li style={{ marginBottom: "4px" }}><strong>Mediana base</strong> = deals COM ligação (tempo definitivo)</li>
            <li style={{ marginBottom: "4px" }}>Pendentes só entram se tempo de espera &gt; mediana base</li>
            <li>Deals do FDS/fora de horário com 0 min nunca entram no cálculo</li>
          </ol>
          <div style={{ marginTop: "10px", fontSize: "10px", color: T.cinza400 }}>
            Últimos 30 dias · Pendentes usam now - transbordo
          </div>
        </div>
      )}
    </div>
  );
}


// --- Summary pill ---
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
};

type DealSortKeyType = "deal_title" | "preseller_name" | "deal_add_time" | "transbordo_at" | "last_mia_at" | "status";
type SortDirType = "asc" | "desc";

function DealSortTh({ label, col, align, minW, sortKey, sortDir, onSort }: {
  label: string; col: DealSortKeyType; align: "left" | "right" | "center"; minW?: number;
  sortKey: DealSortKeyType; sortDir: SortDirType; onSort: (k: DealSortKeyType) => void;
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
