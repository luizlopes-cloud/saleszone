"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { FunilData, FunilEmpreendimento, FunilCidade, FunilBairro } from "@/lib/types";
import { StatPill, TH, cellRightStyle, cellStyle, DataSourceFooter } from "./ui";

interface ResultadosViewProps {
  data: FunilData | null;
  loading: boolean;
  lastUpdated?: Date | null;
  moduleId?: string;
}

const STAGES = [
  { key: "leads", label: "Leads", color: T.azul600 },
  { key: "mql", label: "MQL", color: T.azul600 },
  { key: "sql", label: "SQL", color: T.roxo600 },
  { key: "opp", label: "OPP", color: T.laranja500 },
  { key: "reserva", label: "Reserva", color: T.verde700 },
  { key: "contrato", label: "Contrato", color: T.teal600 },
  { key: "won", label: "WON", color: T.verde600 },
] as const;

const RATE_LABELS: Record<string, string> = {
  leads: "Lead→MQL",
  mql: "MQL→SQL",
  sql: "SQL→OPP",
  opp: "OPP→Reserva",
  reserva: "Reserva→Contrato",
  contrato: "Contrato→WON",
};

const RATE_KEYS: Record<string, keyof FunilEmpreendimento> = {
  leads: "leadToMql",
  mql: "mqlToSql",
  sql: "sqlToOpp",
  opp: "oppToReserva",
  reserva: "reservaToContrato",
  contrato: "contratoToWon",
};

type SortKey = "emp" | "leads" | "mql" | "sql" | "opp" | "reserva" | "contrato" | "won" | "spend" | "cpl" | "cmql" | "copp" | "cpw";
type SortDir = "asc" | "desc";

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

