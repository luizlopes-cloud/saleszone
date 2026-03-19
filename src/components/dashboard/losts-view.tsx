"use client";

import React, { useState, useMemo } from "react";
import { T } from "@/lib/constants";
import type { LostsData, LostDealRow, LostAlert } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: LostsData | null;
  loading: boolean;
  lastUpdated?: Date | null;
  lostsDate: string;
  onDateChange: (d: string) => void;
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

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "16px 20px",
        minWidth: "140px",
        flex: "1 1 0",
      }}
    >
      <div style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700, color: color || T.fg, fontVariantNumeric: "tabular-nums" }}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "#6B6E84", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

function AlertsBanner({ alerts }: { alerts: LostAlert[] }) {
  const criticals = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos = alerts.filter((a) => a.severity === "info");

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {criticals.length > 0 && (
        <div style={{ backgroundColor: SEVERITY_COLORS.critical.bg, border: `1px solid ${SEVERITY_COLORS.critical.border}`, borderRadius: "10px", padding: "12px 16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: SEVERITY_COLORS.critical.fg, marginBottom: "6px" }}>
            {criticals.length} alerta{criticals.length > 1 ? "s" : ""} cr\u00edtico{criticals.length > 1 ? "s" : ""}
          </div>
          {criticals.map((a, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#141A3C", marginBottom: "3px" }}>
              \u2022 <strong>{a.seller_name}</strong>: {a.message}
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ backgroundColor: SEVERITY_COLORS.warning.bg, border: `1px solid ${SEVERITY_COLORS.warning.border}`, borderRadius: "10px", padding: "12px 16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: SEVERITY_COLORS.warning.fg, marginBottom: "6px" }}>
            {warnings.length} warning{warnings.length > 1 ? "s" : ""}
          </div>
          {warnings.map((a, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#141A3C", marginBottom: "3px" }}>
              \u2022 <strong>{a.seller_name}</strong> [{a.alert_type}]: {a.message}
            </div>
          ))}
        </div>
      )}
      {infos.length > 0 && (
        <div style={{ backgroundColor: SEVERITY_COLORS.info.bg, border: `1px solid ${SEVERITY_COLORS.info.border}`, borderRadius: "10px", padding: "12px 16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: SEVERITY_COLORS.info.fg, marginBottom: "6px" }}>
            {infos.length} observa\u00e7\u00e3o{infos.length > 1 ? "\u00f5es" : ""}
          </div>
          {infos.map((a, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#141A3C", marginBottom: "3px" }}>
              \u2022 {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReasonsTable({ byReason, total }: { byReason: Record<string, number>; total: number }) {
  const sorted = useMemo(
    () => Object.entries(byReason).sort((a, b) => b[1] - a[1]),
    [byReason]
  );
  if (sorted.length === 0) return null;

  const maxCount = sorted[0]?.[1] ?? 1;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px", flex: "1 1 0", minWidth: "320px" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>Motivos de Lost</h3>
      {sorted.map(([reason, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={reason} style={{ marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
              <span style={{ color: "#141A3C" }}>{reason}</span>
              <span style={{ color: "#6B6E84", fontVariantNumeric: "tabular-nums" }}>{count} ({pct}%)</span>
            </div>
            <div style={{ height: "6px", backgroundColor: "#E6E7EA", borderRadius: "3px" }}>
              <div
                style={{
                  height: "6px",
                  borderRadius: "3px",
                  backgroundColor: T.primary,
                  width: `${(count / maxCount) * 100}%`,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OwnersTable({ byOwner, total }: { byOwner: Record<string, number>; total: number }) {
  const sorted = useMemo(
    () => Object.entries(byOwner).sort((a, b) => b[1] - a[1]),
    [byOwner]
  );
  if (sorted.length === 0) return null;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px", flex: "1 1 0", minWidth: "320px" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>Volume por Owner</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Owner</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Deals</th>
            <th style={{ ...thStyle, textAlign: "right" }}>%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 10).map(([owner, count]) => (
            <tr key={owner}>
              <td style={tdStyle}>{owner}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{count}</td>
              <td style={{ ...tdStyle, textAlign: "right", color: "#6B6E84" }}>
                {total > 0 ? Math.round((count / total) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StageBreakdown({ preVendas, vendas, preVendasPct, vendasPct }: { preVendas: number; vendas: number; preVendasPct: number; vendasPct: number }) {
  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px", minWidth: "200px" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>Fase do Funil</h3>
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#2563eb" }}>{preVendas}</div>
          <div style={{ fontSize: "11px", color: "#6B6E84" }}>Pr\u00e9-vendas ({preVendasPct}%)</div>
        </div>
        <div style={{ width: "1px", backgroundColor: "#E6E7EA" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#dc2626" }}>{vendas}</div>
          <div style={{ fontSize: "11px", color: "#6B6E84" }}>Vendas ({vendasPct}%)</div>
        </div>
      </div>
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
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "8px" }}>Tend\u00eancia 7 dias</h3>
      <svg width={w} height={h} style={{ display: "block" }}>
        <polyline points={points.join(" ")} fill="none" stroke={T.primary} strokeWidth="2" />
        {totals.map((v, i) => {
          const x = (i / (totals.length - 1)) * w;
          const y = h - (v / max) * h;
          return <circle key={i} cx={x} cy={y} r="3" fill={T.primary} />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#6B6E84", marginTop: "4px" }}>
        <span>{dates[0]?.slice(5)}</span>
        <span>{dates[dates.length - 1]?.slice(5)}</span>
      </div>
    </div>
  );
}

function DealsTable({ deals }: { deals: LostDealRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? deals : deals.slice(0, 15);

  if (deals.length === 0) return null;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>Deals Lost ({deals.length})</h3>
        {deals.length > 15 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontSize: "11px",
              color: T.primary,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {expanded ? "Mostrar menos" : `Ver todos (${deals.length})`}
          </button>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Deal</th>
              <th style={thStyle}>Owner</th>
              <th style={thStyle}>Etapa</th>
              <th style={thStyle}>Fase</th>
              <th style={thStyle}>Motivo</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Dias no Funil</th>
              <th style={thStyle}>Canal</th>
              <th style={thStyle}>Hora</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
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
                <td style={tdStyle}>{d.owner_name}</td>
                <td style={tdStyle}>{d.stage_name}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      backgroundColor: d.stage_category === "vendas" ? "#fee2e2" : "#dbeafe",
                      color: d.stage_category === "vendas" ? "#dc2626" : "#2563eb",
                      fontWeight: 500,
                    }}
                  >
                    {d.stage_category === "vendas" ? "Vendas" : "Pr\u00e9-vendas"}
                  </span>
                </td>
                <td style={tdStyle}>{d.lost_reason || "\u2014"}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{d.days_in_funnel}d</td>
                <td style={tdStyle}>{d.canal || "\u2014"}</td>
                <td style={tdStyle}>{d.lost_hour}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LostsView({ data, loading, lastUpdated, lostsDate, onDateChange }: Props) {
  if (loading || !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
        <p style={{ fontSize: "14px" }}>{loading ? "Carregando dados de losts..." : "Sem dados de losts"}</p>
      </div>
    );
  }

  const { summary, deals, alerts, trend } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Date picker row */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ fontSize: "12px", color: "#6B6E84", fontWeight: 500 }}>Data:</label>
        <input
          type="date"
          value={lostsDate}
          onChange={(e) => onDateChange(e.target.value)}
          style={{
            fontSize: "12px",
            padding: "6px 10px",
            border: "1px solid #E6E7EA",
            borderRadius: "8px",
            color: T.fg,
          }}
        />
        <span style={{ fontSize: "12px", color: "#6B6E84" }}>
          Pipeline SZS \u00b7 {summary.total} deals lost
        </span>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <SummaryCard label="Total Lost" value={summary.total} />
        <SummaryCard label="Mediana no Funil" value={summary.median_days_in_funnel != null ? `${summary.median_days_in_funnel}d` : "\u2014"} />
        <SummaryCard label="Same-day Lost" value={`${summary.same_day_lost_pct}%`} />
        <SummaryCard
          label="Batch (ap\u00f3s 18h)"
          value={`${summary.batch_after_18h_pct}%`}
          color={summary.batch_after_18h_pct > 60 ? "#d97706" : undefined}
        />
        <SummaryCard
          label="Alertas"
          value={alerts.length}
          sub={`${alerts.filter((a) => a.severity === "critical").length} cr\u00edticos`}
          color={alerts.some((a) => a.severity === "critical") ? "#dc2626" : undefined}
        />
      </div>

      {/* Alerts */}
      <AlertsBanner alerts={alerts} />

      {/* Middle row: reasons + owners */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <ReasonsTable byReason={summary.by_reason} total={summary.total} />
        <OwnersTable byOwner={summary.by_owner} total={summary.total} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <StageBreakdown
          preVendas={summary.pre_vendas}
          vendas={summary.vendas}
          preVendasPct={summary.pre_vendas_pct}
          vendasPct={summary.vendas_pct}
        />
        <TrendMini dates={trend.dates} totals={trend.totals} />
      </div>

      {/* Deals table */}
      <DealsTable deals={deals} />

      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
