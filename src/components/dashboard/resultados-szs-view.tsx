"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { T } from "@/lib/constants";

interface MetricPair { real: number; meta: number }

interface ChannelResult {
  name: string;
  filterDescription: string;
  metrics: {
    orcamento?: MetricPair;
    leads?: MetricPair;
    mql: MetricPair;
    sql: MetricPair;
    opp: MetricPair;
    won: MetricPair;
  };
  lastMonthWon: number;
  snapshots: { aguardandoDados: number; emContrato: number; totalOpen: number };
  ocupacaoAgenda: { agendadas: number; capacidade: number; percent: number; closers?: string[]; meetingsPerDay?: number; workDays?: number };
  dealsHistory: { date: string; total: number; openTotal: number; byStage: Record<string, number> }[];
}

interface ResultadosSZSData {
  month: string;
  channels: ChannelResult[];
}

interface Props {
  data: ResultadosSZSData | null;
  loading: boolean;
  lastUpdated?: Date | null;
}

const CHANNEL_ICONS: Record<string, string> = {
  "Vendas Diretas": "🎯",
  Parceiros: "🤝",
  "Expansão": "🚀",
};

const CHANNEL_ACCENT: Record<string, string> = {
  "Vendas Diretas": "rgba(59,130,246,0.04)",
  Parceiros: "rgba(168,85,247,0.04)",
  "Expansão": "rgba(234,179,8,0.04)",
};

function progressColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#3b82f6";
  if (pct >= 40) return "#f97316";
  return "#ef4444";
}

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function fmtMoney(n: number): string {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${fmtNum(n)}`;
}

function ProgressBar({ label, real, meta, isMoney }: { label: string; real: number; meta: number; isMoney?: boolean }) {
  const pct = meta > 0 ? Math.round((real / meta) * 1000) / 10 : 0;
  const clampedWidth = Math.min(pct, 100);
  const color = progressColor(pct);
  const fmt = isMoney ? fmtMoney : fmtNum;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.cinza600, marginBottom: 3 }}>
        <span>{label}</span>
        <span>{fmt(real)} / {fmt(meta)}</span>
      </div>
      <div style={{ height: 22, background: T.cinza50, borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${clampedWidth}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            paddingLeft: 8,
            fontSize: 10,
            color: "#fff",
            fontWeight: 600,
            minWidth: 40,
          }}
        >
          {pct.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function AreaChart({ data, color }: { data: { date: string; value: number }[]; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <div style={{ fontSize: 11, color: T.cinza400, padding: 20, textAlign: "center" }}>Dados insuficientes</div>;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const W = 500;
  const H = 70;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d.value / maxVal) * (H - 5),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" L");
  const area = `M${line} L${W},${H} L0,${H} Z`;
  const last = data[data.length - 1];
  const active = hover !== null ? data[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(x * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, idx)));
        }}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${color.replace("#", "")})`} opacity={0.3} />
        <path d={`M${line}`} fill="none" stroke={color} strokeWidth={2} />
        {hover !== null && (
          <>
            <line x1={points[hover].x} y1={0} x2={points[hover].x} y2={H} stroke={color} strokeWidth={1} opacity={0.5} strokeDasharray="3" />
            <circle cx={points[hover].x} cy={points[hover].y} r={3} fill={color} />
          </>
        )}
      </svg>
      {active ? (
        <div style={{ position: "absolute", top: -2, right: 0, fontSize: 10, color, fontWeight: 600 }}>
          {active.date.substring(5).replace("-", "/")} · {active.value}
        </div>
      ) : (
        <div style={{ position: "absolute", top: -2, right: 0, fontSize: 10, color, fontWeight: 600 }}>
          Hoje: {last.value}
        </div>
      )}
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  mql: "#60a5fa", sql: "#a855f7", opp: "#fbbf24", won: "#22c55e", reserva: "#f97316", contrato: "#ef4444",
};

const STAGE_LABELS: Record<string, string> = {
  mql: "MQL", sql: "SQL", opp: "OPP", won: "WON", reserva: "Ag.Dados", contrato: "Contrato",
};

