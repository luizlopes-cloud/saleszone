"use client";

import { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/constants";

/* ── Interfaces ── */
interface MonitorMetric {
  seller_name: string;
  seller_email: string;
  role: string;
  pipeline_slug: string;
  wpp_response_time_median_min: number | null;
  wpp_messages_sent: number;
  wpp_messages_received: number;
  wpp_chats_unanswered_2h: number;
  wpp_chats_unanswered_8h: number;
  wpp_chats_unanswered_24h: number;
  calls_made: number;
  calls_received: number;
  calls_answered: number;
  calls_missed: number;
  call_answer_rate: number | null;
  overall_activity_score: number | null;
}

interface MonitorAlert {
  id: string;
  seller_name: string;
  alert_type: string;
  severity: string;
  message: string;
  date: string;
}

interface MonitorData {
  date: string;
  totalSellers: number;
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  unanswered: { h2: number; h8: number; h24: number };
  baselines: {
    wpp_response_time_median_min: number | null;
    call_answer_rate_median: number | null;
    calls_made_median: number | null;
  } | null;
  metrics: MonitorMetric[];
  alerts: MonitorAlert[];
  updatedAt: string;
}

interface Props {
  pipelineSlug: string;
  dateFrom: string;
  dateTo: string;
}

/* ── Helpers ── */
function fmt(v: number | null, suffix = ""): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(1)}${suffix}`;
}

function severityColor(sev: string): { bg: string; fg: string } {
  switch (sev.toLowerCase()) {
    case "critical":
      return { bg: T.vermelho50, fg: T.destructive };
    case "warning":
      return { bg: "#FEF3C7", fg: T.laranja500 };
    default:
      return { bg: T.verde50, fg: T.verde700 };
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return T.mutedFg;
  if (score >= 80) return T.verde600;
  if (score >= 50) return T.laranja500;
  return T.destructive;
}

/* ── Component ── */
export default function SquadMonitorView({ pipelineSlug, dateFrom, dateTo }: Props) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>("overall_activity_score");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        pipeline: pipelineSlug,
        from: dateFrom,
        to: dateTo,
      });
      const res = await fetch(`/api/squad/monitor?${params}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [pipelineSlug, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 64,
          fontFamily: T.font,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: `3px solid ${T.muted}`,
            borderTopColor: T.primary,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ marginLeft: 12, color: T.mutedFg, fontSize: 14 }}>
          Carregando monitor...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div
        style={{
          margin: 24,
          padding: 20,
          background: T.vermelho50,
          borderRadius: 8,
          border: `1px solid ${T.destructive}`,
          fontFamily: T.font,
        }}
      >
        <span style={{ color: T.destructive, fontWeight: 600, fontSize: 14 }}>
          Erro ao carregar dados do monitor
        </span>
        <p style={{ color: T.cardFg, fontSize: 13, margin: "8px 0 0" }}>{error}</p>
        <button
          onClick={fetchData}
          style={{
            marginTop: 12,
            padding: "6px 16px",
            background: T.primary,
            color: T.primaryFg,
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  /* ── Empty ── */
  if (!data || data.metrics.length === 0) {
    return (
      <div
        style={{
          margin: 24,
          padding: 40,
          textAlign: "center",
          color: T.mutedFg,
          fontFamily: T.font,
          fontSize: 14,
        }}
      >
        Nenhum dado de monitoramento disponivel para o periodo selecionado.
      </div>
    );
  }

  /* ── Sort logic ── */
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const sorted = [...data.metrics].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortCol];
    const bv = (b as unknown as Record<string, unknown>)[sortCol];
    const na = typeof av === "number" ? av : -Infinity;
    const nb = typeof bv === "number" ? bv : -Infinity;
    return sortAsc ? na - nb : nb - na;
  });

  const sortArrow = (col: string) =>
    sortCol === col ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  /* ── Shared styles ── */
  const cardStyle: React.CSSProperties = {
    background: T.card,
    borderRadius: 10,
    padding: 20,
    boxShadow: T.elevSm,
    border: `1px solid ${T.border}`,
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left" as const,
    fontSize: 11,
    fontWeight: 600,
    color: T.mutedFg,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    borderBottom: `2px solid ${T.border}`,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    userSelect: "none" as const,
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 13,
    color: T.cardFg,
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: "nowrap" as const,
  };

  /* ── Summary cards ── */
  const summaryCards = [
    { label: "Vendedores", value: data.totalSellers, color: T.primary },
    { label: "Alertas Totais", value: data.totalAlerts, color: T.laranja500 },
    { label: "Criticos", value: data.criticalAlerts, color: T.destructive },
    { label: "Avisos", value: data.warningAlerts, color: "#F59E0B" },
    { label: "Sem Resposta >2h", value: data.unanswered.h2, color: T.laranja500 },
    { label: "Sem Resposta >8h", value: data.unanswered.h8, color: T.destructive },
    { label: "Sem Resposta >24h", value: data.unanswered.h24, color: T.destructive },
  ];

  return (
    <div style={{ padding: "0 24px 40px", fontFamily: T.font }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.fg, margin: 0 }}>
            Monitor de Atendimento
          </h2>
          <span style={{ fontSize: 12, color: T.mutedFg }}>
            {data.date} &middot; Atualizado {new Date(data.updatedAt).toLocaleString("pt-BR")}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {summaryCards.map((c) => (
          <div key={c.label} style={cardStyle}>
            <div style={{ fontSize: 11, color: T.mutedFg, marginBottom: 4, fontWeight: 500 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Baselines */}
      {data.baselines && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: T.fg, margin: "0 0 12px" }}>
            Baselines da Equipe
          </h3>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: 11, color: T.mutedFg }}>Tempo Resp. WhatsApp (mediana)</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.primary }}>
                {fmt(data.baselines.wpp_response_time_median_min, " min")}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: T.mutedFg }}>Taxa Atend. Chamadas (mediana)</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.verde600 }}>
                {fmt(
                  data.baselines.call_answer_rate_median !== null
                    ? data.baselines.call_answer_rate_median * 100
                    : null,
                  "%"
                )}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: T.mutedFg }}>Chamadas Realizadas (mediana)</span>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.cardFg }}>
                {fmt(data.baselines.calls_made_median)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {data.alerts.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: T.fg, margin: "0 0 12px" }}>
            Alertas ({data.alerts.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.alerts.map((alert) => {
              const sev = severityColor(alert.severity);
              return (
                <div
                  key={alert.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: sev.bg,
                    borderRadius: 8,
                    borderLeft: `4px solid ${sev.fg}`,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: sev.fg,
                      background: `${sev.fg}18`,
                      letterSpacing: 0.5,
                    }}
                  >
                    {alert.severity}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.cardFg, minWidth: 120 }}>
                    {alert.seller_name}
                  </span>
                  <span style={{ fontSize: 12, color: T.mutedFg, flex: 1 }}>{alert.message}</span>
                  <span style={{ fontSize: 11, color: T.mutedFg }}>{alert.alert_type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chats Sem Resposta */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: T.fg, margin: "0 0 12px" }}>
          Chats Sem Resposta por Vendedor
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Vendedor</th>
                <th style={thStyle}>Cargo</th>
                <th style={{ ...thStyle, textAlign: "center" }}>&gt;2h</th>
                <th style={{ ...thStyle, textAlign: "center" }}>&gt;8h</th>
                <th style={{ ...thStyle, textAlign: "center" }}>&gt;24h</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Tempo Resp. (min)</th>
              </tr>
            </thead>
            <tbody>
              {sorted
                .filter(
                  (m) =>
                    m.wpp_chats_unanswered_2h > 0 ||
                    m.wpp_chats_unanswered_8h > 0 ||
                    m.wpp_chats_unanswered_24h > 0
                )
                .sort(
                  (a, b) =>
                    b.wpp_chats_unanswered_24h - a.wpp_chats_unanswered_24h ||
                    b.wpp_chats_unanswered_8h - a.wpp_chats_unanswered_8h
                )
                .map((m) => (
                  <tr key={`unanswered-${m.seller_email}`}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{m.seller_name}</span>
                    </td>
                    <td style={tdStyle}>{m.role}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                        color: m.wpp_chats_unanswered_2h > 0 ? T.laranja500 : T.mutedFg,
                        fontWeight: m.wpp_chats_unanswered_2h > 0 ? 700 : 400,
                      }}
                    >
                      {m.wpp_chats_unanswered_2h}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                        color: m.wpp_chats_unanswered_8h > 0 ? T.destructive : T.mutedFg,
                        fontWeight: m.wpp_chats_unanswered_8h > 0 ? 700 : 400,
                      }}
                    >
                      {m.wpp_chats_unanswered_8h}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                        color: m.wpp_chats_unanswered_24h > 0 ? T.destructive : T.mutedFg,
                        fontWeight: m.wpp_chats_unanswered_24h > 0 ? 700 : 400,
                      }}
                    >
                      {m.wpp_chats_unanswered_24h}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {fmt(m.wpp_response_time_median_min)}
                    </td>
                  </tr>
                ))}
              {sorted.filter(
                (m) =>
                  m.wpp_chats_unanswered_2h > 0 ||
                  m.wpp_chats_unanswered_8h > 0 ||
                  m.wpp_chats_unanswered_24h > 0
              ).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ ...tdStyle, textAlign: "center", color: T.verde600, fontWeight: 500 }}
                  >
                    Nenhum chat sem resposta
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Summary Table */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: T.fg, margin: "0 0 12px" }}>
          Resumo de Atividade
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort("seller_name")}>
                  Vendedor{sortArrow("seller_name")}
                </th>
                <th style={thStyle} onClick={() => toggleSort("role")}>
                  Cargo{sortArrow("role")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("wpp_messages_sent")}
                >
                  Msgs Env.{sortArrow("wpp_messages_sent")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("wpp_messages_received")}
                >
                  Msgs Rec.{sortArrow("wpp_messages_received")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("wpp_response_time_median_min")}
                >
                  Tempo Resp.{sortArrow("wpp_response_time_median_min")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("calls_made")}
                >
                  Lig. Feitas{sortArrow("calls_made")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("calls_answered")}
                >
                  Lig. Atend.{sortArrow("calls_answered")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("calls_missed")}
                >
                  Lig. Perd.{sortArrow("calls_missed")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("call_answer_rate")}
                >
                  Taxa Atend.{sortArrow("call_answer_rate")}
                </th>
                <th
                  style={{ ...thStyle, textAlign: "center" }}
                  onClick={() => toggleSort("overall_activity_score")}
                >
                  Score{sortArrow("overall_activity_score")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.seller_email}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{m.seller_name}</span>
                    <br />
                    <span style={{ fontSize: 11, color: T.mutedFg }}>{m.seller_email}</span>
                  </td>
                  <td style={tdStyle}>{m.role}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{m.wpp_messages_sent}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{m.wpp_messages_received}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {fmt(m.wpp_response_time_median_min, " min")}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{m.calls_made}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{m.calls_answered}</td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      color: m.calls_missed > 3 ? T.destructive : T.cardFg,
                      fontWeight: m.calls_missed > 3 ? 700 : 400,
                    }}
                  >
                    {m.calls_missed}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {m.call_answer_rate !== null
                      ? `${(m.call_answer_rate * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      fontWeight: 700,
                      color: scoreColor(m.overall_activity_score),
                    }}
                  >
                    {m.overall_activity_score !== null
                      ? m.overall_activity_score.toFixed(0)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
