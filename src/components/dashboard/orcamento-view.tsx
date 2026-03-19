"use client";

import { useState } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { OrcamentoData } from "@/lib/types";
import { TH, cellStyle, cellRightStyle, DataSourceFooter } from "./ui";

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          right: 0,
          backgroundColor: T.fg,
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "8px",
          fontSize: "11px",
          lineHeight: "1.5",
          whiteSpace: "normal",
          width: "280px",
          zIndex: 50,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          pointerEvents: "none",
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

interface OrcamentoViewProps {
  data: OrcamentoData | null;
  loading: boolean;
  onBudgetSave: (value: number) => void;
  lastUpdated?: Date | null;
  moduleId?: string;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function statusColor(status: "ok" | "alerta" | "critico"): string {
  if (status === "critico") return T.destructive;
  if (status === "alerta") return T.laranja500;
  return T.verde600;
}

function statusBg(status: "ok" | "alerta" | "critico"): string {
  if (status === "critico") return T.vermelho50;
  if (status === "alerta") return "#FFF7ED";
  return T.verde50;
}

const cardStyle = {
  backgroundColor: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: "12px",
  padding: "16px 20px",
  boxShadow: T.elevSm,
  flex: "1 1 220px",
  minWidth: "200px",
};

export function OrcamentoView({ data, loading, onBudgetSave, lastUpdated, moduleId }: OrcamentoViewProps) {
  const isSZS = moduleId === "szs";
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando orçamento...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Sem dados de orçamento</p>
      </div>
    );
  }

  const pctGasto = data.orcamentoTotal > 0 ? (data.gastoAtual / data.orcamentoTotal) * 100 : 0;
  const pctRitmo = data.orcamentoTotal > 0 ? (data.ritmoIdeal / data.orcamentoTotal) * 100 : 0;
  const totalSquadSpend = data.squads.reduce((s, sq) => s + sq.gastoAtual, 0);

  const handleSave = () => {
    const val = parseFloat(inputValue.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(val) && val >= 0) {
      onBudgetSave(val);
    }
    setEditing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {/* Orçamento Mensal */}
        <div style={cardStyle}>
          <div style={{ fontSize: "10px", fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Orçamento Mensal
          </div>
          {editing ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "14px", color: T.mutedFg }}>R$</span>
              <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: T.fg,
                  border: `1px solid ${T.azul600}`,
                  borderRadius: "6px",
                  padding: "4px 8px",
                  width: "140px",
                  outline: "none",
                  fontFamily: T.font,
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: T.azul600,
                  color: "#FFF",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Salvar
              </button>
            </div>
          ) : (
            <div
              onClick={() => { setInputValue(data.orcamentoTotal > 0 ? String(data.orcamentoTotal) : ""); setEditing(true); }}
              style={{ cursor: "pointer" }}
            >
              <span style={{ fontSize: "24px", fontWeight: 700, color: data.orcamentoTotal > 0 ? T.fg : T.mutedFg, fontVariantNumeric: "tabular-nums" }}>
                {data.orcamentoTotal > 0 ? formatBRL(data.orcamentoTotal) : "Clique para definir"}
              </span>
            </div>
          )}
        </div>

        {/* Gasto Atual */}
        <div style={cardStyle}>
          <div style={{ fontSize: "10px", fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Gasto Atual
          </div>
          <span style={{ fontSize: "24px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(data.gastoAtual)}
          </span>
          {data.orcamentoTotal > 0 && (
            <div style={{ fontSize: "12px", color: T.mutedFg, marginTop: "4px" }}>
              {pctGasto.toFixed(1)}% do orçamento
            </div>
          )}
        </div>

        {/* Gasto Diário */}
        <div style={cardStyle}>
          <div style={{ fontSize: "10px", fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Gasto Diário Médio
          </div>
          <span style={{ fontSize: "24px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(data.gastoDiario)}
          </span>
          <div style={{ fontSize: "12px", color: T.mutedFg, marginTop: "4px" }}>
            {data.squads.reduce((s, sq) => s + sq.campaignsActive, 0)} campanhas ativas
          </div>
        </div>

        {/* Projeção Fim do Mês */}
        <div style={{ ...cardStyle, backgroundColor: statusBg(data.status) }}>
          <div style={{ fontSize: "10px", fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Projeção Fim do Mês
          </div>
          <span style={{ fontSize: "24px", fontWeight: 700, color: statusColor(data.status), fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(data.projecaoMes)}
          </span>
          {data.orcamentoTotal > 0 && (
            <div style={{ fontSize: "12px", color: statusColor(data.status), marginTop: "4px", fontWeight: 500 }}>
              {data.status === "ok" ? "Dentro do orçamento" : data.status === "alerta" ? "Atenção: acima do planejado" : "Crítico: muito acima do planejado"}
            </div>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {data.orcamentoTotal > 0 && (() => {
        const totalBudgetRec = data.squads.reduce((s, sq) => s + sq.empreendimentos.reduce((se, e) => se + (e.budgetRecomendado || 0), 0), 0);
        const diasRestantes = data.diasNoMes - data.diasPassados;
        const projecaoRec = totalBudgetRec > 0 ? data.gastoAtual + totalBudgetRec * diasRestantes : 0;
        const pctProjecaoRec = projecaoRec > 0 ? (projecaoRec / data.orcamentoTotal) * 100 : 0;
        return (
          <div style={{ ...cardStyle, flex: "unset", minWidth: "unset" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: T.mutedFg }}>R$ 0</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: T.fg }}>{formatBRL(data.orcamentoTotal)}</span>
            </div>
            <div style={{ position: "relative", height: "28px", backgroundColor: T.cinza100, borderRadius: "8px", overflow: "hidden" }}>
              {/* Projeção com budget recomendado (azul, atrás) */}
              {projecaoRec > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${Math.min(pctProjecaoRec, 100)}%`,
                    backgroundColor: T.azul600,
                    borderRadius: "8px",
                    transition: "width 0.5s ease",
                    opacity: 0.25,
                  }}
                  title={`Projeção recomendada: ${formatBRL(projecaoRec)}`}
                />
              )}
              {/* Gasto atual (cor do status, na frente) */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${Math.min(pctGasto, 100)}%`,
                  backgroundColor: statusColor(data.status),
                  borderRadius: "8px",
                  transition: "width 0.5s ease",
                  opacity: 0.85,
                }}
              />
              {/* Ritmo ideal marker */}
              {pctRitmo > 0 && pctRitmo <= 100 && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${pctRitmo}%`,
                    height: "100%",
                    width: "2px",
                    backgroundColor: T.fg,
                    opacity: 0.5,
                  }}
                  title={`Ritmo ideal: ${formatBRL(data.ritmoIdeal)}`}
                />
              )}
              {/* Label gasto atual */}
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", display: "flex", alignItems: "center", paddingLeft: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: pctGasto > 15 ? "#FFF" : T.fg }}>
                  {formatBRL(data.gastoAtual)} ({pctGasto.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
              <span style={{ fontSize: "11px", color: T.mutedFg }}>
                Dia {data.diasPassados} de {data.diasNoMes}
              </span>
              <div style={{ display: "flex", gap: "12px" }}>
                {projecaoRec > 0 && (
                  <span style={{ fontSize: "11px", color: T.azul600, fontWeight: 500 }}>
                    Projeção recomendada: {formatBRL(projecaoRec)} ({pctProjecaoRec.toFixed(0)}%)
                  </span>
                )}
                <span style={{ fontSize: "11px", color: T.mutedFg }}>
                  Ritmo ideal: {formatBRL(data.ritmoIdeal)}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tabela breakdown por squad com empreendimentos */}
      <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: T.elevSm }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <TH>{isSZS ? "Canal / Cidade" : "Squad / Empreendimento"}</TH>
              <TH right>Gasto Atual</TH>
              <TH right>Gasto Diário</TH>
              <TH right>Budget Recom.</TH>
              <TH right>Campanhas Ativas</TH>
              <TH right>% do Gasto Total</TH>
            </tr>
          </thead>
          <tbody>
            {data.squads.map((sq) => (
              <>
                {/* Squad header row */}
                <tr key={`sq-${sq.id}`} style={{ backgroundColor: T.cinza50 }}>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>
                    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: SQUAD_COLORS[sq.id] || T.azul600, marginRight: "8px" }} />
                    {sq.name}
                  </td>
                  <td style={{ ...cellRightStyle, fontWeight: 700 }}>{formatBRL(sq.gastoAtual)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 700 }}>{formatBRL(sq.gastoDiario)}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 700 }}>
                    {formatBRL(sq.empreendimentos.reduce((s, e) => s + (e.budgetRecomendado || 0), 0))}
                  </td>
                  <td style={{ ...cellRightStyle, fontWeight: 700 }}>{sq.campaignsActive}</td>
                  <td style={{ ...cellRightStyle, fontWeight: 700 }}>
                    {totalSquadSpend > 0 ? ((sq.gastoAtual / totalSquadSpend) * 100).toFixed(1) + "%" : "—"}
                  </td>
                </tr>
                {/* Empreendimento rows */}
                {sq.empreendimentos.map((emp) => {
                  const delta = (emp.budgetRecomendado || 0) - emp.gastoDiario;
                  const deltaColor = delta > 50 ? T.verde600 : delta < -50 ? T.destructive : T.cinza600;
                  return (
                    <tr key={`emp-${sq.id}-${emp.emp}`}>
                      <td style={{ ...cellStyle, paddingLeft: "28px", color: T.cinza700 }}>{emp.emp}</td>
                      <td style={cellRightStyle}>{formatBRL(emp.gastoAtual)}</td>
                      <td style={cellRightStyle}>{formatBRL(emp.gastoDiario)}</td>
                      <td style={{ ...cellRightStyle, color: deltaColor, fontWeight: 600 }}>
                        {emp.budgetExplicacao ? (
                          <Tooltip text={emp.budgetExplicacao}>
                            <span style={{ cursor: "help", borderBottom: `1px dashed ${deltaColor}` }}>
                              {emp.budgetRecomendado ? formatBRL(emp.budgetRecomendado) : "—"}
                              {emp.budgetRecomendado && Math.abs(delta) > 50 ? (
                                <span style={{ fontSize: "10px", marginLeft: "4px" }}>
                                  {delta > 0 ? "↑" : "↓"}
                                </span>
                              ) : null}
                            </span>
                          </Tooltip>
                        ) : (
                          <>
                            {emp.budgetRecomendado ? formatBRL(emp.budgetRecomendado) : "—"}
                          </>
                        )}
                      </td>
                      <td style={cellRightStyle}>{emp.campaignsActive}</td>
                      <td style={cellRightStyle}>
                        {totalSquadSpend > 0 ? ((emp.gastoAtual / totalSquadSpend) * 100).toFixed(1) + "%" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
            {/* Total row */}
            <tr style={{ backgroundColor: T.fg }}>
              <td style={{ ...cellStyle, fontWeight: 700, color: "#FFF", borderBottom: "none" }}>Total</td>
              <td style={{ ...cellRightStyle, fontWeight: 700, color: "#FFF", borderBottom: "none" }}>{formatBRL(data.gastoAtual)}</td>
              <td style={{ ...cellRightStyle, fontWeight: 700, color: "#FFF", borderBottom: "none" }}>{formatBRL(data.gastoDiario)}</td>
              <td style={{ ...cellRightStyle, fontWeight: 700, color: "#FFF", borderBottom: "none" }}>
                {formatBRL(data.squads.reduce((s, sq) => s + sq.empreendimentos.reduce((se, e) => se + (e.budgetRecomendado || 0), 0), 0))}
              </td>
              <td style={{ ...cellRightStyle, fontWeight: 700, color: "#FFF", borderBottom: "none" }}>{data.squads.reduce((s, sq) => s + sq.campaignsActive, 0)}</td>
              <td style={{ ...cellRightStyle, fontWeight: 700, color: "#FFF", borderBottom: "none" }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Log de alterações */}
      {data.log && data.log.length > 0 && (
        <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: T.elevSm }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: T.fg }}>Log de Alterações</span>
            <span style={{ fontSize: "11px", color: T.mutedFg, marginLeft: "8px" }}>
              Registrado quando o gasto diário real confirma o budget recomendado
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH>Data</TH>
                <TH>{isSZS ? "Cidade" : "Empreendimento"}</TH>
                <TH>Tipo</TH>
                <TH right>Budget Recom.</TH>
                <TH right>Gasto Real</TH>
                <TH>Motivo</TH>
              </tr>
            </thead>
            <tbody>
              {data.log.map((entry, i) => {
                const tipoColors: Record<string, { bg: string; fg: string }> = {
                  Escalar: { bg: T.verde50, fg: T.verde600 },
                  Manter: { bg: T.cinza100, fg: T.cinza700 },
                  Otimizar: { bg: "#FFF7ED", fg: T.laranja500 },
                  Reduzir: { bg: T.vermelho50, fg: T.destructive },
                };
                const tc = tipoColors[entry.tipo] || tipoColors.Manter;
                return (
                  <tr key={`log-${i}`} style={i % 2 === 0 ? {} : { backgroundColor: T.cinza50 }}>
                    <td style={{ ...cellStyle, fontSize: "12px", whiteSpace: "nowrap" }}>
                      {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </td>
                    <td style={{ ...cellStyle, fontSize: "12px" }}>{entry.empreendimento}</td>
                    <td style={cellStyle}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: 600,
                        backgroundColor: tc.bg,
                        color: tc.fg,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}>
                        {entry.tipo}
                      </span>
                    </td>
                    <td style={{ ...cellRightStyle, fontSize: "12px" }}>{formatBRL(entry.budgetRecomendado)}</td>
                    <td style={{ ...cellRightStyle, fontSize: "12px" }}>{formatBRL(entry.budgetReal)}</td>
                    <td style={{ ...cellStyle, fontSize: "11px", color: T.cinza600, maxWidth: "400px" }}>{entry.explicacao}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rodapé */}
      <div style={{ fontSize: "11px", color: T.mutedFg, textAlign: "right" }}>
        Meta Ads · Atualizado {data.snapshotDate}
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </div>
  );
}
