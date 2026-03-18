"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { FunilData, FunilEmpreendimento } from "@/lib/types";
import { StatPill, TH, cellRightStyle, cellStyle, DataSourceFooter } from "./ui";

interface ResultadosViewProps {
  data: FunilData | null;
  loading: boolean;
  lastUpdated?: Date | null;
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

function SquadTable({ squad, expanded, onToggle }: {
  squad: { id: number; name: string; empreendimentos: FunilEmpreendimento[]; totals: FunilEmpreendimento };
  expanded: boolean;
  onToggle: () => void;
}) {
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
                <TH>Empreendimento</TH>
                <TH right>Leads</TH>
                <TH right>MQL</TH>
                <TH right>SQL</TH>
                <TH right>OPP</TH>
                <TH right>Reserva</TH>
                <TH right>Contrato</TH>
                <TH right>WON</TH>
                <TH right>Invest.</TH>
                <TH right>CPL</TH>
                <TH right>CMQL</TH>
                <TH right>COPP</TH>
                <TH right>CPW</TH>
              </tr>
            </thead>
            <tbody>
              {squad.empreendimentos.map((e) => (
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

export function ResultadosView({ data, loading, lastUpdated }: ResultadosViewProps) {
  const [expandedSquads, setExpandedSquads] = useState<Set<number>>(new Set([1, 2, 3]));

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

      {/* Squad tables */}
      <div>
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: "0 0 10px 0" }}>Detalhamento por Squad</h3>
        {data.squads.map((sq) => (
          <SquadTable
            key={sq.id}
            squad={sq}
            expanded={expandedSquads.has(sq.id)}
            onToggle={() => toggleSquad(sq.id)}
          />
        ))}
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
