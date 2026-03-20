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

/** SZS advanced stages */
const SZS_ADVANCED_STAGES = ["Aguardando Dados", "Contrato"];
/** SZI advanced stages */
const SZI_ADVANCED_STAGES = ["Fila de Espera", "Reserva", "Contrato"];

function isAdvancedStage(deal: LostDealRow): boolean {
  const pipe = deal.pipeline_name?.toLowerCase() ?? "szs";
  if (pipe.includes("szi")) return SZI_ADVANCED_STAGES.includes(deal.stage_name);
  return SZS_ADVANCED_STAGES.includes(deal.stage_name);
}

function isSameDay(deal: LostDealRow): boolean {
  return deal.days_in_funnel === 0;
}

function hasTimingReason(deal: LostDealRow): boolean {
  return deal.lost_reason?.toLowerCase() === "timing";
}

// ─── Reusable Components ───

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "16px 20px",
        minWidth: "130px",
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

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 0 4px",
        borderBottom: `2px solid ${color}`,
        marginBottom: "12px",
      }}
    >
      <h2 style={{ fontSize: "15px", fontWeight: 700, color }}>{title}</h2>
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#FFF",
          backgroundColor: color,
          borderRadius: "9999px",
          padding: "2px 10px",
        }}
      >
        {count} deals
      </span>
    </div>
  );
}

