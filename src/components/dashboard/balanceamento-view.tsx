"use client";

import { useState } from "react";
import { T, SQUAD_COLORS, MQL_INTENCOES, MQL_FAIXAS, MQL_PAGAMENTOS } from "@/lib/constants";
import type { RegrasMqlData, RegrasMqlEmp, RegrasMqlFonte, OciosidadeData } from "@/lib/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataSourceFooter } from "./ui";

interface Props {
  data: RegrasMqlData | null;
  ocioData: OciosidadeData | null;
  loading: boolean;
  lastUpdated?: Date | null;
}

interface SquadOcupacao {
  squadId: number;
  squadName: string;
  closers: string[];
  avgPast7: number;
  avgNext3: number;
}

function calcSquadOcupacao(ocioData: OciosidadeData): SquadOcupacao[] {
  const SQUAD_NAMES: Record<number, string> = { 1: "Squad 1", 2: "Squad 2", 3: "Squad 3" };
  const squads = new Map<number, { names: string[]; past7: number[]; next3: number[] }>();

  for (const closer of ocioData.closers) {
    const sq = closer.squadId;
    if (!squads.has(sq)) squads.set(sq, { names: [], past7: [], next3: [] });
    const entry = squads.get(sq)!;
    entry.names.push(closer.name);
    entry.past7.push(closer.avgPast7);

    // Próximos 3 dias: filtrar dias futuros (não past, não today)
    const futureDays: number[] = [];
    for (let i = 0; i < closer.days.length && futureDays.length < 3; i++) {
      const dateInfo = ocioData.dates[i];
      if (dateInfo && !dateInfo.isPast && !dateInfo.isToday) {
        futureDays.push(closer.days[i].occupancyPct);
      }
    }
    const avg3 = futureDays.length > 0
      ? futureDays.reduce((a, b) => a + b, 0) / futureDays.length
      : 0;
    entry.next3.push(avg3);
  }

  return Array.from(squads.entries())
    .sort(([a], [b]) => a - b)
    .map(([sqId, data]) => ({
      squadId: sqId,
      squadName: SQUAD_NAMES[sqId] || `Squad ${sqId}`,
      closers: data.names,
      avgPast7: Math.round(data.past7.reduce((a, b) => a + b, 0) / data.past7.length),
      avgNext3: Math.round(data.next3.reduce((a, b) => a + b, 0) / data.next3.length),
    }));
}

function ocupacaoColor(pct: number): string {
  if (pct > 60) return T.verde600;
  if (pct >= 30) return T.laranja500;
  return T.destructive;
}

function ocupacaoColorBg(pct: number): string {
  if (pct > 60) return T.verde50;
  if (pct >= 30) return "#FFF7ED";
  return T.vermelho50;
}

