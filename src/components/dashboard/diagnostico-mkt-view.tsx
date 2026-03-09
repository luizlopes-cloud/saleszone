"use client";

import { useState, useMemo, Fragment } from "react";
import { T, SQUAD_COLORS, SQUADS } from "@/lib/constants";
import type { CampanhasData, MetaAdRow, CampanhasEmpSummary } from "@/lib/types";

interface Props {
  data: CampanhasData | null;
  loading: boolean;
}

function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(v: number): string {
  return `${v.toFixed(2)}%`;
}

const META_ADS_ACCOUNT = "205286032338340";
function metaAdLink(adId: string): string {
  return `https://www.facebook.com/adsmanager/manage/ads?act=${META_ADS_ACCOUNT}&selected_ad_ids=${adId}`;
}

const SEV_ORDER: Record<string, number> = { CRITICO: 0, ALERTA: 1, OK: 2 };

type SortKey = "empreendimento" | "ad_name" | "spend" | "ctr" | "frequency" | "severidade" | "squad_id";
type SortDir = "asc" | "desc";

const SEV_COLORS = {
  CRITICO: { border: T.destructive, bg: "#FEF2F2", text: T.destructive, cardBg: "#DC2626" },
  ALERTA: { border: T.laranja500, bg: "#FFFBEB", text: "#92400E", cardBg: "#F59E0B" },
  OK: { border: T.verde600, bg: T.verde50, text: T.verde700, cardBg: T.verde600 },
} as const;

