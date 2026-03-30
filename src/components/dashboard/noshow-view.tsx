"use client";

import React, { useState, useMemo } from "react";
import { T } from "@/lib/constants";
import type { NoShowData, NoShowDealRow, NoShowAlert } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: NoShowData | null;
  loading: boolean;
  lastUpdated?: Date | null;
  days: number;
  onDaysChange: (d: number) => void;
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
  backgroundColor: "#f8f8fa",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid #E6E7EA",
  fontSize: "12px",
  fontWeight: 400,
  color: "#141A3C",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const SEVERITY_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  critical: { bg: "#fef2f2", fg: "#dc2626", border: "#fecaca" },
  warning: { bg: "#fffbeb", fg: "#d97706", border: "#fde68a" },
  info: { bg: "#eff6ff", fg: "#2563eb", border: "#bfdbfe" },
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#fef3c7", fg: "#92400e" },
  won: { bg: "#d1fae5", fg: "#065f46" },
  lost: { bg: "#fee2e2", fg: "#991b1b" },
};

const STATUS_LABELS: Record<string, string> = {
  open: "Em No-Show",
  won: "Recuperado",
  lost: "Perdido",
};

const PERIOD_OPTIONS = [
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "60d", value: 60 },
  { label: "90d", value: 90 },
];

// ─── Reusable Components ───

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px 20px", minWidth: "130px", flex: "1 1 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: 700, color: color || T.fg, fontVariantNumeric: "tabular-nums" }}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "#6B6E84", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

function AlertBox({ alerts }: { alerts: NoShowAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {alerts.map((a) => {
        const c = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.info;
        return (
          <div key={a.id} style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "12px 16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: c.fg }}>{a.message}</div>
          </div>
        );
      })}
    </div>
  );
}

