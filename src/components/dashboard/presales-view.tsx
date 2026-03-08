"use client";

import { useState } from "react";
import { T, SQUAD_COLORS, SQUADS } from "@/lib/constants";
import type { PresalesData, PresellerSummary } from "@/lib/types";

interface Props {
  data: PresalesData | null;
  loading: boolean;
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

function statusLabel(minutes: number | null): string {
  if (minutes == null) return "Pendente";
  if (minutes <= 30) return "Rápido";
  if (minutes <= 60) return "Aceitável";
  return "Lento";
}

const MAIN_PVS = ["Luciana Patrício", "Luciana Patricio", "Natália Saramago", "Hellen Dias", "Jeniffer Correa"];

export function PresalesView({ data, loading }: Props) {
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
  const mainPVs = presellers.filter((p) => MAIN_PVS.includes(p.name));

  return (
    <>
      {/* Summary pills */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "stretch" }}>
        <SummaryPill
          label="Mediana Global"
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
        <SummaryPill label="Pendentes" value={String(totals.dealsPendentes)} color="#dc2626" bg="#fee2e2" />
        <CalcDisclaimer />
      </div>

      {/* 4 Cards grandes — PVs principais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px", marginBottom: "20px" }}>
        {mainPVs.map((ps) => (
          <BigPVCard key={ps.name} ps={ps} />
        ))}
      </div>

      {/* Tabela deals recentes */}
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Deals Recentes
      </h3>
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
              <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Deal</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 130 }}>Pré-Vendedor</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 120 }}>Criação Deal</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 120 }}>Transbordo</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 120 }}>Última MIA</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 80 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentDeals.map((d) => {
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

// --- Card grande PV dos squads ---
function BigPVCard({ ps }: { ps: PresellerSummary }) {
  const squad = SQUADS.find((s) => s.preVenda === ps.name);
  const sqColor = ps.squadId ? SQUAD_COLORS[ps.squadId] || T.azul600 : T.cinza600;
  const medColor = statusColor(ps.medianMinutes);
  const medBg = statusBg(ps.medianMinutes);

  return (
    <div
      style={{
        backgroundColor: T.card,
        borderRadius: "14px",
        border: `1px solid ${T.border}`,
        boxShadow: T.elevSm,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "10px 16px", backgroundColor: sqColor, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>{ps.name}</span>
        {squad && <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "11px" }}>{squad.name}</span>}
      </div>

      {/* Mediana central */}
      <div style={{ textAlign: "center", padding: "18px 16px 10px" }}>
        <div style={{ fontSize: "10px", color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
          Mediana
        </div>
        <div
          style={{
            display: "inline-block",
            padding: "6px 20px",
            borderRadius: "12px",
            backgroundColor: medBg,
            color: medColor,
            fontSize: "28px",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatMinutes(ps.medianMinutes)}
        </div>
      </div>

      {/* Barra ≤30min */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "11px", color: T.cinza600 }}>≤30min</span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: ps.pctSub30 >= 70 ? "#16a34a" : ps.pctSub30 >= 40 ? "#d97706" : "#dc2626" }}>
            {ps.pctSub30}%
          </span>
        </div>
        <div style={{ height: "8px", backgroundColor: "#f3f4f6", borderRadius: "4px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${ps.pctSub30}%`,
              backgroundColor: ps.pctSub30 >= 70 ? "#16a34a" : ps.pctSub30 >= 40 ? "#d97706" : "#dc2626",
              borderRadius: "4px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Stats footer */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderTop: `1px solid ${T.border}`,
          backgroundColor: "#fafafa",
        }}
      >
        <FooterStat label="Total" value={ps.totalDeals} />
        <FooterStat label="Com ligação" value={ps.dealsComAcao} color="#16a34a" />
        <FooterStat label="Pendentes" value={ps.dealsPendentes} color={ps.dealsPendentes > 5 ? "#dc2626" : ps.dealsPendentes > 0 ? "#d97706" : T.cinza400} />
      </div>
    </div>
  );
}

function FooterStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 6px" }}>
      <div style={{ fontSize: "9px", color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: color || T.fg, fontVariantNumeric: "tabular-nums" }}>{value}</div>
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
