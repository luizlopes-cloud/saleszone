"use client";

import { useState, useMemo } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { ModuleConfig } from "@/lib/modules";
import type { DiagVendasData, DiagVendasDealRow, DiagVendasCloserSummary, VendasSeveridade } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: DiagVendasData | null;
  loading: boolean;
  moduleConfig: ModuleConfig;
  lastUpdated?: Date | null;
}

const SEV_COLORS: Record<VendasSeveridade, { border: string; bg: string; text: string }> = {
  CRITICO: { border: "#E7000B", bg: "#FEF2F2", text: "#E7000B" },
  ALERTA: { border: "#FF6900", bg: "#FFFBEB", text: "#92400E" },
  OK: { border: "#5EA500", bg: "#F0FDF4", text: "#15803D" },
};

const STAGE_NAMES: Record<number, string> = {
  1: "FUP Parceiro", 2: "Lead in", 3: "Contatados", 4: "Qualificação", 5: "Qualificado",
  6: "Aguardando data", 7: "Agendado", 8: "No Show/Reagendamento", 9: "Reunião/OPP",
  10: "FUP", 11: "Negociação", 12: "Fila de espera", 13: "Reservas", 14: "Contrato",
};

function formatLeadtime(hours: number): string {
  if (hours < 12) return "<12h";
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days === 0) return `${h}h`;
  if (h === 0) return `${days}d`;
  return `${days}d ${h}h`;
}

type DealSortKey = "title" | "owner_name" | "empreendimento" | "stage_order" | "last_activity_date" | "next_activity_date" | "leadtime_hours" | "severidade";
type CloserSortKey = "name" | "squadId" | "totalDeals" | "avgLeadtimeHours" | "maxLeadtimeHours" | "criticos" | "alertas" | "ok" | "semAtividadeFutura" | "atividadeAtrasada" | "severidade";
type SortDir = "asc" | "desc";

const SEV_ORDER: Record<string, number> = { CRITICO: 0, ALERTA: 1, OK: 2 };