function FunnelBar({ data }: { data: FunilEmpreendimento }) {
  const stages = STAGES.map((s) => ({
    ...s,
    value: data[s.key as keyof FunilEmpreendimento] as number,
  }));
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {stages.map((s) => {
        const pct = (s.value / max) * 100;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, width: "80px", textAlign: "right" }}>
              {s.label}
            </span>
            <div style={{ flex: 1, height: "22px", backgroundColor: T.cinza50, borderRadius: "4px", overflow: "hidden", position: "relative" }}>
              <div
                style={{
                  width: `${Math.max(pct, 0.5)}%`,
                  height: "100%",
                  backgroundColor: s.color,
                  borderRadius: "4px",
                  transition: "width 0.4s ease",
                  minWidth: s.value > 0 ? "2px" : "0px",
                }}
              />
            </div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: T.fg, width: "70px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {fmt(s.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SortableHeader({ label, sortKey, currentSort, currentDir, onSort, right }: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  right?: boolean;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: "8px 10px",
        fontSize: "10px",
        fontWeight: 600,
        color: active ? T.azul600 : T.cinza600,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        textAlign: right ? "right" : "left",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        {label}
        {active && (currentDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </span>
    </th>
  );
}

function SquadTable({ squad, expanded, onToggle, groupLabel }: {
  squad: { id: number; name: string; empreendimentos: FunilEmpreendimento[]; totals: FunilEmpreendimento };
  expanded: boolean;
  onToggle: () => void;
  groupLabel: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("emp");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "emp" ? "asc" : "desc");
    }
  };

  const sorted = [...squad.empreendimentos].sort((a, b) => {
    const valA = a[sortKey as keyof FunilEmpreendimento];
    const valB = b[sortKey as keyof FunilEmpreendimento];
    if (typeof valA === "string" && typeof valB === "string") {
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    const nA = Number(valA) || 0;
    const nB = Number(valB) || 0;
    return sortDir === "asc" ? nA - nB : nB - nA;
  });

  const t = squad.totals;
  const color = SQUAD_COLORS[squad.id] || T.azul600;

  return (
    <div style={{ marginBottom: "8px" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          backgroundColor: `${color}08`,
          border: `1px solid ${color}30`,
          borderRadius: expanded ? "8px 8px 0 0" : "8px",
          cursor: "pointer",
          fontFamily: T.font,
        }}
      >
        {expanded ? <ChevronDown size={14} color={color} /> : <ChevronRight size={14} color={color} />}
        <span style={{ fontSize: "13px", fontWeight: 600, color }}>{squad.name}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: T.cinza600 }}>Leads <b style={{ color: T.fg }}>{fmt(t.leads)}</b></span>
          <span style={{ color: T.cinza600 }}>MQL <b style={{ color: T.fg }}>{fmt(t.mql)}</b></span>
          <span style={{ color: T.cinza600 }}>SQL <b style={{ color: T.fg }}>{fmt(t.sql)}</b></span>
          <span style={{ color: T.cinza600 }}>OPP <b style={{ color: T.fg }}>{fmt(t.opp)}</b></span>
          <span style={{ color: T.cinza600 }}>Reserva <b style={{ color: T.fg }}>{fmt(t.reserva)}</b></span>
          <span style={{ color: T.cinza600 }}>Contrato <b style={{ color: T.fg }}>{fmt(t.contrato)}</b></span>
          <span style={{ color: T.cinza600 }}>WON <b style={{ color: T.verde600 }}>{fmt(t.won)}</b></span>
          <span style={{ color: T.cinza600 }}>Invest. <b style={{ color: T.fg }}>{fmtMoney(t.spend)}</b></span>
          <span style={{ color: T.cinza600 }}>CMQL <b style={{ color: T.fg }}>{fmtMoney(t.cmql)}</b></span>
          <span style={{ color: T.cinza600 }}>COPP <b style={{ color: T.fg }}>{fmtMoney(t.copp)}</b></span>
          <span style={{ color: T.cinza600 }}>CPW <b style={{ color: T.fg }}>{fmtMoney(t.cpw)}</b></span>
        </div>
      </button>
      {expanded && (
        <div style={{ border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <SortableHeader label={groupLabel} sortKey="emp" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Leads" sortKey="leads" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="MQL" sortKey="mql" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="SQL" sortKey="sql" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="OPP" sortKey="opp" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="Reserva" sortKey="reserva" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="Contrato" sortKey="contrato" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="WON" sortKey="won" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="Invest." sortKey="spend" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="CPL" sortKey="cpl" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="CMQL" sortKey="cmql" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="COPP" sortKey="copp" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
                <SortableHeader label="CPW" sortKey="cpw" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.emp}>
                  <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 500 }}>
                    {e.emp.replace(" Spot", "").replace(" II", " II").replace(" III", " III")}
                  </td>
                  <td style={cellRightStyle}>{fmt(e.leads)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(e.mql)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(e.sql)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(e.opp)}</td>
                  <td style={cellRightStyle}>{fmt(e.reserva)}</td>
                  <td style={cellRightStyle}>{fmt(e.contrato)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(e.won)}</td>
                  <td style={cellRightStyle}>{fmtMoney(e.spend)}</td>
                  <td style={cellRightStyle}>{fmtMoney(e.cpl)}</td>
                  <td style={cellRightStyle}>{fmtMoney(e.cmql)}</td>
                  <td style={cellRightStyle}>{fmtMoney(e.copp)}</td>
                  <td style={cellRightStyle}>{fmtMoney(e.cpw)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: T.cinza50 }}>
                <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 700 }}>Total {squad.name}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(t.leads)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(t.mql)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(t.sql)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(t.opp)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(t.reserva)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(t.contrato)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(t.won)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(t.spend)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(t.cpl)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(t.cmql)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(t.copp)}</td>
                <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(t.cpw)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CidadeDetailTable({ cidades }: { cidades: FunilCidade[] }) {
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("mql");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "emp" ? "asc" : "desc");
    }
  };

  const toggleCity = (cidade: string) => {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(cidade)) next.delete(cidade);
      else next.add(cidade);
      return next;
    });
  };

  const sortedCidades = [...cidades].sort((a, b) => {
    if (sortKey === "emp") {
      return sortDir === "asc" ? a.cidade.localeCompare(b.cidade) : b.cidade.localeCompare(a.cidade);
    }
    const valA = (a.totals[sortKey as keyof FunilEmpreendimento] as number) || 0;
    const valB = (b.totals[sortKey as keyof FunilEmpreendimento] as number) || 0;
    return sortDir === "asc" ? valA - valB : valB - valA;
  });

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: "8px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <SortableHeader label="Cidade" sortKey="emp" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableHeader label="Leads" sortKey="leads" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="MQL" sortKey="mql" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="SQL" sortKey="sql" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="OPP" sortKey="opp" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="Reserva" sortKey="reserva" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="Contrato" sortKey="contrato" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="WON" sortKey="won" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="Invest." sortKey="spend" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="CMQL" sortKey="cmql" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="COPP" sortKey="copp" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
            <SortableHeader label="CPW" sortKey="cpw" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} right />
          </tr>
        </thead>
        <tbody>
          {sortedCidades.map((c) => {
            const t = c.totals;
            const isExpanded = expandedCities.has(c.cidade);
            const hasBairros = c.bairros.length > 1 || (c.bairros.length === 1 && c.bairros[0].bairro !== "Sem bairro");
            return (
              <>
                <tr
                  key={c.cidade}
                  onClick={() => hasBairros && toggleCity(c.cidade)}
                  style={{
                    backgroundColor: T.cinza50,
                    cursor: hasBairros ? "pointer" : "default",
                  }}
                >
                  <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 600 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {hasBairros && (isExpanded ? <ChevronDown size={12} color={T.cinza600} /> : <ChevronRight size={12} color={T.cinza600} />)}
                      {c.cidade}
                    </span>
                  </td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(t.leads)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(t.mql)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(t.sql)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(t.opp)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(t.reserva)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmt(t.contrato)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(t.won)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmtMoney(t.spend)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmtMoney(t.cmql)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmtMoney(t.copp)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 600 }}>{fmtMoney(t.cpw)}</td>
                </tr>
                {isExpanded && c.bairros.map((b) => (
                  <tr key={`${c.cidade}|${b.bairro}`}>
                    <td style={{ ...cellStyle, fontSize: "11px", fontWeight: 400, paddingLeft: "28px", color: T.cinza700 }}>
                      {b.bairro}
                    </td>
                    <td style={cellRightStyle}>{fmt(b.leads)}</td>
                    <td style={cellRightStyle}>{fmt(b.mql)}</td>
                    <td style={cellRightStyle}>{fmt(b.sql)}</td>
                    <td style={cellRightStyle}>{fmt(b.opp)}</td>
                    <td style={cellRightStyle}>{fmt(b.reserva)}</td>
                    <td style={cellRightStyle}>{fmt(b.contrato)}</td>
                    <td style={{ ...cellRightStyle, color: T.verde600 }}>{fmt(b.won)}</td>
                    <td style={cellRightStyle}>—</td>
                    <td style={cellRightStyle}>—</td>
                    <td style={cellRightStyle}>—</td>
                    <td style={cellRightStyle}>—</td>
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ResultadosView({ data, loading, lastUpdated, moduleId }: ResultadosViewProps) {
  const [expandedSquads, setExpandedSquads] = useState<Set<number>>(new Set([1, 2, 3]));

  const isSZS = moduleId === "szs";
  const sectionTitle = isSZS ? "Detalhamento por Canal" : "Detalhamento por Squad";
  const groupLabel = isSZS ? "Canal" : "Empreendimento";

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando resultados...</p>
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

  const g = data.grand;

  const toggleSquad = (id: number) => {
    setExpandedSquads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {STAGES.map((s) => {
          const value = g[s.key as keyof FunilEmpreendimento] as number;
          const rateKey = RATE_KEYS[s.key];
          const rateLabel = RATE_LABELS[s.key];
          const rateValue = rateKey ? (g[rateKey] as number) : undefined;
          return (
            <div
              key={s.key}
              style={{
                backgroundColor: "#FFF",
                border: `1px solid ${T.border}`,
                borderRadius: "12px",
                padding: "14px 18px",
                flex: "1 1 120px",
                minWidth: "120px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>
                {fmt(value)}
              </div>
              {rateValue !== undefined && rateLabel && (
                <div style={{ fontSize: "10px", color: T.cinza400, marginTop: "2px" }}>
                  {rateLabel}: {fmtPct(rateValue)}
                </div>
              )}
            </div>
          );
        })}
        <div
          style={{
            backgroundColor: "#FFF",
            border: `1px solid ${T.border}`,
            borderRadius: "12px",
            padding: "14px 18px",
            flex: "1 1 120px",
            minWidth: "120px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>
            Investimento
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(g.spend)}
          </div>
          <div style={{ fontSize: "10px", color: T.cinza400, marginTop: "2px" }}>
            CMQL: {fmtMoney(g.cmql)} · COPP: {fmtMoney(g.copp)} · CPW: {fmtMoney(g.cpw)}
          </div>
        </div>
      </div>

      {/* Funnel bar */}
      <div
        style={{
          backgroundColor: "#FFF",
          border: `1px solid ${T.border}`,
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: "0 0 14px 0" }}>Funil Comercial — {data.month}</h3>
        <FunnelBar data={g} />
      </div>

      {/* Detail tables */}
      <div>
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: "0 0 10px 0" }}>{sectionTitle}</h3>
        {isSZS && data.squads[0]?.cidades ? (
          <CidadeDetailTable cidades={data.squads[0].cidades} />
        ) : (
          data.squads.map((sq) => (
            <SquadTable
              key={sq.id}
              squad={sq}
              expanded={expandedSquads.has(sq.id)}
              onToggle={() => toggleSquad(sq.id)}
              groupLabel={groupLabel}
            />
          ))
        )}
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
