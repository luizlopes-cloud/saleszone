"use client";

import React, { useState, useMemo } from "react";
import { T } from "@/lib/constants";
import type { NoShowData, NoShowEventRow, NoShowCloserRow, NoShowAlert } from "@/lib/types";
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

function ClosersTable({ closers }: { closers: NoShowCloserRow[] }) {
  if (closers.length === 0) return null;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>Taxa por Closer</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Closer</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Agendados</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cancelados</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Taxa</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Média 7d</th>
            </tr>
          </thead>
          <tbody>
            {closers.map((c) => {
              const rateColor = c.rate >= 40 ? "#dc2626" : c.rate >= 30 ? "#d97706" : "#16a34a";
              return (
                <tr key={c.closer_email}>
                  <td style={tdStyle}>{c.closer_name}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{c.scheduled}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{c.cancelled}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: rateColor, fontWeight: 600 }}>{c.rate}%</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{c.avg7d}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsTable({ events }: { events: NoShowEventRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? events : events.slice(0, 20);

  if (events.length === 0) return null;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>Eventos Cancelados ({events.length})</h3>
        {events.length > 20 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ fontSize: "11px", color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
          >
            {expanded ? "Mostrar menos" : `Ver todos (${events.length})`}
          </button>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Data</th>
              <th style={thStyle}>Hora</th>
              <th style={thStyle}>Closer</th>
              <th style={thStyle}>Empreendimento</th>
              <th style={thStyle}>Título</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={`${e.dia}-${e.hora}-${e.closer_email}-${i}`}>
                <td style={tdStyle}>{e.dia.split("-").reverse().join("/")}</td>
                <td style={tdStyle}>{e.hora?.slice(0, 5) || "—"}</td>
                <td style={tdStyle}>{e.closer_name}</td>
                <td style={tdStyle}>{e.empreendimento || "—"}</td>
                <td style={{ ...tdStyle, maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis" }}>{e.titulo}</td>
              </tr>
            ))}
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

  const { summary, closers, events, alerts, trend } = data;

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
          Pipeline SZI · Calendar · {summary.total_cancelled} cancelamentos
        </span>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <SummaryCard label="Agendados" value={summary.total_scheduled} />
        <SummaryCard
          label="Cancelados"
          value={summary.total_cancelled}
          color="#dc2626"
        />
        <SummaryCard
          label="Taxa No-Show"
          value={`${summary.noshow_rate}%`}
          sub={`${summary.total_cancelled}/${summary.total_scheduled} eventos`}
          color={summary.noshow_rate > 30 ? "#d97706" : undefined}
        />
      </div>

      {/* Trend + Alerts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <TrendMini dates={trend.dates} totals={trend.totals} />
        <div style={{ flex: "1 1 0", minWidth: "300px" }}>
          <AlertBox alerts={alerts} />
        </div>
      </div>

      {/* Distribution: Closer + Empreendimento */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <DistributionBars data={summary.by_closer} total={summary.total_cancelled} title="Cancelamentos por Closer" />
        <DistributionBars data={summary.by_empreendimento} total={summary.total_cancelled} title="Cancelamentos por Empreendimento" />
      </div>

      {/* Closers table */}
      <ClosersTable closers={closers} />

      {/* Cancelled events */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0 4px", borderBottom: "2px solid #dc2626", marginBottom: "4px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#dc2626" }}>Eventos Cancelados</h2>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#FFF", backgroundColor: "#dc2626", borderRadius: "9999px", padding: "2px 10px" }}>
          {events.length} eventos
        </span>
      </div>
      <EventsTable events={events} />

      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