function DistributionBars({ data, total, title }: { data: Record<string, number>; total: number; title: string }) {
  const sorted = useMemo(() => Object.entries(data).sort((a, b) => b[1] - a[1]), [data]);
  if (sorted.length === 0) return null;
  const maxCount = sorted[0]?.[1] ?? 1;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px", flex: "1 1 0", minWidth: "280px" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>{title}</h3>
      {sorted.map(([name, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={name} style={{ marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
              <span style={{ color: "#141A3C" }}>{name}</span>
              <span style={{ color: "#6B6E84", fontVariantNumeric: "tabular-nums" }}>{count} ({pct}%)</span>
            </div>
            <div style={{ height: "6px", backgroundColor: "#E6E7EA", borderRadius: "3px" }}>
              <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "#f59e0b", width: `${(count / maxCount) * 100}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendMini({ dates, totals }: { dates: string[]; totals: number[] }) {
  if (dates.length < 2) return null;
  const max = Math.max(...totals, 1);
  const w = 220;
  const h = 50;
  const points = totals.map((v, i) => {
    const x = (i / (totals.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px", minWidth: "260px" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "8px" }}>Cancelamentos 7 dias</h3>
      <svg width={w} height={h} style={{ display: "block" }}>
        <polyline points={points.join(" ")} fill="none" stroke="#f59e0b" strokeWidth="2" />
        {totals.map((v, i) => {
          const x = (i / (totals.length - 1)) * w;
          const y = h - (v / max) * h;
          return <circle key={i} cx={x} cy={y} r="3" fill="#f59e0b" />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#6B6E84", marginTop: "4px" }}>
        <span>{dates[0]?.slice(5)}</span>
        <span>{dates[dates.length - 1]?.slice(5)}</span>
      </div>
    </div>
  );
}

function DealsTable({ deals, title }: { deals: NoShowDealRow[]; title?: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? deals : deals.slice(0, 15);

  if (deals.length === 0) return null;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px" }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>{title} ({deals.length})</h3>
          {deals.length > 15 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ fontSize: "11px", color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
            >
              {expanded ? "Mostrar menos" : `Ver todos (${deals.length})`}
            </button>
          )}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Deal</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Owner</th>
              <th style={thStyle}>Pré-vendedor</th>
              <th style={thStyle}>Empreendimento</th>
              <th style={thStyle}>Etapa Atual</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Dias</th>
              <th style={thStyle}>Canal</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => {
              const sc = STATUS_COLORS[d.status] || STATUS_COLORS.open;
              return (
                <tr key={d.deal_id}>
                  <td style={tdStyle}>
                    <a
                      href={`https://seazone-fd92b9.pipedrive.com/deal/${d.deal_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: T.primary, textDecoration: "none", fontSize: "12px" }}
                    >
                      #{d.deal_id}
                    </a>
                    <span style={{ marginLeft: "6px", fontSize: "11px", color: "#6B6E84" }}>{d.title.slice(0, 30)}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: sc.fg, backgroundColor: sc.bg, borderRadius: "4px", padding: "2px 6px" }}>
                      {STATUS_LABELS[d.status] || d.status}
                    </span>
                  </td>
                  <td style={tdStyle}>{d.owner_name}</td>
                  <td style={tdStyle}>{d.preseller_name || "—"}</td>
                  <td style={tdStyle}>{d.empreendimento || "—"}</td>
                  <td style={tdStyle}>{d.current_stage}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{d.days_in_funnel}d</td>
                  <td style={tdStyle}>{d.canal || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main View ───

export function NoShowView({ data, loading, lastUpdated, days, onDaysChange }: Props) {
  if (loading || !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
        <p style={{ fontSize: "14px" }}>{loading ? "Carregando dados de no-show..." : "Sem dados de no-show"}</p>
      </div>
    );
  }

  const { summary, deals, alerts, trend } = data;

  const openDeals = deals.filter((d) => d.status === "open");
  const wonDeals = deals.filter((d) => d.status === "won");
  const lostDeals = deals.filter((d) => d.status === "lost");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ fontSize: "12px", color: "#6B6E84", fontWeight: 500 }}>Período:</label>
        <div style={{ display: "flex", gap: "4px", backgroundColor: "#f1f5f9", borderRadius: "8px", padding: "3px" }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDaysChange(opt.value)}
              style={{
                fontSize: "11px",
                fontWeight: days === opt.value ? 600 : 400,
                color: days === opt.value ? "#FFF" : "#6B6E84",
                backgroundColor: days === opt.value ? T.fg : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: "12px", color: "#6B6E84" }}>
          Pipeline SZI · Marketing · {summary.total} no-shows
        </span>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <SummaryCard label="Total No-Shows" value={summary.total} />
        <SummaryCard
          label="Em No-Show"
          value={summary.open_count}
          sub="Aguardando reagendamento"
          color="#d97706"
        />
        <SummaryCard
          label="Recuperados"
          value={summary.won_count}
          sub="No-show → Won"
          color="#16a34a"
        />
        <SummaryCard
          label="Perdidos"
          value={summary.lost_count}
          sub="No-show → Lost"
          color="#dc2626"
        />
        <SummaryCard
          label="Média Funil"
          value={summary.avg_days_in_funnel != null ? `${summary.avg_days_in_funnel}d` : "—"}
        />
        <SummaryCard
          label="Taxa Cancelamento"
          value={summary.calendar_noshow_rate != null ? `${summary.calendar_noshow_rate}%` : "—"}
          sub={`${summary.calendar_cancelled_events}/${summary.calendar_total_events} eventos`}
          color={summary.calendar_noshow_rate != null && summary.calendar_noshow_rate > 30 ? "#d97706" : undefined}
        />
      </div>

      {/* Trend + Alerts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <TrendMini dates={trend.dates} totals={trend.totals} />
        <div style={{ flex: "1 1 0", minWidth: "300px" }}>
          <AlertBox alerts={alerts} />
        </div>
      </div>

      {/* Distribution: Pré-vendedor + Empreendimento */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <DistributionBars data={summary.by_preseller} total={summary.total} title="No-Shows por Responsável" />
        <DistributionBars data={summary.by_empreendimento} total={summary.total} title="No-Shows por Empreendimento" />
      </div>

      {/* Active no-shows (open) */}
      {openDeals.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0 4px", borderBottom: "2px solid #d97706", marginBottom: "4px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#d97706" }}>Aguardando Reagendamento</h2>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#FFF", backgroundColor: "#d97706", borderRadius: "9999px", padding: "2px 10px" }}>
              {openDeals.length} deals
            </span>
          </div>
          <DealsTable deals={openDeals} title="Deals em No-Show" />
        </>
      )}

      {/* Lost after no-show */}
      {lostDeals.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0 4px", borderBottom: "2px solid #dc2626", marginBottom: "4px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#dc2626" }}>Perdidos após No-Show</h2>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#FFF", backgroundColor: "#dc2626", borderRadius: "9999px", padding: "2px 10px" }}>
              {lostDeals.length} deals
            </span>
          </div>
          <DealsTable deals={lostDeals} title="Deals Perdidos" />
        </>
      )}

      {/* Won after no-show (recoveries) */}
      {wonDeals.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0 4px", borderBottom: "2px solid #16a34a", marginBottom: "4px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#16a34a" }}>Recuperados após No-Show</h2>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#FFF", backgroundColor: "#16a34a", borderRadius: "9999px", padding: "2px 10px" }}>
              {wonDeals.length} deals
            </span>
          </div>
          <DealsTable deals={wonDeals} title="Deals Recuperados" />
        </>
      )}

      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
