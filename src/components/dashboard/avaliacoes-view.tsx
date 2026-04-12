"use client";

import { useState, useMemo } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { AvaliacoesData, AvaliacaoCloserSummary, AvaliacaoReuniao } from "@/lib/types";
import { DataSourceFooter } from "./ui";

interface Props {
  data: AvaliacoesData | null;
  loading: boolean;
  daysBack: number;
  onDaysChange: (d: number) => void;
  lastUpdated?: Date | null;
}

const PILAR_LABELS: Record<string, string> = {
  conhecimento_produto: "Conhecimento",
  tecnicas_venda: "Técnicas de Venda",
  rapport_empatia: "Rapport",
  foco_cta: "Foco no CTA",
  objetividade: "Objetividade",
};

const PILAR_KEYS = Object.keys(PILAR_LABELS) as (keyof typeof PILAR_LABELS)[];

function notaColor(nota: number | null): string {
  if (nota == null) return T.mutedFg;
  if (nota >= 8) return "#15803D";
  if (nota >= 6) return "#92400E";
  return "#E7000B";
}

function notaBg(nota: number | null): string {
  if (nota == null) return T.cinza50;
  if (nota >= 8) return "#F0FDF4";
  if (nota >= 6) return "#FFFBEB";
  return "#FEF2F2";
}

function formatDate(d: string): string {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
}

function formatHora(h: string): string {
  if (!h) return "";
  return h.slice(0, 5);
}

const DAYS_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
];

