"use client";

import { T } from "@/lib/constants";
import { DataSourceFooter } from "./ui";

interface MensalMonth {
  month: string;
  monthLabel: string;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  meta: number;
  pctMeta: number;
  conversions: {
    mqlToSql: number;
    sqlToOpp: number;
    oppToWon: number;
  };
}

interface MensalData {
  months: MensalMonth[];
  updatedAt: string;
}

interface Props {
  data: MensalData | null;
  loading: boolean;
  lastUpdated?: Date | null;
}

function fmt(n: number, dec = 1): string {
  if (Number.isInteger(n)) return n.toLocaleString("pt-BR");
  return n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function pct(n: number): string {
  return `${fmt(n)}%`;
}

function pctMetaColor(val: number): string {
  if (val >= 100) return "#15803D";
  if (val >= 80) return "#92400E";
  return "#E7000B";
}

function convColor(val: number, avg: number): string {
  if (val >= avg) return "#15803D";
  return "#E7000B";
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#FFF",
  border: `1px solid ${T.border}`,
  borderRadius: "12px",
  padding: "12px 18px",
  flex: "1 1 0",
  minWidth: "140px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};

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

export function MensalView({ data, loading, lastUpdated }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando dados mensais...</p>
      </div>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Sem dados mensais</p>
      </div>
    );
  }

  const months = data.months;
  const totalWon = months.reduce((s, m) => s + m.won, 0);
  const avgWon = totalWon / months.length;
  const totalMql = months.reduce((s, m) => s + m.mql, 0);
  const avgMqlToWon = totalMql > 0 ? (totalWon / totalMql) * 100 : 0;

  const avgMqlToSql = months.reduce((s, m) => s + m.conversions.mqlToSql, 0) / months.length;
  const avgSqlToOpp = months.reduce((s, m) => s + m.conversions.sqlToOpp, 0) / months.length;
  const avgOppToWon = months.reduce((s, m) => s + m.conversions.oppToWon, 0) / months.length;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Chart calculations
  const maxVal = Math.max(...months.map((m) => Math.max(m.won, m.meta))) || 1;
  const chartMaxHeight = 200;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: 0 }}>
        Mensal — Últimos {months.length} meses
      </h2>

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={cardStyle}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>
            Total WON
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#15803D" }}>{fmt(totalWon, 0)}</div>
          <div style={{ fontSize: "11px", color: T.cinza600 }}>{months.length} meses</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>
            Média Mensal WON
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: T.azul600 }}>{fmt(avgWon)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>
            Conversão MQL→WON
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: T.fg }}>{pct(avgMqlToWon)}</div>
          <div style={{ fontSize: "11px", color: T.cinza600 }}>média do período</div>
        </div>
      </div>

      {/* Tabela mês a mês */}
      <div style={{ backgroundColor: "#FFF", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "12px" }}>
          Detalhamento Mensal
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Mês</th>
                <th style={{ ...thStyle, textAlign: "right" }}>MQL</th>
                <th style={{ ...thStyle, textAlign: "right" }}>SQL</th>
                <th style={{ ...thStyle, textAlign: "right" }}>OPP</th>
                <th style={{ ...thStyle, textAlign: "right" }}>WON</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Meta</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Meta</th>
                <th style={{ ...thStyle, textAlign: "right" }}>MQL→SQL</th>
                <th style={{ ...thStyle, textAlign: "right" }}>SQL→OPP</th>
                <th style={{ ...thStyle, textAlign: "right" }}>OPP→WON</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const isCurrent = m.month === currentMonth;
                return (
                  <tr key={m.month} style={{ backgroundColor: isCurrent ? T.azul50 : "transparent" }}>
                    <td style={{ ...tdStyle, fontWeight: isCurrent ? 700 : 400 }}>
                      {m.monthLabel}
                      {isCurrent && (
                        <span style={{ fontSize: "9px", color: T.azul600, marginLeft: "6px", fontWeight: 600 }}>ATUAL</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(m.mql, 0)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(m.sql, 0)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(m.opp, 0)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{fmt(m.won, 0)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(m.meta, 0)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: pctMetaColor(m.pctMeta) }}>
                      {pct(m.pctMeta)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: convColor(m.conversions.mqlToSql, avgMqlToSql) }}>
                      {pct(m.conversions.mqlToSql)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: convColor(m.conversions.sqlToOpp, avgSqlToOpp) }}>
                      {pct(m.conversions.sqlToOpp)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: convColor(m.conversions.oppToWon, avgOppToWon) }}>
                      {pct(m.conversions.oppToWon)}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ backgroundColor: T.cinza50 }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>Total / Média</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  {fmt(months.reduce((s, m) => s + m.mql, 0), 0)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  {fmt(months.reduce((s, m) => s + m.sql, 0), 0)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  {fmt(months.reduce((s, m) => s + m.opp, 0), 0)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  {fmt(totalWon, 0)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                  {fmt(months.reduce((s, m) => s + m.meta, 0), 0)}
                </td>
                <td style={tdStyle} />
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: T.cinza600 }}>
                  {pct(avgMqlToSql)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: T.cinza600 }}>
                  {pct(avgSqlToOpp)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: T.cinza600 }}>
                  {pct(avgOppToWon)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico de barras WON vs META */}
      <div style={{ backgroundColor: "#FFF", border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "16px" }}>
          WON vs Meta
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: `${chartMaxHeight + 40}px`, paddingBottom: "24px" }}>
          {months.map((m) => {
            const wonH = maxVal > 0 ? (m.won / maxVal) * chartMaxHeight : 0;
            const metaH = maxVal > 0 ? (m.meta / maxVal) * chartMaxHeight : 0;
            return (
              <div key={m.month} style={{ flex: "1 1 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: `${chartMaxHeight}px` }}>
                  {/* WON bar */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: T.azul600, marginBottom: "2px" }}>
                      {fmt(m.won, 0)}
                    </span>
                    <div
                      style={{
                        width: "28px",
                        height: `${Math.max(wonH, 2)}px`,
                        backgroundColor: T.azul600,
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                  </div>
                  {/* META bar */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: T.cinza400, marginBottom: "2px" }}>
                      {fmt(m.meta, 0)}
                    </span>
                    <div
                      style={{
                        width: "28px",
                        height: `${Math.max(metaH, 2)}px`,
                        backgroundColor: T.cinza200,
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, marginTop: "4px" }}>
                  {m.monthLabel.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
        {/* Legenda */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", backgroundColor: T.azul600, borderRadius: "2px" }} />
            <span style={{ fontSize: "11px", color: T.cinza600 }}>WON</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", backgroundColor: T.cinza200, borderRadius: "2px" }} />
            <span style={{ fontSize: "11px", color: T.cinza600 }}>Meta</span>
          </div>
        </div>
      </div>

      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