function OcupacaoBar({ pct, label }: { pct: number; label: string }) {
  const color = ocupacaoColor(pct);
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <span style={{ fontSize: "11px", color: T.cinza600 }}>{label}</span>
        <span style={{ fontSize: "13px", fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div
        style={{
          width: "100%",
          height: "6px",
          borderRadius: "3px",
          backgroundColor: `${color}20`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "3px",
            backgroundColor: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function aberturaColor(pct: number): string {
  if (pct > 70) return T.verde600;
  if (pct >= 40) return T.laranja500;
  return T.destructive;
}

function aberturaColorBg(pct: number): string {
  if (pct > 70) return T.verde50;
  if (pct >= 40) return "#FFF7ED";
  return T.vermelho50;
}

function MiniBar({ filled, total, pct }: { filled: number; total: number; pct: number }) {
  const color = aberturaColor(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <div
        style={{
          width: "36px",
          height: "6px",
          borderRadius: "3px",
          backgroundColor: `${color}20`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "3px",
            backgroundColor: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, fontVariantNumeric: "tabular-nums" }}>
        {filled}/{total}
      </span>
    </div>
  );
}

function AberturaBar({ pct }: { pct: number }) {
  const color = aberturaColor(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div
        style={{
          width: "60px",
          height: "8px",
          borderRadius: "4px",
          backgroundColor: `${color}20`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "4px",
            backgroundColor: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "12px", fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
    </div>
  );
}

function OptionDots({
  selected,
  allOptions,
}: {
  selected: string[];
  allOptions: ReadonlyArray<{ value: string; label: string }>;
}) {
  const selectedSet = new Set(selected);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
      {allOptions.map((opt) => {
        const active = selectedSet.has(opt.value);
        return (
          <div key={opt.value} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: active ? T.verde600 : T.cinza200,
                border: active ? "none" : `1px solid ${T.cinza300}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "11px",
                color: active ? T.fg : T.cinza400,
                fontWeight: active ? 500 : 400,
              }}
            >
              {opt.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FonteTag({ fonte }: { fonte: RegrasMqlFonte }) {
  if (fonte.tipo === "campanha") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "11px",
          fontWeight: 500,
          color: T.verde700,
          backgroundColor: T.verde50,
          padding: "2px 8px",
          borderRadius: "4px",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.verde600 }} />
        {fonte.labelCurto}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        fontWeight: 500,
        color: T.cinza700,
        backgroundColor: T.cinza50,
        padding: "2px 8px",
        borderRadius: "4px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: "10px" }}>&#128196;</span>
      {fonte.labelCurto}
    </span>
  );
}

function FonteDetailRow({ fonte }: { fonte: RegrasMqlFonte }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <td
          style={{
            padding: "6px 10px 6px 34px",
            borderBottom: `1px solid ${T.border}`,
            fontSize: "12px",
            color: T.cinza700,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {expanded ? <ChevronDown size={10} color={T.cinza400} /> : <ChevronRight size={10} color={T.cinza400} />}
            <FonteTag fonte={fonte} />
          </div>
        </td>
        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
          <MiniBar filled={fonte.intencoes.length} total={MQL_INTENCOES.length} pct={fonte.aberturaIntencoes} />
        </td>
        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
          <MiniBar filled={fonte.faixas.length} total={MQL_FAIXAS.length} pct={fonte.aberturaFaixas} />
        </td>
        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
          <MiniBar filled={fonte.pagamentos.length} total={MQL_PAGAMENTOS.length} pct={fonte.aberturaPagamentos} />
        </td>
        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}` }}>
          <AberturaBar pct={fonte.aberturaGeral} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td
            colSpan={5}
            style={{
              padding: "10px 16px 14px 50px",
              borderBottom: `1px solid ${T.border}`,
              backgroundColor: T.cinza50,
            }}
          >
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "6px" }}>
                  Intenções
                </div>
                <OptionDots selected={fonte.intencoes} allOptions={MQL_INTENCOES} />
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "6px" }}>
                  Faixas de Investimento
                </div>
                <OptionDots selected={fonte.faixas} allOptions={MQL_FAIXAS} />
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "6px" }}>
                  Pagamentos
                </div>
                <OptionDots selected={fonte.pagamentos} allOptions={MQL_PAGAMENTOS} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EmpRow({ emp }: { emp: RegrasMqlEmp }) {
  const hasSingleFonte = emp.fontes.length === 1;
  const [expanded, setExpanded] = useState(!hasSingleFonte);

  return (
    <>
      {/* Row agrupadora do empreendimento */}
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer", transition: "background 0.1s" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <td
          style={{
            padding: "8px 10px",
            borderBottom: `1px solid ${T.border}`,
            fontSize: "13px",
            fontWeight: 500,
            color: T.fg,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {expanded ? <ChevronDown size={12} color={T.cinza600} /> : <ChevronRight size={12} color={T.cinza600} />}
            {emp.nome}
            <span style={{ fontSize: "10px", color: T.cinza400, marginLeft: "4px" }}>
              {emp.fontes.length} fonte{emp.fontes.length !== 1 ? "s" : ""}
            </span>
          </div>
        </td>
        {/* Se só tem 1 fonte, mostra mini-bars direto na row do empreendimento */}
        {hasSingleFonte ? (
          <>
            <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
              <MiniBar filled={emp.fontes[0].intencoes.length} total={MQL_INTENCOES.length} pct={emp.fontes[0].aberturaIntencoes} />
            </td>
            <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
              <MiniBar filled={emp.fontes[0].faixas.length} total={MQL_FAIXAS.length} pct={emp.fontes[0].aberturaFaixas} />
            </td>
            <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
              <MiniBar filled={emp.fontes[0].pagamentos.length} total={MQL_PAGAMENTOS.length} pct={emp.fontes[0].aberturaPagamentos} />
            </td>
          </>
        ) : (
          <>
            <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}` }} />
            <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}` }} />
            <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}` }} />
          </>
        )}
        <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}` }}>
          <AberturaBar pct={emp.aberturaGeral} />
        </td>
      </tr>
      {/* Sub-rows de fontes (quando expandido) */}
      {expanded && hasSingleFonte && (
        <tr>
          <td
            colSpan={5}
            style={{
              padding: "10px 16px 14px 34px",
              borderBottom: `1px solid ${T.border}`,
              backgroundColor: T.cinza50,
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <FonteTag fonte={emp.fontes[0]} />
            </div>
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "6px" }}>
                  Intenções
                </div>
                <OptionDots selected={emp.fontes[0].intencoes} allOptions={MQL_INTENCOES} />
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "6px" }}>
                  Faixas de Investimento
                </div>
                <OptionDots selected={emp.fontes[0].faixas} allOptions={MQL_FAIXAS} />
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", marginBottom: "6px" }}>
                  Pagamentos
                </div>
                <OptionDots selected={emp.fontes[0].pagamentos} allOptions={MQL_PAGAMENTOS} />
              </div>
            </div>
          </td>
        </tr>
      )}
      {expanded && !hasSingleFonte && emp.fontes.map((fonte, i) => (
        <FonteDetailRow key={`${fonte.campaignName}-${i}`} fonte={fonte} />
      ))}
    </>
  );
}