export function DiagnosticoVendasView({ data, loading, moduleConfig, lastUpdated }: Props) {
  const isSZS = moduleConfig?.id === "szs";
  const [filtroSquad, setFiltroSquad] = useState("todos");
  const [filtroCloser, setFiltroCloser] = useState("todos");
  const [filtroSev, setFiltroSev] = useState("todos");
  const [filtroStage, setFiltroStage] = useState("todos");
  const [filtroAtividade, setFiltroAtividade] = useState("todos");

  const [dealSort, setDealSort] = useState<DealSortKey>("leadtime_hours");
  const [dealDir, setDealDir] = useState<SortDir>("desc");
  const [closerSort, setCloserSort] = useState<CloserSortKey>("avgLeadtimeHours");
  const [closerDir, setCloserDir] = useState<SortDir>("desc");

  const toggleDealSort = (key: DealSortKey) => {
    if (dealSort === key) setDealDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setDealSort(key); setDealDir(key === "severidade" ? "asc" : "desc"); }
  };

  const toggleCloserSort = (key: CloserSortKey) => {
    if (closerSort === key) setCloserDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setCloserSort(key); setCloserDir(key === "severidade" ? "asc" : "desc"); }
  };

  // Closers for filter dropdown
  const closerOptions = useMemo(() => {
    if (!data) return [];
    return data.closers.map((c) => c.name).sort();
  }, [data]);

  // Stages present in data
  const stageOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.deals.map((d) => d.stage_order));
    return Array.from(set).sort((a, b) => a - b);
  }, [data]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    if (!data) return [];
    return data.deals.filter((d) => {
      if (filtroSquad !== "todos") {
        const closerSquad = data.closers.find((c) => c.name === d.owner_name)?.squadId;
        if (String(closerSquad) !== filtroSquad) return false;
      }
      if (filtroCloser !== "todos" && d.owner_name !== filtroCloser) return false;
      if (filtroSev !== "todos" && d.severidade !== filtroSev) return false;
      if (filtroStage !== "todos" && String(d.stage_order) !== filtroStage) return false;
      if (filtroAtividade === "sem-futura" && !d.sem_atividade_futura) return false;
      if (filtroAtividade === "atrasada" && !d.atividade_atrasada) return false;
      return true;
    }).sort((a, b) => {
      let cmp = 0;
      const dir = dealDir === "asc" ? 1 : -1;
      switch (dealSort) {
        case "severidade":
          cmp = (SEV_ORDER[a.severidade] ?? 2) - (SEV_ORDER[b.severidade] ?? 2);
          if (cmp === 0) cmp = b.leadtime_hours - a.leadtime_hours;
          break;
        case "title":
        case "owner_name":
        case "empreendimento":
          cmp = (a[dealSort] || "").localeCompare(b[dealSort] || "", "pt-BR");
          break;
        case "last_activity_date":
          cmp = (a.last_activity_date || "").localeCompare(b.last_activity_date || "");
          break;
        case "next_activity_date":
          cmp = (a.next_activity_date || "").localeCompare(b.next_activity_date || "");
          break;
        default:
          cmp = (a[dealSort] as number) - (b[dealSort] as number);
      }
      return cmp * dir;
    });
  }, [data, filtroSquad, filtroCloser, filtroSev, filtroStage, filtroAtividade, dealSort, dealDir]);

  // Filter closers
  const filteredClosers = useMemo(() => {
    if (!data) return [];
    return data.closers.filter((c) => {
      if (filtroSquad !== "todos" && String(c.squadId) !== filtroSquad) return false;
      return true;
    }).sort((a, b) => {
      let cmp = 0;
      const dir = closerDir === "asc" ? 1 : -1;
      switch (closerSort) {
        case "severidade":
          cmp = (SEV_ORDER[a.severidade] ?? 2) - (SEV_ORDER[b.severidade] ?? 2);
          if (cmp === 0) cmp = b.avgLeadtimeHours - a.avgLeadtimeHours;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name, "pt-BR");
          break;
        default:
          cmp = (a[closerSort] as number) - (b[closerSort] as number);
      }
      return cmp * dir;
    });
  }, [data, filtroSquad, closerSort, closerDir]);

  if (loading && !data) {
    return <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>Carregando diagnóstico vendas...</div>;
  }

  if (!data || data.totals.totalDeals === 0) {
    return <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>Nenhum dado disponível. Execute o sync primeiro.</div>;
  }

  const { totals } = data;

  return (
    <>
      {/* Summary Cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <SummaryCard label="Deals Abertos" value={String(totals.totalDeals)} sub="Total dos closers" color={T.azul600} />
        <SummaryCard label="Leadtime Médio" value={formatLeadtime(totals.avgLeadtimeHours)} sub="Desde última atividade" color={T.fg} />
        <SummaryCard label="Críticos" value={String(totals.criticos)} sub=">= 24h sem atividade" color="#FFF" bgColor="#E7000B" />
        <SummaryCard label="Alertas" value={String(totals.alertas)} sub=">= 12h sem atividade" color="#FFF" bgColor="#FF6900" />
        <SummaryCard label="Sem Atividade Futura" value={String(totals.semAtividadeFutura)} sub="Nenhuma atividade agendada" color="#FFF" bgColor={T.cinza700} />
        <SummaryCard label="Atividades Atrasadas" value={String(totals.atividadeAtrasada)} sub="Próx. atividade no passado" color="#FFF" bgColor={T.roxo600} />
      </div>

      {/* Ranking de Closers */}
      <Section title="Ranking de Closers">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <SortTh label="Closer" col="name" align="left" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label={isSZS ? "Canal" : "Squad"} col="squadId" align="center" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Deals" col="totalDeals" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Leadtime Médio" col="avgLeadtimeHours" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Leadtime Máx" col="maxLeadtimeHours" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Críticos" col="criticos" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Alertas" col="alertas" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="OK" col="ok" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Sem Futura" col="semAtividadeFutura" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Atrasadas" col="atividadeAtrasada" align="right" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
                <SortTh label="Severidade" col="severidade" align="center" sortKey={closerSort} sortDir={closerDir} onSort={toggleCloserSort} />
              </tr>
            </thead>
            <tbody>
              {filteredClosers.map((c) => {
                const sev = SEV_COLORS[c.severidade];
                return (
                  <tr
                    key={c.name}
                    style={{ backgroundColor: sev.bg }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 600, color: "#FFF",
                        backgroundColor: SQUAD_COLORS[c.squadId] || T.cinza600,
                        padding: "2px 7px", borderRadius: "9999px",
                      }}>
                        {moduleConfig.squads.find((s) => s.id === c.squadId)?.name || "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{c.totalDeals}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatLeadtime(c.avgLeadtimeHours)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{formatLeadtime(c.maxLeadtimeHours)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: c.criticos > 0 ? "#E7000B" : T.cinza300, fontWeight: c.criticos > 0 ? 700 : 400 }}>{c.criticos}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: c.alertas > 0 ? "#FF6900" : T.cinza300, fontWeight: c.alertas > 0 ? 700 : 400 }}>{c.alertas}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: c.ok > 0 ? "#5EA500" : T.cinza300 }}>{c.ok}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: c.semAtividadeFutura > 0 ? T.cinza700 : T.cinza300, fontWeight: c.semAtividadeFutura > 0 ? 700 : 400 }}>{c.semAtividadeFutura}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: c.atividadeAtrasada > 0 ? T.roxo600 : T.cinza300, fontWeight: c.atividadeAtrasada > 0 ? 700 : 400 }}>{c.atividadeAtrasada}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <SevBadge sev={c.severidade} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Filtros + Tabela de Deals */}
      <Section title="Deals Abertos">
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap", padding: "12px 16px 0" }}>
          <FilterSelect label={isSZS ? "Canal" : "Squad"} value={filtroSquad} onChange={setFiltroSquad}
            options={[{ value: "todos", label: "Todos" }, ...moduleConfig.squads.map((s) => ({ value: String(s.id), label: s.name }))]} />
          <FilterSelect label="Closer" value={filtroCloser} onChange={setFiltroCloser}
            options={[{ value: "todos", label: "Todos" }, ...closerOptions.map((n) => ({ value: n, label: n }))]} />
          <FilterSelect label="Severidade" value={filtroSev} onChange={setFiltroSev}
            options={[{ value: "todos", label: "Todos" }, { value: "CRITICO", label: "Crítico" }, { value: "ALERTA", label: "Alerta" }, { value: "OK", label: "OK" }]} />
          <FilterSelect label="Etapa" value={filtroStage} onChange={setFiltroStage}
            options={[{ value: "todos", label: "Todas" }, ...stageOptions.map((o) => ({ value: String(o), label: STAGE_NAMES[o] || `Stage ${o}` }))]} />
          <FilterSelect label="Atividade" value={filtroAtividade} onChange={setFiltroAtividade}
            options={[{ value: "todos", label: "Todas" }, { value: "sem-futura", label: "Sem atividade futura" }, { value: "atrasada", label: "Atividade atrasada" }]} />
          <span style={{ fontSize: "11px", color: T.cinza400, alignSelf: "center" }}>
            {filteredDeals.length} deals
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead>
              <tr>
                <SortTh label="Deal" col="title" align="left" minW={200} sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
                <SortTh label="Closer" col="owner_name" align="left" sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
                <SortTh label={isSZS ? "Cidade" : "Empreendimento"} col="empreendimento" align="left" sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
                <SortTh label="Etapa" col="stage_order" align="left" sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
                <SortTh label="Última Atividade" col="last_activity_date" align="center" sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
                <SortTh label="Próx. Atividade" col="next_activity_date" align="center" sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
                <SortTh label="Leadtime" col="leadtime_hours" align="right" sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
                <SortTh label="Severidade" col="severidade" align="center" sortKey={dealSort} sortDir={dealDir} onSort={toggleDealSort} />
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((d) => {
                const sev = SEV_COLORS[d.severidade];
                return (
                  <tr
                    key={d.deal_id}
                    style={{ backgroundColor: d.severidade === "CRITICO" ? "#FEF2F2" : d.severidade === "ALERTA" ? "#FFFBEB" : "" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <a
                        href={d.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: T.azul600, textDecoration: "none", fontWeight: 500 }}
                        title={d.title}
                      >
                        {d.title}
                      </a>
                    </td>
                    <td style={{ ...tdStyle }}>{d.owner_name}</td>
                    <td style={{ ...tdStyle, fontSize: "12px" }}>{d.empreendimento || "—"}</td>
                    <td style={{ ...tdStyle, fontSize: "12px" }}>{d.stage_name}</td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: "12px" }}>
                      {d.last_activity_date
                        ? new Date(d.last_activity_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                        : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", fontSize: "12px" }}>
                      {d.next_activity_date ? (
                        <span style={{
                          color: d.atividade_atrasada ? T.roxo600 : T.verde700,
                          fontWeight: d.atividade_atrasada ? 700 : 400,
                        }}>
                          {new Date(d.next_activity_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          {d.atividade_atrasada && " (atrasada)"}
                        </span>
                      ) : (
                        <span style={{ color: T.cinza700, fontWeight: 600 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: sev.text }}>
                      {formatLeadtime(d.leadtime_hours)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <SevBadge sev={d.severidade} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </>
  );
}

/* ---- Subcomponents ---- */

function SummaryCard({ label, value, sub, color, bgColor }: { label: string; value: string; sub: string; color: string; bgColor?: string }) {
  return (
    <div style={{
      backgroundColor: bgColor || "#FFF",
      border: bgColor ? "none" : "1px solid #E6E7EA",
      borderRadius: "12px",
      padding: "14px 20px",
      minWidth: "180px",
      flex: "1 1 180px",
      boxShadow: bgColor ? "0 2px 8px rgba(0,0,0,0.15)" : "0 1px 2px rgba(0,0,0,0.06)",
    }}>
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
    <div style={{
      backgroundColor: "#FFF",
      border: "1px solid #E6E7EA",
      borderRadius: "12px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      marginBottom: "16px",
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E6E7EA" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: T.fg }}>{title}</span>
      </div>
      <div style={{ padding: "0" }}>{children}</div>
    </div>
  );
}

function SevBadge({ sev }: { sev: VendasSeveridade }) {
  const c = SEV_COLORS[sev];
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, color: c.text, backgroundColor: c.bg,
      padding: "2px 7px", borderRadius: "9999px", textTransform: "uppercase",
      border: `1px solid ${c.border}33`,
    }}>
      {sev}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: T.cinza700 }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function SortTh<K extends string>({ label, col, align, minW, sortKey, sortDir, onSort }: {
  label: string; col: K; align: "left" | "right" | "center"; minW?: number;
  sortKey: K; sortDir: SortDir; onSort: (k: K) => void;
}) {
  const active = sortKey === col;
  const arrow = active ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";
  return (
    <th style={{ ...thStyle, textAlign: align, minWidth: minW, cursor: "pointer", userSelect: "none" }} onClick={() => onSort(col)}>
      {label}{arrow}
    </th>
  );
}

/* ---- Styles ---- */

const thStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: "10px", fontWeight: 500, color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA", letterSpacing: "0.04em", textTransform: "uppercase",
  whiteSpace: "nowrap", backgroundColor: "#F3F3F5",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px", borderBottom: "1px solid #E6E7EA", fontSize: "13px",
  fontWeight: 400, color: "#141A3C", letterSpacing: "0.02em", whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const selectStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: "6px", border: "1px solid #E6E7EA",
  fontSize: "12px", color: "#141A3C", backgroundColor: "#FFF", cursor: "pointer",
};