export function DiagnosticoMktView({ data, loading }: Props) {
  const [filtroEmp, setFiltroEmp] = useState("todos");
  const [filtroSev, setFiltroSev] = useState("todos");
  const [filtroSquad, setFiltroSquad] = useState("todos");
  const [sortKey, setSortKey] = useState<SortKey>("severidade");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "severidade" ? "asc" : "desc");
    }
  };

  // Flatten all ads with diagnostico for the full table
  const allAds = useMemo(() => {
    if (!data) return [];
    const ads: MetaAdRow[] = [];
    for (const sq of data.squads) {
      for (const emp of sq.empreendimentos) {
        if (emp.adsDetail) {
          for (const ad of emp.adsDetail) {
            ads.push(ad);
          }
        }
      }
    }
    return ads;
  }, [data]);

  // Unique empreendimentos for filter
  const empOptions = useMemo(() => {
    const set = new Set(allAds.map((a) => a.empreendimento));
    return Array.from(set).sort();
  }, [allAds]);

  // Filtered + sorted ads
  const filteredAds = useMemo(() => {
    const filtered = allAds.filter((ad) => {
      if (filtroEmp !== "todos" && ad.empreendimento !== filtroEmp) return false;
      if (filtroSev !== "todos" && ad.severidade !== filtroSev) return false;
      if (filtroSquad !== "todos" && String(ad.squad_id) !== filtroSquad) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "severidade":
          cmp = (SEV_ORDER[a.severidade] ?? 2) - (SEV_ORDER[b.severidade] ?? 2);
          if (cmp === 0) cmp = b.spend - a.spend;
          break;
        case "empreendimento":
        case "ad_name":
          cmp = a[sortKey].localeCompare(b[sortKey], "pt-BR");
          break;
        case "spend":
        case "ctr":
        case "frequency":
        case "squad_id":
          cmp = a[sortKey] - b[sortKey];
          break;
      }
      return cmp * dir;
    });
  }, [allAds, filtroEmp, filtroSev, filtroSquad, sortKey, sortDir]);

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando diagnósticos...
      </div>
    );
  }

  if (!data || data.summary.totalAds === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Nenhum dado disponível. Execute o sync primeiro.
      </div>
    );
  }

  const { summary, top10 } = data;
  const okCount = summary.totalAds - summary.criticos - summary.alertas;

  return (
    <>
      {/* Summary pills — 3 cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <SummaryCard
          label="Total Ads"
          value={String(summary.totalAds)}
          sub={`${okCount} OK`}
          color={T.azul600}
        />
        <SummaryCard
          label="Críticos"
          value={String(summary.criticos)}
          sub="Requerem ação imediata"
          color="#FFF"
          bgColor={T.destructive}
        />
        <SummaryCard
          label="Alertas"
          value={String(summary.alertas)}
          sub="Monitorar de perto"
          color="#FFF"
          bgColor={T.laranja500}
        />
      </div>

      {/* Resumo por Empreendimento — agrupado por Squad */}
      <Section title="Resumo por Empreendimento">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left" }}>Empreendimento</th>
              <th style={{ ...thStyle, textAlign: "right", width: 70 }}>Ads</th>
              <th style={{ ...thStyle, textAlign: "right", width: 70, color: T.destructive }}>Críticos</th>
              <th style={{ ...thStyle, textAlign: "right", width: 70, color: T.laranja500 }}>Alertas</th>
              <th style={{ ...thStyle, textAlign: "right", width: 70, color: T.verde600 }}>OK</th>
            </tr>
          </thead>
          <tbody>
            {data.squads.map((sq) => {
              const emps = sq.empreendimentos.filter((e) => e.ads > 0).sort((a, b) => b.criticos - a.criticos || b.alertas - a.alertas);
              if (emps.length === 0) return null;
              const sqCriticos = emps.reduce((s, e) => s + e.criticos, 0);
              const sqAlertas = emps.reduce((s, e) => s + e.alertas, 0);
              const sqColor = SQUAD_COLORS[sq.id] || T.cinza600;
              return (
                <Fragment key={sq.id}>
                  <tr>
                    <td colSpan={5} style={{ backgroundColor: sqColor, color: "#FFF", padding: "8px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>{sq.name}</span>
                        {sqCriticos > 0 && (
                          <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.25)", padding: "2px 8px", borderRadius: "9999px" }}>
                            {sqCriticos} crítico{sqCriticos > 1 ? "s" : ""}
                          </span>
                        )}
                        {sqAlertas > 0 && (
                          <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "9999px" }}>
                            {sqAlertas} alerta{sqAlertas > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {emps.map((emp) => {
                    const ok = emp.ads - emp.criticos - emp.alertas;
                    return (
                      <tr
                        key={emp.emp}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                      >
                        <td style={{ ...tdStyle }}>{emp.emp}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{emp.ads}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: emp.criticos > 0 ? T.destructive : T.cinza300, fontWeight: emp.criticos > 0 ? 700 : 400 }}>
                          {emp.criticos}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: emp.alertas > 0 ? T.laranja500 : T.cinza300, fontWeight: emp.alertas > 0 ? 700 : 400 }}>
                          {emp.alertas}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: ok > 0 ? T.verde600 : T.cinza300 }}>
                          {ok}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Top 12 — Ação Imediata */}
      {top10.length > 0 && (
        <Section title={`Top ${top10.length} — Ação Imediata`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", padding: "12px" }}>
            {top10.map((ad) => {
              const sev = SEV_COLORS[ad.severidade] || SEV_COLORS.OK;
              const diagnosticos = ad.diagnostico ? ad.diagnostico.split(" | ") : [];
              return (
                <div
                  key={ad.ad_id}
                  style={{
                    backgroundColor: sev.cardBg,
                    borderRadius: "10px",
                    borderTop: `4px solid ${SQUAD_COLORS[ad.squad_id] || T.cinza600}`,
                    padding: "14px 16px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                    color: "#FFF",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    overflow: "hidden",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 600,
                        backgroundColor: SQUAD_COLORS[ad.squad_id] || T.cinza600,
                        color: "#FFF",
                        padding: "1px 6px",
                        borderRadius: "9999px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {SQUADS.find((s) => s.id === ad.squad_id)?.name || "—"}
                    </span>
                    <span style={{ fontSize: "11px", opacity: 0.85, flex: 1 }}>{ad.empreendimento}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        backgroundColor: "rgba(255,255,255,0.25)",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ad.severidade}
                    </span>
                  </div>
                  {/* Ad name */}
                  <div
                    style={{ fontSize: "13px", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                    title={ad.ad_name}
                  >
                    {ad.ad_name}
                  </div>
                  {/* Diagnósticos */}
                  {diagnosticos.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                      {diagnosticos.map((d, i) => (
                        <div key={i} style={{ fontSize: "11px", opacity: 0.9, lineHeight: 1.4 }}>
                          • {d.trim()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Tabela Completa */}
      <Section title="Todos os Ads">
        {/* Filtros */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap", padding: "12px 16px 0" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: T.cinza700 }}>
            Empreendimento
            <select
              value={filtroEmp}
              onChange={(e) => setFiltroEmp(e.target.value)}
              style={selectStyle}
            >
              <option value="todos">Todos</option>
              {empOptions.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: T.cinza700 }}>
            Severidade
            <select
              value={filtroSev}
              onChange={(e) => setFiltroSev(e.target.value)}
              style={selectStyle}
            >
              <option value="todos">Todos</option>
              <option value="CRITICO">Crítico</option>
              <option value="ALERTA">Alerta</option>
              <option value="OK">OK</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: T.cinza700 }}>
            Squad
            <select
              value={filtroSquad}
              onChange={(e) => setFiltroSquad(e.target.value)}
              style={selectStyle}
            >
              <option value="todos">Todos</option>
              {SQUADS.map((sq) => (
                <option key={sq.id} value={String(sq.id)}>{sq.name}</option>
              ))}
            </select>
          </label>
          <span style={{ fontSize: "11px", color: T.cinza400, alignSelf: "center" }}>
            {filteredAds.length} ads
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
            <thead>
              <tr>
                <SortTh label="Squad" col="squad_id" align="left" minW={60} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Empreendimento" col="empreendimento" align="left" minW={130} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Ad" col="ad_name" align="left" minW={180} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Gasto" col="spend" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="CTR" col="ctr" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Freq" col="frequency" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Severidade" col="severidade" align="center" minW={60} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th style={{ ...thStyle, textAlign: "left", minWidth: 200 }}>Diagnóstico</th>
                <th style={{ ...thStyle, textAlign: "center", minWidth: 30 }} title="Abrir no Meta Ads">Link</th>
              </tr>
            </thead>
            <tbody>
              {filteredAds.map((ad) => {
                const sev = SEV_COLORS[ad.severidade] || SEV_COLORS.OK;
                return (
                  <tr
                    key={ad.ad_id}
                    style={{ backgroundColor: ad.severidade === "CRITICO" ? "#FEF2F2" : ad.severidade === "ALERTA" ? "#FFFBEB" : "" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <td style={{ ...tdStyle, fontSize: "12px", borderLeft: `3px solid ${SQUAD_COLORS[ad.squad_id] || T.cinza300}` }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "#FFF",
                          backgroundColor: SQUAD_COLORS[ad.squad_id] || T.cinza600,
                          padding: "2px 7px",
                          borderRadius: "9999px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {SQUADS.find((s) => s.id === ad.squad_id)?.name?.replace("Squad ", "Sq ") || "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "12px" }}>{ad.empreendimento}</td>
                    <td style={{ ...tdStyle, fontSize: "12px", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }} title={ad.ad_name}>
                      {ad.ad_name}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>{formatBRL(ad.spend)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>{pct(ad.ctr)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>{ad.frequency.toFixed(1)}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: sev.text,
                          backgroundColor: sev.bg,
                          padding: "2px 7px",
                          borderRadius: "9999px",
                          textTransform: "uppercase",
                        }}
                      >
                        {ad.severidade}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "11px", color: T.cinza700, whiteSpace: "normal", lineHeight: 1.4 }}>
                      {ad.diagnostico || "-"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <a
                        href={metaAdLink(ad.ad_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver no Meta Ads Manager"
                        style={{ color: T.azul600, fontSize: "14px", textDecoration: "none" }}
                      >
                        &#8599;
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

/* ---- Subcomponents ---- */

function SummaryCard({ label, value, sub, color, bgColor }: { label: string; value: string; sub: string; color: string; bgColor?: string }) {
  return (
    <div
      style={{
        backgroundColor: bgColor || "#FFF",
        border: bgColor ? "none" : "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "14px 20px",
        minWidth: "180px",
        flex: "1 1 180px",
        boxShadow: bgColor ? "0 2px 8px rgba(0,0,0,0.15)" : "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: "10px", fontWeight: 500, color: bgColor ? "rgba(255,255,255,0.8)" : T.cinza600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "22px", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", color: bgColor ? "rgba(255,255,255,0.7)" : T.cinza400, marginTop: "2px" }}>{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        marginBottom: "16px",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E6E7EA" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: T.fg }}>{title}</span>
      </div>
      <div style={{ padding: "0" }}>{children}</div>
    </div>
  );
}

function SortTh({ label, col, align, minW, sortKey, sortDir, onSort }: {
  label: string; col: SortKey; align: "left" | "right" | "center"; minW?: number;
  sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  const arrow = active ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";
  return (
    <th
      style={{ ...thStyle, textAlign: align, minWidth: minW, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(col)}
    >
      {label}{arrow}
    </th>
  );
}

/* ---- Styles ---- */

const thStyle: React.CSSProperties = {
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

const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: "6px",
  border: "1px solid #E6E7EA",
  fontSize: "12px",
  color: "#141A3C",
  backgroundColor: "#FFF",
  cursor: "pointer",
};
