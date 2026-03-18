"use client";

import { useState } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { ForecastData, ForecastSquadRow } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: ForecastData | null;
  loading: boolean;
  lastUpdated?: Date | null;
}

function fmt(n: number, dec = 1): string {
  if (Number.isInteger(n)) return n.toLocaleString("pt-BR");
  return n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function pct(n: number): string {
  return `${n}%`;
}

function pctColor(val: number): string {
  if (val >= 100) return "#15803D";
  if (val >= 80) return "#92400E";
  return "#E7000B";
}

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

export function ForecastView({ data, loading, lastUpdated }: Props) {
  const [expandedSquads, setExpandedSquads] = useState<Set<number>>(new Set());

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando forecast...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Sem dados de forecast</p>
      </div>
    );
  }

  const toggleSquad = (sqId: number) => {
    setExpandedSquads((prev) => {
      const next = new Set(prev);
      if (next.has(sqId)) next.delete(sqId);
      else next.add(sqId);
      return next;
    });
  };

  const maxRange = Math.max(data.ranges.otimista, data.meta) * 1.1 || 1;
  const stagesWithDeals = data.stages.filter((s) => s.openDeals > 0);
  const totalOpenDeals = data.stages.reduce((s, st) => s + st.openDeals, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: 0 }}>
          Forecast — {new Date(data.month + "-01T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </h2>
        <span style={{ fontSize: "12px", color: T.mutedFg }}>
          Dia {data.diasPassados} de {data.diasNoMes} ({data.diasRestantes} restantes)
        </span>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={cardStyle("#5EA500")}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>Já Ganhos</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#15803D" }}>{data.wonActual}</div>
        </div>
        <div style={cardStyle("#0055FF")}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>Pipeline Esperado</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: T.azul600 }}>{fmt(data.pipeline)}</div>
          <div style={{ fontSize: "11px", color: T.cinza600 }}>{totalOpenDeals} deals abertos × taxa conv.</div>
        </div>
        <div style={{ ...cardStyle(), backgroundColor: T.fg, border: "none" }}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", marginBottom: "4px" }}>Forecast Total</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#FFF" }}>{fmt(data.total)}</div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
            Meta: {data.meta} · <span style={{ color: data.pctMeta >= 100 ? "#86efac" : data.pctMeta >= 80 ? "#fde68a" : "#fca5a5" }}>{pct(data.pctMeta)}</span>
          </div>
        </div>
      </div>

      {/* Range Bar */}
      {data.meta > 0 && (
        <div style={{ backgroundColor: "#FFF", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "12px" }}>Range de Previsão</div>
          <div style={{ position: "relative", height: "40px", backgroundColor: T.cinza50, borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(data.ranges.pessimista / maxRange) * 100}%`, backgroundColor: "#fde68a44", borderRadius: "8px 0 0 8px" }} />
            <div style={{ position: "absolute", left: `${(data.ranges.pessimista / maxRange) * 100}%`, top: 0, bottom: 0, width: `${((data.ranges.esperado - data.ranges.pessimista) / maxRange) * 100}%`, backgroundColor: "#0055FF22" }} />
            <div style={{ position: "absolute", left: `${(data.ranges.esperado / maxRange) * 100}%`, top: 0, bottom: 0, width: `${((data.ranges.otimista - data.ranges.esperado) / maxRange) * 100}%`, backgroundColor: "#5EA50015", borderRadius: "0 8px 8px 0" }} />
            <div style={{ position: "absolute", left: `${(data.meta / maxRange) * 100}%`, top: 0, bottom: 0, width: "2px", backgroundColor: T.destructive, zIndex: 2 }}>
              <div style={{ position: "absolute", top: "-18px", left: "50%", transform: "translateX(-50%)", fontSize: "10px", fontWeight: 600, color: T.destructive, whiteSpace: "nowrap" }}>
                Meta {data.meta}
              </div>
            </div>
            <div style={{ position: "absolute", left: `${(data.ranges.esperado / maxRange) * 100}%`, top: "50%", transform: "translate(-50%, -50%)", width: "12px", height: "12px", backgroundColor: T.azul600, borderRadius: "50%", border: "2px solid #FFF", zIndex: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: T.cinza600 }}>
            <span>Pessimista: {fmt(data.ranges.pessimista)}</span>
            <span style={{ fontWeight: 600, color: T.azul600 }}>Esperado: {fmt(data.ranges.esperado)}</span>
            <span>Otimista: {fmt(data.ranges.otimista)}</span>
          </div>
        </div>
      )}

      {/* Pipeline por Etapa */}
      <div style={{ backgroundColor: "#FFF", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>Pipeline por Etapa</div>
        <div style={{ fontSize: "11px", color: T.cinza600, marginBottom: "12px" }}>Deals abertos (canal Marketing) × taxa de conversão histórica 90d</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Etapa</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Deals Abertos</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Conv. → WON (90d)</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Leadtime → WON</th>
                <th style={{ ...thStyle, textAlign: "right" }}>WON Esperado</th>
              </tr>
            </thead>
            <tbody>
              {stagesWithDeals.map((s) => (
                <tr key={s.stageOrder}>
                  <td style={tdStyle}>{s.stage}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{s.openDeals}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{(s.convRate * 100).toFixed(1)}%</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: T.cinza600 }}>{s.leadtimeDays}d</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{fmt(s.expectedWon)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: T.cinza50 }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{totalOpenDeals}</td>
                <td style={tdStyle} />
                <td style={tdStyle} />
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(data.pipeline)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela por Squad / Closer */}
      <div style={{ backgroundColor: "#FFF", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "12px" }}>Forecast por Squad / Closer</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Squad / Closer</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Já Ganhos</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Pipeline</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Forecast</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Meta</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Forecast</th>
              </tr>
            </thead>
            <tbody>
              {data.squads.map((sq) => (
                <SquadRows key={sq.id} sq={sq} expanded={expandedSquads.has(sq.id)} onToggle={() => toggleSquad(sq.id)} />
              ))}
              <tr style={{ backgroundColor: T.fg }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: "#FFF", borderBottom: "none" }}>Total</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#FFF", borderBottom: "none" }}>{data.wonActual}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#FFF", borderBottom: "none" }}>{fmt(data.pipeline)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#FFF", borderBottom: "none" }}>{fmt(data.total)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#FFF", borderBottom: "none" }}>{data.meta}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: data.pctMeta >= 100 ? "#86efac" : data.pctMeta >= 80 ? "#fde68a" : "#fca5a5", borderBottom: "none" }}>
                  {pct(data.pctMeta)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Metodologia */}
      <div style={{ backgroundColor: T.cinza50, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "16px 20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "6px" }}>Metodologia</div>
        <p style={{ fontSize: "12px", color: T.cinza700, margin: 0, lineHeight: 1.6 }}>{data.metodologia}</p>
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}

function SquadRows({ sq, expanded, onToggle }: { sq: ForecastSquadRow; expanded: boolean; onToggle: () => void }) {
  const sqColor = SQUAD_COLORS[sq.id] || T.cinza600;

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
            <span style={{ fontWeight: 600 }}>{sq.name}</span>
          </span>
        </td>
        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{sq.wonActual}</td>
        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{fmt(sq.pipeline)}</td>
        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(sq.total)}</td>
        <td style={{ ...tdStyle, textAlign: "right" }}>{sq.meta}</td>
        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: pctColor(sq.pctMeta) }}>{pct(sq.pctMeta)}</td>
      </tr>
      {expanded && sq.closers.map((c) => (
        <tr key={c.name} style={{ backgroundColor: T.azul50 + "66" }}>
          <td style={{ ...tdStyle, paddingLeft: "36px", fontSize: "12px" }}>{c.name}</td>
          <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>{c.wonActual}</td>
          <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>{fmt(c.pipeline)}</td>
          <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px", fontWeight: 600 }}>{fmt(c.total)}</td>
          <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>{fmt(c.meta)}</td>
          <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px", fontWeight: 600, color: pctColor(c.pctMeta) }}>{pct(c.pctMeta)}</td>
        </tr>
      ))}
    </>
  );
}