function MultiLineChart({ data }: { data: { date: string; byStage: Record<string, number> }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <div style={{ fontSize: 11, color: T.cinza400, padding: 20, textAlign: "center" }}>Dados insuficientes</div>;
  const stages = Object.keys(STAGE_COLORS);
  const maxVal = Math.max(...data.flatMap((d) => stages.map((s) => d.byStage[s] || 0)), 1);
  const W = 500;
  const H = 70;
  const active = hover !== null ? data[hover] : null;
  const last = data[data.length - 1];
  const display = active || last;

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(x * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, idx)));
        }}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: "crosshair" }}
      >
        {stages.map((stage) => {
          const points = data.map((d, i) => {
            const x = (i / (data.length - 1)) * W;
            const y = H - ((d.byStage[stage] || 0) / maxVal) * (H - 5);
            return `${x},${y}`;
          });
          const isDashed = stage === "reserva" || stage === "contrato";
          return (
            <path
              key={stage}
              d={`M${points.join(" L")}`}
              fill="none"
              stroke={STAGE_COLORS[stage]}
              strokeWidth={1.5}
              strokeDasharray={isDashed ? "4" : undefined}
            />
          );
        })}
        {hover !== null && (
          <line x1={(hover / (data.length - 1)) * W} y1={0} x2={(hover / (data.length - 1)) * W} y2={H} stroke={T.cinza400} strokeWidth={1} opacity={0.5} strokeDasharray="3" />
        )}
      </svg>
      <div style={{ display: "flex", gap: 6, fontSize: 9, marginTop: 2, color: T.cinza400 }}>
        <span style={{ fontWeight: 600 }}>{display.date.substring(5).replace("-", "/")}</span>
        {stages.map((s) => (
          <span key={s} style={{ color: STAGE_COLORS[s] }}>{STAGE_LABELS[s]}: {display.byStage[s] || 0}</span>
        ))}
      </div>
    </div>
  );
}

