"use client";

import { T, SQUAD_COLORS } from "@/lib/constants";
import type { FunilData } from "@/lib/types";
import { StatPill } from "./ui";

interface Props {
  data: FunilData | null;
  loading: boolean;
}

function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dash(v: number): string {
  return v === 0 ? "-" : v.toLocaleString("pt-BR");
}

function dashBRL(v: number): string {
  return v === 0 ? "-" : formatBRL(v);
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

export function FunilView({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados do funil...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Nenhum dado de funil disponível.
      </div>
    );
  }

  const { grand, squads, month } = data;

  return (
    <>
      {/* Summary pills */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <BrlPill label="Investimento" value={grand.spend} />
        <StatPill label="Leads" value={grand.leads} color={T.verde600} />
        <StatPill label="MQL" value={grand.mql} />
        <StatPill label="WON" value={grand.won} color={T.verde600} />
        <BrlPill label="CPL" value={grand.cpl} />
        <BrlPill label="CPW" value={grand.cpw} />
        <span style={{ fontSize: "11px", color: T.cinza400, marginLeft: "auto" }}>
          {monthLabel(month)} · month-to-date
        </span>
      </div>

      {/* Cards por squad */}
      {squads.map((sq) => {
        const clr = SQUAD_COLORS[sq.id] || T.azul600;
        const hasData = sq.empreendimentos.some((e) => e.spend > 0 || e.mql > 0 || e.sql > 0 || e.opp > 0 || e.won > 0);

        return (
          <div
            key={sq.id}
            style={{
              backgroundColor: T.card,
              borderRadius: "12px",
              border: `1px solid ${T.border}`,
              boxShadow: T.elevSm,
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            {/* Squad header */}
            <div
              style={{
                padding: "10px 16px",
                backgroundColor: clr,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#FFF", fontWeight: 600, fontSize: "14px" }}>{sq.name}</span>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  Gasto: {formatBRL(sq.totals.spend)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  Leads: {sq.totals.leads}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  WON: {sq.totals.won}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  CPW: {sq.totals.cpw > 0 ? formatBRL(sq.totals.cpw) : "-"}
                </span>
              </div>
            </div>

            {hasData ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: T.cinza50 }}>
                    <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Empreendimento</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Gasto</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Leads</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CPL</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>MQL</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>SQL</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>OPP</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>WON</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CPW</th>
                  </tr>
                </thead>
                <tbody>
                  {sq.empreendimentos.map((emp) => (
                    <tr
                      key={emp.emp}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                    >
                      <td style={{ ...tdStyle, color: T.cinza800 }}>{emp.emp}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{dashBRL(emp.spend)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.leads > 0 ? 600 : 400 }}>
                        {dash(emp.leads)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{dashBRL(emp.cpl)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.mql > 0 ? 600 : 400 }}>
                        {dash(emp.mql)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{dash(emp.sql)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{dash(emp.opp)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontWeight: emp.won > 0 ? 700 : 400,
                          color: emp.won > 0 ? T.verde700 : T.cinza300,
                        }}
                      >
                        {dash(emp.won)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontWeight: emp.cpw > 0 ? 600 : 400,
                        }}
                      >
                        {dashBRL(emp.cpw)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: T.cinza400, fontSize: "13px" }}>
                Sem dados neste squad
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: "10px", textAlign: "right" }}>
        <span style={{ fontSize: "11px", color: T.cinza400 }}>
          Meta Ads + Pipedrive · {monthLabel(month)}
        </span>
      </div>
    </>
  );
}

function BrlPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span style={{ fontSize: "20px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
        {formatBRL(value)}
      </span>
    </div>
  );
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