function AlertBox({ title, items, severity }: { title: string; items: { deal: LostDealRow; extra?: string }[]; severity: "critical" | "warning" | "info" }) {
  const c = SEVERITY_COLORS[severity];
  if (items.length === 0) return null;
  return (
    <div style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: "10px", padding: "12px 16px", marginBottom: "8px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: c.fg, marginBottom: "6px" }}>
        {title} ({items.length})
      </div>
      {items.map(({ deal, extra }) => (
        <div key={deal.deal_id} style={{ fontSize: "12px", color: "#141A3C", marginBottom: "3px", display: "flex", gap: "6px" }}>
          <span>•</span>
          <span>
            <a
              href={`https://seazone-fd92b9.pipedrive.com/deal/${deal.deal_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: T.primary, textDecoration: "none", fontWeight: 500 }}
            >
              #{deal.deal_id}
            </a>{" "}
            {deal.title.slice(0, 35)} — <strong>{deal.owner_name}</strong> · {deal.stage_name}
            {extra && <span style={{ color: "#6B6E84" }}> · {extra}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReasonsTable({ deals, total }: { deals: LostDealRow[]; total: number }) {
  const byReason = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of deals) {
      const r = d.lost_reason || "Sem motivo";
      map[r] = (map[r] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [deals]);

  if (byReason.length === 0) return null;
  const maxCount = byReason[0]?.[1] ?? 1;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px", flex: "1 1 0", minWidth: "280px" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>Motivos de Lost</h3>
      {byReason.map(([reason, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={reason} style={{ marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
              <span style={{ color: "#141A3C" }}>{reason}</span>
              <span style={{ color: "#6B6E84", fontVariantNumeric: "tabular-nums" }}>{count} ({pct}%)</span>
            </div>
            <div style={{ height: "6px", backgroundColor: "#E6E7EA", borderRadius: "3px" }}>
              <div style={{ height: "6px", borderRadius: "3px", backgroundColor: T.primary, width: `${(count / maxCount) * 100}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OwnersTable({ deals }: { deals: LostDealRow[] }) {
  const sorted = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of deals) map[d.owner_name] = (map[d.owner_name] || 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [deals]);

  if (sorted.length === 0) return null;
  const total = deals.length;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px", flex: "1 1 0", minWidth: "280px" }}>
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
              <td style={{ ...tdStyle, textAlign: "right", color: "#6B6E84" }}>{total > 0 ? Math.round((count / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactDealsTable({ deals, title, showReason }: { deals: LostDealRow[]; title?: string; showReason?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? deals : deals.slice(0, 10);

  if (deals.length === 0) return null;

  return (
    <div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "16px" }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>{title} ({deals.length})</h3>
          {deals.length > 10 && (
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
              <th style={thStyle}>Owner</th>
              <th style={thStyle}>Etapa</th>
              {showReason !== false && <th style={thStyle}>Motivo</th>}
              <th style={{ ...thStyle, textAlign: "right" }}>Dias</th>
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
                {showReason !== false && <td style={tdStyle}>{d.lost_reason || "—"}</td>}
                <td style={{ ...tdStyle, textAlign: "right" }}>{d.days_in_funnel}d</td>
                <td style={tdStyle}>{d.canal || "—"}</td>
                <td style={tdStyle}>{d.lost_hour}h</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, marginBottom: "8px" }}>Tendência 7 dias</h3>
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

// ─── Main View ───

export function LostsView({ data, loading, lastUpdated, lostsDate, onDateChange }: Props) {
  if (loading || !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
        <p style={{ fontSize: "14px" }}>{loading ? "Carregando dados de losts..." : "Sem dados de losts"}</p>
      </div>
    );
  }

  const { summary, deals, alerts, trend } = data;

  // Split deals by category
  const preVendasDeals = deals.filter((d) => d.stage_category === "pre_vendas");
  const vendasDeals = deals.filter((d) => d.stage_category === "vendas");

  // Pré-vendas: same-day losts (campaign misalignment)
  const sameDayDeals = preVendasDeals.filter(isSameDay);

  // Vendas: advanced stage losts — separated by pipeline
  const advancedDeals = vendasDeals.filter(isAdvancedStage);
  const advancedSZS = advancedDeals.filter((d) => !(d.pipeline_name?.toLowerCase() ?? "").includes("szi"));
  const advancedSZI = advancedDeals.filter((d) => (d.pipeline_name?.toLowerCase() ?? "").includes("szi"));

  // Timing deals without next activity (warning)
  const timingNoActivity = deals.filter((d) => hasTimingReason(d) && !d.next_activity_date);

  // Timing deals WITH scheduled activity (retomadas da semana)
  const timingRetomadas = deals.filter((d) => hasTimingReason(d) && d.next_activity_date);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Date picker row */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ fontSize: "12px", color: "#6B6E84", fontWeight: 500 }}>Data:</label>
        <input
          type="date"
          value={lostsDate}
          onChange={(e) => onDateChange(e.target.value)}
          style={{ fontSize: "12px", padding: "6px 10px", border: "1px solid #E6E7EA", borderRadius: "8px", color: T.fg }}
        />
        <span style={{ fontSize: "12px", color: "#6B6E84" }}>
          Pipeline SZS · {summary.total} deals lost
        </span>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <SummaryCard label="Total Lost" value={summary.total} />
        <SummaryCard label="Pré-vendas" value={summary.pre_vendas} sub={`${summary.pre_vendas_pct}%`} color="#2563eb" />
        <SummaryCard label="Vendas" value={summary.vendas} sub={`${summary.vendas_pct}%`} color="#dc2626" />
        <SummaryCard label="Mediana Funil" value={summary.median_days_in_funnel != null ? `${summary.median_days_in_funnel}d` : "—"} />
        <SummaryCard
          label="Same-day"
          value={`${summary.same_day_lost_pct}%`}
          sub={`${sameDayDeals.length} deals`}
          color={summary.same_day_lost_pct > 20 ? "#d97706" : undefined}
        />
        <SummaryCard
          label="Batch 18h+"
          value={`${summary.batch_after_18h_pct}%`}
          color={summary.batch_after_18h_pct > 60 ? "#d97706" : undefined}
        />
      </div>

      {/* Trend */}
      <TrendMini dates={trend.dates} totals={trend.totals} />

      {/* ════════════════ PRÉ-VENDAS ════════════════ */}
      <SectionHeader title="Pré-vendas" count={preVendasDeals.length} color="#2563eb" />

      {/* 🚨 Desalinhamento de Campanha (same-day losts) */}
      {sameDayDeals.length > 0 && (
        <AlertBox
          title="Desalinhamento de Campanha — Deals perdidos no mesmo dia da criação"
          items={sameDayDeals.map((d) => ({ deal: d, extra: d.lost_reason || undefined }))}
          severity="critical"
        />
      )}

      {/* Motivos + Owners lado a lado */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <ReasonsTable deals={preVendasDeals} total={preVendasDeals.length} />
        <OwnersTable deals={preVendasDeals} />
      </div>

      {/* Tabela Pré-vendas */}
      <CompactDealsTable deals={preVendasDeals} title="Deals Pré-vendas" />

      {/* ════════════════ VENDAS ════════════════ */}
      <SectionHeader title="Vendas" count={vendasDeals.length} color="#dc2626" />

      {/* 🚨 Losts em Etapas Avançadas — separados por pipeline */}
      {advancedSZS.length > 0 && (
        <AlertBox
          title="Losts em Etapas Avançadas — SZS (Aguardando Dados, Contrato)"
          items={advancedSZS.map((d) => ({ deal: d, extra: `${d.days_in_funnel}d no funil` }))}
          severity="critical"
        />
      )}
      {advancedSZI.length > 0 && (
        <AlertBox
          title="Losts em Etapas Avançadas — SZI (Fila de Espera, Reserva, Contrato)"
          items={advancedSZI.map((d) => ({ deal: d, extra: `${d.days_in_funnel}d no funil` }))}
          severity="critical"
        />
      )}

      {/* ⚠️ Timing sem Atividade Futura */}
      {timingNoActivity.length > 0 && (
        <AlertBox
          title="Timing sem Atividade Futura Programada"
          items={timingNoActivity.map((d) => ({ deal: d, extra: `${d.days_in_funnel}d no funil` }))}
          severity="warning"
        />
      )}

      {/* 📋 Retomadas da Semana */}
      {timingRetomadas.length > 0 && (
        <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a", marginBottom: "6px" }}>
            Retomadas da Semana — Timing com atividade programada ({timingRetomadas.length})
          </div>
          {timingRetomadas.map((d) => (
            <div key={d.deal_id} style={{ fontSize: "12px", color: "#141A3C", marginBottom: "3px", display: "flex", gap: "6px" }}>
              <span>•</span>
              <span>
                <a
                  href={`https://seazone-fd92b9.pipedrive.com/deal/${d.deal_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.primary, textDecoration: "none", fontWeight: 500 }}
                >
                  #{d.deal_id}
                </a>{" "}
                {d.title.slice(0, 35)} — <strong>{d.owner_name}</strong>
                <span style={{ color: "#6B6E84" }}> · Atividade: {d.next_activity_date}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Motivos + Owners lado a lado */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <ReasonsTable deals={vendasDeals} total={vendasDeals.length} />
        <OwnersTable deals={vendasDeals} />
      </div>

      {/* Tabela Vendas */}
      <CompactDealsTable deals={vendasDeals} title="Deals Vendas" />

      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