export function AvaliacoesView({ data, loading, daysBack, onDaysChange, lastUpdated }: Props) {
  const [expandedCloser, setExpandedCloser] = useState<string | null>(null);
  const [expandedInvalid, setExpandedInvalid] = useState<string | null>(null);
  const [expandedReuniao, setExpandedReuniao] = useState<string | null>(null);

  if (loading && !data) {
    return <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>Carregando avaliações...</div>;
  }
  if (!data) {
    return <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>Sem dados de avaliação</div>;
  }

  const { closers, totals } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: 0 }}>Avaliação de Reuniões</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: T.mutedFg }}>Período:</span>
          <select
            value={daysBack}
            onChange={(e) => onDaysChange(Number(e.target.value))}
            style={{
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "6px",
              border: `1px solid ${T.border}`,
              backgroundColor: "#fff",
              color: T.fg,
            }}
          >
            {DAYS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        <SummaryCard label="Reuniões" value={totals.totalReunioes} />
        <SummaryCard label="Transcrições Válidas" value={totals.transcricoesValidas} color="#15803D" />
        <SummaryCard label="Transcrições Inválidas" value={totals.transcricoesInvalidas} color={totals.transcricoesInvalidas > 0 ? "#E7000B" : T.mutedFg} />
        <SummaryCard label="Avaliadas" value={totals.reunioesAvaliadas} />
        <SummaryCard label="Nota Média" value={totals.notaMedia != null ? `${totals.notaMedia}/10` : "–"} color={notaColor(totals.notaMedia)} />
      </div>

      {/* Section 1: Notas por Closer (main) */}
      <Section title="Nota Média por Closer">
        {closers.map((c) => {
          const isExpanded = expandedCloser === c.name;
          const avaliadas = c.reunioes.filter((r) => r.avaliacao);
          return (
            <div key={c.name} style={{ marginBottom: "8px" }}>
              {/* Closer header row */}
              <div
                onClick={() => setExpandedCloser(isExpanded ? null : c.name)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 60px repeat(5, 1fr) 80px 80px",
                  alignItems: "center",
                  padding: "10px 12px",
                  backgroundColor: isExpanded ? T.azul50 : T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: isExpanded ? "8px 8px 0 0" : "8px",
                  cursor: "pointer",
                  gap: "8px",
                  fontSize: "13px",
                  transition: "background-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px" }}>{isExpanded ? "▼" : "▶"}</span>
                  <span style={{ fontWeight: 600, color: T.fg }}>{c.name}</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", backgroundColor: SQUAD_COLORS[c.squadId] ? `${SQUAD_COLORS[c.squadId]}15` : T.cinza50, color: SQUAD_COLORS[c.squadId] || T.mutedFg }}>
                    S{c.squadId}
                  </span>
                </div>
                {PILAR_KEYS.map((k) => (
                  <div key={k} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: T.mutedFg, marginBottom: "2px" }}>{PILAR_LABELS[k]}</div>
                    <span style={{ fontWeight: 600, color: notaColor(c.pilares[k as keyof typeof c.pilares]) }}>
                      {c.pilares[k as keyof typeof c.pilares] != null ? c.pilares[k as keyof typeof c.pilares] : "–"}
                    </span>
                  </div>
                ))}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: T.mutedFg, marginBottom: "2px" }}>Avaliadas</div>
                  <span style={{ fontWeight: 500 }}>{c.reunioesAvaliadas}</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: notaColor(c.notaMedia),
                    padding: "2px 8px",
                    borderRadius: "6px",
                    backgroundColor: notaBg(c.notaMedia),
                  }}>
                    {c.notaMedia != null ? c.notaMedia : "–"}
                  </span>
                </div>
              </div>

              {/* Expanded: list of evaluated reunioes */}
              {isExpanded && (
                <div style={{
                  border: `1px solid ${T.border}`,
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  backgroundColor: "#FAFBFC",
                  overflow: "hidden",
                }}>
                  {avaliadas.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: T.mutedFg, fontSize: "13px" }}>
                      Nenhuma reunião avaliada
                    </div>
                  ) : (
                    avaliadas.map((r) => (
                      <ReuniaoCard
                        key={r.eventId}
                        reuniao={r}
                        isExpanded={expandedReuniao === r.eventId}
                        onToggle={() => setExpandedReuniao(expandedReuniao === r.eventId ? null : r.eventId)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* Section 2: Reuniões × Transcrições */}
      <Section title="Reuniões × Transcrições">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                <TH align="left">Closer</TH>
                <TH>Squad</TH>
                <TH>Reuniões</TH>
                <TH>Válidas</TH>
                <TH>Inválidas</TH>
                <TH>Taxa</TH>
              </tr>
            </thead>
            <tbody>
              {closers.map((c) => {
                const isExpanded = expandedInvalid === c.name;
                const invalidas = c.reunioes.filter((r) => !!r.invalidReason);
                const taxa = c.totalReunioes > 0 ? Math.round((c.transcricoesValidas / c.totalReunioes) * 100) : 0;
                return (
                  <CloserTranscricaoRow
                    key={c.name}
                    closer={c}
                    invalidas={invalidas}
                    taxa={taxa}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedInvalid(isExpanded ? null : c.name)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}

// --- Sub-components ---

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      backgroundColor: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: "8px",
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: "11px", color: T.mutedFg, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: color || T.fg }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>{title}</h3>
      {children}
    </div>
  );
}

function TH({ children, align = "center" }: { children: React.ReactNode; align?: "left" | "center" | "right" }) {
  return (
    <th style={{ padding: "8px 10px", fontSize: "11px", fontWeight: 600, color: T.mutedFg, textAlign: align, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {children}
    </th>
  );
}

function CloserTranscricaoRow({ closer, invalidas, taxa, isExpanded, onToggle }: {
  closer: AvaliacaoCloserSummary;
  invalidas: AvaliacaoReuniao[];
  taxa: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={invalidas.length > 0 ? onToggle : undefined}
        style={{
          borderBottom: `1px solid ${T.border}`,
          cursor: invalidas.length > 0 ? "pointer" : "default",
          backgroundColor: isExpanded ? T.azul50 : "transparent",
        }}
      >
        <td style={{ padding: "10px 10px", fontWeight: 500 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {invalidas.length > 0 && <span style={{ fontSize: "10px", color: T.mutedFg }}>{isExpanded ? "▼" : "▶"}</span>}
            <span style={{ color: SQUAD_COLORS[closer.squadId] || T.fg }}>{closer.name}</span>
          </div>
        </td>
        <td style={{ padding: "10px", textAlign: "center" }}>
          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", backgroundColor: `${SQUAD_COLORS[closer.squadId] || T.mutedFg}15`, color: SQUAD_COLORS[closer.squadId] || T.mutedFg }}>
            S{closer.squadId}
          </span>
        </td>
        <td style={{ padding: "10px", textAlign: "center", fontWeight: 600 }}>{closer.totalReunioes}</td>
        <td style={{ padding: "10px", textAlign: "center", color: "#15803D", fontWeight: 600 }}>{closer.transcricoesValidas}</td>
        <td style={{ padding: "10px", textAlign: "center", color: closer.transcricoesInvalidas > 0 ? "#E7000B" : T.mutedFg, fontWeight: 600 }}>
          {closer.transcricoesInvalidas}
        </td>
        <td style={{ padding: "10px", textAlign: "center" }}>
          <span style={{
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: taxa >= 80 ? "#F0FDF4" : taxa >= 50 ? "#FFFBEB" : "#FEF2F2",
            color: taxa >= 80 ? "#15803D" : taxa >= 50 ? "#92400E" : "#E7000B",
          }}>
            {taxa}%
          </span>
        </td>
      </tr>
      {isExpanded && invalidas.map((r) => (
        <tr key={r.eventId} style={{ backgroundColor: "#FEF2F2", borderBottom: `1px solid ${T.border}` }}>
          <td colSpan={6} style={{ padding: "8px 10px 8px 36px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
              <span style={{ color: T.mutedFg, minWidth: "50px" }}>{formatDate(r.dia)} {formatHora(r.hora)}</span>
              <span style={{ fontWeight: 500, color: T.fg, flex: 1 }}>{r.titulo || "Sem título"}</span>
              <span style={{ color: "#E7000B", fontSize: "11px", fontStyle: "italic" }}>{r.invalidReason}</span>
              {r.empreendimento && (
                <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", backgroundColor: T.cinza50, color: T.mutedFg }}>{r.empreendimento}</span>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function ReuniaoCard({ reuniao, isExpanded, onToggle }: {
  reuniao: AvaliacaoReuniao;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const a = reuniao.avaliacao;
  if (!a) return null;

  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      {/* Reuniao summary row */}
      <div
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr repeat(5, 60px) 60px",
          alignItems: "center",
          padding: "10px 16px",
          cursor: "pointer",
          gap: "8px",
          fontSize: "12px",
          backgroundColor: isExpanded ? "#F0F4FF" : "transparent",
          transition: "background-color 0.15s",
        }}
      >
        <div style={{ color: T.mutedFg }}>
          {formatDate(reuniao.dia)} {formatHora(reuniao.hora)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: T.mutedFg }}>{isExpanded ? "▼" : "▶"}</span>
          <span style={{ fontWeight: 500, color: T.fg }}>{reuniao.titulo || "Sem título"}</span>
          {reuniao.empreendimento && (
            <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", backgroundColor: T.cinza50, color: T.mutedFg }}>
              {reuniao.empreendimento}
            </span>
          )}
        </div>
        {PILAR_KEYS.map((k) => (
          <div key={k} style={{ textAlign: "center", fontWeight: 600, color: notaColor(a.pilares[k as keyof typeof a.pilares]?.nota ?? null) }}>
            {a.pilares[k as keyof typeof a.pilares]?.nota ?? "–"}
          </div>
        ))}
        <div style={{ textAlign: "center" }}>
          <span style={{
            fontWeight: 700,
            fontSize: "14px",
            color: notaColor(a.nota_final),
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: notaBg(a.nota_final),
          }}>
            {a.nota_final}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ padding: "12px 16px 16px 116px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Pilar details */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" }}>
            {PILAR_KEYS.map((k) => {
              const p = a.pilares[k as keyof typeof a.pilares];
              if (!p) return null;
              return (
                <div key={k} style={{
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${T.border}`,
                  backgroundColor: "#fff",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: T.fg }}>{PILAR_LABELS[k]}</span>
                    <span style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: notaColor(p.nota),
                      padding: "0 6px",
                      borderRadius: "4px",
                      backgroundColor: notaBg(p.nota),
                    }}>
                      {p.nota}/10
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: T.mutedFg, margin: 0, lineHeight: "1.5" }}>{p.justificativa}</p>
                </div>
              );
            })}
          </div>

          {/* Destaques & Melhorias */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {a.destaques_positivos?.length > 0 && (
              <div style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#15803D", marginBottom: "6px" }}>Destaques Positivos</div>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", color: "#166534", lineHeight: "1.6" }}>
                  {a.destaques_positivos.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {a.pontos_melhoria?.length > 0 && (
              <div style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#92400E", marginBottom: "6px" }}>Pontos de Melhoria</div>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", color: "#78350F", lineHeight: "1.6" }}>
                  {a.pontos_melhoria.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
          </div>

          {a.dados_incorretos?.length > 0 && a.dados_incorretos[0] && (
            <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#E7000B", marginBottom: "4px" }}>Dados Incorretos</div>
              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", color: "#991B1B", lineHeight: "1.6" }}>
                {a.dados_incorretos.filter(Boolean).map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