function ChannelCard({ channel, historyDays }: { channel: ChannelResult; historyDays: number }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { metrics, snapshots, ocupacaoAgenda, dealsHistory, lastMonthWon, name } = channel;
  const icon = CHANNEL_ICONS[name] || "📊";
  const accent = CHANNEL_ACCENT[name] || "transparent";

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - historyDays);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  const filteredHistory = dealsHistory.filter((h) => h.date >= cutoffStr);

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, background: accent, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.fg }}>
          {icon} {name}
        </span>
        <span style={{ fontSize: 13, color: T.cinza600 }}>
          ({fmtNum(metrics.won.real)}/{fmtNum(metrics.won.meta)} contratos) — LM: {fmtNum(lastMonthWon)}
        </span>
        <span
          style={{ position: "relative", cursor: "pointer", color: T.cinza400, fontSize: 14 }}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        >
          <Info size={14} />
          {tooltipOpen && (
            <div style={{
              position: "absolute", top: 20, left: -100, zIndex: 10, background: T.fg, color: "#fff",
              padding: "8px 12px", borderRadius: 6, fontSize: 11, width: 280, lineHeight: 1.4,
              boxShadow: T.elevSm, whiteSpace: "pre-line",
            }}>
              {channel.filterDescription}
            </div>
          )}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
        <div>
          {metrics.orcamento && <ProgressBar label="Orçamento" real={metrics.orcamento.real} meta={metrics.orcamento.meta} isMoney />}
          {metrics.leads && <ProgressBar label="Leads" real={metrics.leads.real} meta={metrics.leads.meta} />}
          <ProgressBar label="MQL" real={metrics.mql.real} meta={metrics.mql.meta} />
          <ProgressBar label="SQL" real={metrics.sql.real} meta={metrics.sql.meta} />
          <ProgressBar label="OPP" real={metrics.opp.real} meta={metrics.opp.meta} />
          <ProgressBar label="Ganhos (WON)" real={metrics.won.real} meta={metrics.won.meta} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "12px 14px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.fg }}>Deals Abertos no Funil</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.fg }}>{fmtNum(snapshots.totalOpen)}</span>
            </div>
            <AreaChart
              data={filteredHistory.map((h) => ({ date: h.date, value: h.openTotal || h.total }))}
              color={name === "Parceiros" ? "#a855f7" : name === "Expansão" ? "#eab308" : "#3b82f6"}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: T.cinza400, marginTop: 2 }}>
              <span>{filteredHistory[0]?.date.substring(5).replace("-", "/") || ""}</span>
              <span>{filteredHistory[filteredHistory.length - 1]?.date.substring(5).replace("-", "/") || ""}</span>
            </div>
          </div>
          <div style={{ padding: "12px 14px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.fg }}>Deals por Etapa</span>
              <div style={{ display: "flex", gap: 6, fontSize: 9 }}>
                {Object.entries(STAGE_LABELS).map(([key, lbl]) => (
                  <span key={key} style={{ color: STAGE_COLORS[key] }}>● {lbl}</span>
                ))}
              </div>
            </div>
            <MultiLineChart data={filteredHistory} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ padding: "14px 16px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.cinza600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Aguardando Dados</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fbbf24" }}>{fmtNum(snapshots.aguardandoDados)}</div>
          <div style={{ fontSize: 11, color: T.cinza400, marginTop: 4 }}>deals na etapa</div>
        </div>
        <div style={{ padding: "14px 16px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.cinza600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Em Contrato</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>{fmtNum(snapshots.emContrato)}</div>
          <div style={{ fontSize: 11, color: T.cinza400, marginTop: 4 }}>deals na etapa</div>
        </div>
        <div style={{ padding: "14px 16px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center", position: "relative" }}>
          <div style={{ fontSize: 10, color: T.cinza600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Ocupação Agenda
            <span
              style={{ marginLeft: 4, cursor: "pointer", color: T.cinza400, position: "relative", display: "inline-block" }}
              onMouseEnter={(e) => { const el = e.currentTarget.querySelector("div"); if (el) el.style.display = "block"; }}
              onMouseLeave={(e) => { const el = e.currentTarget.querySelector("div"); if (el) el.style.display = "none"; }}
            >
              <Info size={10} />
              <div style={{
                display: "none", position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
                zIndex: 10, background: T.fg, color: "#fff", padding: "8px 12px", borderRadius: 6,
                fontSize: 10, width: 220, lineHeight: 1.5, boxShadow: T.elevSm, whiteSpace: "pre-line", textAlign: "left", textTransform: "none",
              }}>
                {`Atividades de reunião agendadas no Pipedrive (próx. 7 dias)\n\nClosers: ${(ocupacaoAgenda.closers || []).join(", ") || "—"}\nCapacidade: ${ocupacaoAgenda.closers?.length || 0} closer × ${ocupacaoAgenda.meetingsPerDay || 0} reuniões/dia × ${ocupacaoAgenda.workDays || 0} dias = ${ocupacaoAgenda.capacidade} slots`}
              </div>
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#60a5fa" }}>
            {ocupacaoAgenda.percent}<span style={{ fontSize: 14 }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: T.cinza400, marginTop: 4 }}>{ocupacaoAgenda.agendadas}/{ocupacaoAgenda.capacidade} slots (7d)</div>
        </div>
      </div>
    </div>
  );
}

export function ResultadosSZSView({ data, loading, lastUpdated }: Props) {
  if (loading || !data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, color: T.cinza400, fontSize: 14 }}>
        {loading ? "Carregando..." : "Sem dados"}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: T.font, maxWidth: 1100, margin: "0 auto", padding: "20px 0" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: T.cinza600 }}>
          {data.month.replace("-", "/")}
          {lastUpdated && <span style={{ marginLeft: 8, fontSize: 10, color: T.cinza400 }}>Atualizado {lastUpdated.toLocaleTimeString("pt-BR")}</span>}
        </div>
      </div>

      {data.channels.map((ch) => (
        <ChannelCard key={ch.name} channel={ch} historyDays={30} />
      ))}

      <div style={{ textAlign: "center", fontSize: 11, color: T.cinza400, marginTop: 8 }}>
        Barras: <span style={{ color: "#22c55e" }}>■</span> ≥80%
        {" · "}<span style={{ color: "#3b82f6" }}>■</span> 60-79%
        {" · "}<span style={{ color: "#f97316" }}>■</span> 40-59%
        {" · "}<span style={{ color: "#ef4444" }}>■</span> &lt;40%
      </div>
    </div>
  );
}