export function BalanceamentoView({ data, ocioData, loading, lastUpdated }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.cinza600 }}>
        <p style={{ fontSize: "14px" }}>Carregando regras MQL...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Coluna principal — Regras MQL */}
      <div style={{ flex: 3 }}>
        {data.squads.map((sq) => (
          <div
            key={sq.id}
            style={{
              backgroundColor: T.card,
              borderRadius: "12px",
              border: `1px solid ${T.border}`,
              marginBottom: "16px",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header do squad */}
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `1px solid ${T.border}`,
                backgroundColor: T.cinza50,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: SQUAD_COLORS[sq.id] || T.cinza400,
                  }}
                />
                <span style={{ fontSize: "14px", fontWeight: 600, color: T.fg }}>{sq.name}</span>
                <span style={{ fontSize: "11px", color: T.cinza600 }}>
                  {sq.empreendimentos.length} empreendimento{sq.empreendimentos.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase" }}>
                  Abertura média
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: aberturaColor(sq.aberturaMedia),
                    backgroundColor: aberturaColorBg(sq.aberturaMedia),
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {sq.aberturaMedia}%
                </span>
              </div>
            </div>

            {/* Tabela */}
            {sq.empreendimentos.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 10px",
                        fontSize: "9px",
                        fontWeight: 500,
                        color: T.cinza600,
                        borderBottom: `1px solid ${T.border}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Empreendimento / Fonte
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "6px 10px",
                        fontSize: "9px",
                        fontWeight: 500,
                        color: T.cinza600,
                        borderBottom: `1px solid ${T.border}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Intenções
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "6px 10px",
                        fontSize: "9px",
                        fontWeight: 500,
                        color: T.cinza600,
                        borderBottom: `1px solid ${T.border}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Faixas
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "6px 10px",
                        fontSize: "9px",
                        fontWeight: 500,
                        color: T.cinza600,
                        borderBottom: `1px solid ${T.border}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Pagamentos
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 10px",
                        fontSize: "9px",
                        fontWeight: 500,
                        color: T.cinza600,
                        borderBottom: `1px solid ${T.border}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Abertura
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sq.empreendimentos.map((emp) => (
                    <EmpRow key={emp.nome} emp={emp} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: T.cinza600, fontSize: "13px" }}>
                Nenhum empreendimento ativo
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Coluna direita — Ocupação por Squad */}
      <div style={{ flex: 1, minWidth: "220px" }}>
        <div style={{ position: "sticky", top: "80px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h4 style={{ fontSize: "13px", fontWeight: 600, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
            Ocupação dos Squads
          </h4>
          {!ocioData ? (
            <div
              style={{
                backgroundColor: T.card,
                borderRadius: "12px",
                border: `1px solid ${T.border}`,
                padding: "32px 20px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "12px", color: T.cinza400, margin: 0 }}>Carregando ocupação...</p>
            </div>
          ) : (
            calcSquadOcupacao(ocioData).map((sq) => (
              <div
                key={sq.squadId}
                style={{
                  backgroundColor: T.card,
                  borderRadius: "12px",
                  border: `1px solid ${T.border}`,
                  padding: "14px 16px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: SQUAD_COLORS[sq.squadId] || T.cinza400,
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>{sq.squadName}</span>
                  </div>
                  <span style={{ fontSize: "10px", color: T.cinza400 }}>
                    {sq.closers.join(", ")}
                  </span>
                </div>
                <OcupacaoBar pct={sq.avgPast7} label="Últimos 7d" />
                <OcupacaoBar pct={sq.avgNext3} label="Próximos 3d" />
              </div>
            ))
          )}
        </div>
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
