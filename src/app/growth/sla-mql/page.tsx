"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { T } from "@/lib/constants"
import type { SlaRow } from "@/app/api/sla-mql/route"

// ─── Config por vertical ──────────────────────────────────────────────────────

type ColDef = {
  label: string
  field: "mql_intencoes" | "mql_faixas" | "mql_pagamentos"
  options: string[]
}

const CONFIG: Record<string, ColDef[]> = {
  SZI: [
    {
      label: "Intenção",
      field: "mql_intencoes",
      options: [
        "Investimento - renda com aluguel",
        "Investimento - valorização do imóvel",
        "Uso próprio - uso esporádico",
        "Uso próprio - moradia",
      ],
    },
    {
      label: "Faixa de Investimento",
      field: "mql_faixas",
      options: [
        "R$ 50.000 a R$ 100.000 em até 54 meses",
        "R$ 100.001 a R$ 200.000 em até 54 meses",
        "R$ 200.001 a R$ 300.000 em até 54 meses",
        "R$ 300.001 a R$ 400.000 em até 54 meses",
        "Acima de R$ 400.000 em até 54 meses",
        "À vista via PIX ou boleto",
      ],
    },
    {
      label: "Forma de Pagamento",
      field: "mql_pagamentos",
      options: [
        "À vista via PIX ou boleto",
        "Parcelado via PIX ou boleto",
        "Não tenho condição nessas opções",
      ],
    },
  ],
  Marketplace: [
    {
      label: "Intenção",
      field: "mql_intencoes",
      options: [
        "Investimento - renda com aluguel",
        "Investimento - valorização do imóvel",
        "Uso próprio - uso esporádico",
        "Uso próprio - moradia",
      ],
    },
    {
      label: "Faixa de entrada",
      field: "mql_faixas",
      options: [
        "Até R$ 30.000",
        "R$ 30.001 a R$ 50.000",
        "R$ 50.001 a R$ 80.000",
        "R$ 80.001 a R$ 150.000",
        "Acima de R$ 150.000",
      ],
    },
  ],
  Serviços: [
    {
      label: "Mobiliado?",
      field: "mql_intencoes",
      options: ["Sim", "Não", "Parcialmente mobiliado", "Não tenho imóvel"],
    },
    {
      label: "Disponibilidade",
      field: "mql_faixas",
      options: [
        "Disponível imediatamente",
        "Alugado com contrato anual",
        "Em reforma / preparação",
        "Não está disponível",
        "Já opera por temporada",
      ],
    },
    {
      label: "Ar condicionado?",
      field: "mql_pagamentos",
      options: [
        "Sim",
        "Não",
        "Não, mas estou disposto a instalar caso seja necessário",
      ],
    },
  ],
}

const SHORT: Record<string, string> = {
  "R$ 50.000 a R$ 100.000 em até 54 meses":                 "50k – 100k",
  "R$ 100.001 a R$ 200.000 em até 54 meses":                "100k – 200k",
  "R$ 200.001 a R$ 300.000 em até 54 meses":                "200k – 300k",
  "R$ 300.001 a R$ 400.000 em até 54 meses":                "300k – 400k",
  "Acima de R$ 400.000 em até 54 meses":                    "Acima 400k",
  "Até R$ 30.000":                                          "Até 30k",
  "R$ 30.001 a R$ 50.000":                                  "30k – 50k",
  "R$ 50.001 a R$ 80.000":                                  "50k – 80k",
  "R$ 80.001 a R$ 150.000":                                 "80k – 150k",
  "Acima de R$ 150.000":                                    "Acima 150k",
  "Investimento - renda com aluguel":                       "Renda aluguel",
  "Investimento - valorização do imóvel":                   "Valorização",
  "Uso próprio - moradia":                                  "Moradia",
  "Uso próprio - uso esporádico":                           "Esporádico",
  "À vista via PIX ou boleto":                              "À vista",
  "Parcelado via PIX ou boleto":                            "Parcelado",
  "Não tenho condição nessas opções":                       "Sem condição",
  "Parcialmente mobiliado":                                 "Parcialmente",
  "Não tenho imóvel":                                       "Sem imóvel",
  "Disponível imediatamente":                               "Disponível",
  "Alugado com contrato anual":                             "Alugado/anual",
  "Em reforma / preparação":                                "Em reforma",
  "Não está disponível":                                    "Não disponível",
  "Já opera por temporada":                                 "Já opera",
  "Não, mas estou disposto a instalar caso seja necessário": "Disposto instalar",
}

const VERTICAL_COLOR: Record<string, string> = {
  SZI:        T.azul600,
  Marketplace: T.roxo600,
  Serviços:   T.teal600,
}

type VerticalTab = "SZI" | "Marketplace" | "Serviços"

// ─── Draft state por linha em edição ─────────────────────────────────────────

type Draft = {
  mql_intencoes: Set<string>
  mql_faixas: Set<string>
  mql_pagamentos: Set<string>
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({
  label,
  accepted,
  editing,
  onToggle,
}: {
  label: string
  accepted: boolean
  editing: boolean
  onToggle?: () => void
}) {
  const short = SHORT[label] || label
  return (
    <span
      onClick={editing ? onToggle : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px 3px 7px",
        borderRadius: 20,
        fontSize: 11.5,
        fontWeight: accepted ? 600 : 400,
        letterSpacing: "-0.01em",
        fontFamily: T.font,
        background:  accepted ? "#DCFCE7" : "#F1F5F9",
        color:       accepted ? "#15803D" : "#CBD5E1",
        border:      `1px solid ${accepted ? "#BBF7D0" : "#E2E8F0"}`,
        cursor:      editing ? "pointer" : "default",
        transition:  "background 0.12s, color 0.12s, border-color 0.12s",
        userSelect:  "none",
        outline:     editing ? `2px solid ${accepted ? "#BBF7D0" : "#E2E8F0"}` : "none",
        outlineOffset: editing ? 1 : 0,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        {accepted
          ? <path d="M2 5.5L4.2 7.5L8 3" stroke="#15803D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          : <path d="M3 3L7 7M7 3L3 7" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round"/>
        }
      </svg>
      {short}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SlaPage() {
  const router = useRouter()
  const [rows, setRows]         = useState<SlaRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [vertical, setVertical] = useState<VerticalTab>("SZI")

  // Edição
  const [editingKey, setEditingKey]   = useState<string | null>(null) // "table:id"
  const [draft, setDraft]             = useState<Draft | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/login")
    })
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/sla-mql")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { rows: data } = await res.json() as { rows: SlaRow[] }
      setRows(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visibleRows = rows.filter(r => r.vertical === vertical)
  const accentColor = VERTICAL_COLOR[vertical]
  const cols        = CONFIG[vertical]

  // ── Edição ──────────────────────────────────────────────────────────────────

  function startEdit(row: SlaRow) {
    setEditingKey(`${row.table}:${row.id}`)
    setDraft({
      mql_intencoes:  new Set(row.mql_intencoes),
      mql_faixas:     new Set(row.mql_faixas),
      mql_pagamentos: new Set(row.mql_pagamentos),
    })
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingKey(null)
    setDraft(null)
    setSaveError(null)
  }

  function toggleOption(field: keyof Draft, value: string) {
    if (!draft) return
    const next = new Set(draft[field])
    next.has(value) ? next.delete(value) : next.add(value)
    setDraft({ ...draft, [field]: next })
  }

  async function saveEdit(row: SlaRow) {
    if (!draft) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/sla-mql/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table:          row.table,
          mql_intencoes:  Array.from(draft.mql_intencoes),
          mql_faixas:     Array.from(draft.mql_faixas),
          mql_pagamentos: Array.from(draft.mql_pagamentos),
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      // Atualiza local sem re-fetch
      setRows(prev => prev.map(r =>
        r.id === row.id && r.table === row.table
          ? {
              ...r,
              mql_intencoes:  Array.from(draft.mql_intencoes),
              mql_faixas:     Array.from(draft.mql_faixas),
              mql_pagamentos: Array.from(draft.mql_pagamentos),
            }
          : r
      ))
      cancelEdit()
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Estilos de tabela ────────────────────────────────────────────────────────

  const thStyle = (first?: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: T.mutedFg,
    background: T.cinza50,
    borderBottom: `1px solid ${T.border}`,
    borderRight: `1px solid ${T.border}`,
    whiteSpace: "nowrap",
    fontFamily: T.font,
    ...(first ? {
      position: "sticky",
      left: 0,
      zIndex: 2,
      minWidth: 200,
      borderRight: `2px solid ${T.border}`,
    } : {}),
  })

  const tdBase = (first?: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    verticalAlign: "top",
    borderBottom: `1px solid ${T.border}`,
    borderRight: `1px solid ${T.border}`,
    ...(first ? {
      position: "sticky",
      left: 0,
      zIndex: 1,
      borderRight: `2px solid ${T.border}`,
    } : {}),
  })

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font }}>

      {/* Topbar */}
      <header style={{
        background: "#0F172A",
        padding: "0 20px",
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 10,
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
            padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)" }} />
        <span style={{
          fontSize: 13.5, fontWeight: 700, color: "#FFFFFF",
          letterSpacing: "-0.01em", fontFamily: T.font,
        }}>
          SLA de MQL
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
          critérios por empreendimento
        </span>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* Vertical tabs */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 24,
          background: T.cinza50, borderRadius: 10, padding: 5,
          border: `1px solid ${T.border}`, width: "fit-content",
          boxShadow: T.elevSm,
        }}>
          {(["SZI", "Marketplace", "Serviços"] as VerticalTab[]).map(v => {
            const color  = VERTICAL_COLOR[v]
            const active = vertical === v
            const count  = rows.filter(r => r.vertical === v).length
            return (
              <button
                key={v}
                onClick={() => { setVertical(v); cancelEdit() }}
                style={{
                  padding: "7px 16px", borderRadius: 7, border: "none",
                  cursor: "pointer", fontFamily: T.font,
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  background: active ? color : "transparent",
                  color: active ? "#fff" : T.mutedFg,
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                {v}
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: active ? "rgba(255,255,255,0.25)" : T.cinza100,
                    color: active ? "#fff" : T.mutedFg,
                    borderRadius: 20, padding: "0 6px", lineHeight: "18px",
                    fontFamily: T.font,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Legenda */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          marginBottom: 16, fontSize: 11.5, color: T.mutedFg, fontFamily: T.font,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E" }} />
            Ativo
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.cinza300 }} />
            Inativo
          </div>
          <span style={{ width: 1, height: 14, background: T.border }} />
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "1px 7px", borderRadius: 20, background: "#DCFCE7",
            color: "#15803D", border: "1px solid #BBF7D0", fontSize: 10.5, fontWeight: 600,
          }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4.2 7.5L8 3" stroke="#15803D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Passa
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "1px 7px", borderRadius: 20, background: "#F1F5F9",
            color: "#CBD5E1", border: "1px solid #E2E8F0", fontSize: 10.5,
          }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M3 3L7 7M7 3L3 7" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Não passa
          </span>
          <span style={{ fontSize: 11.5, color: T.cinza300 }}>
            · Clique nos pills para editar quando no modo edição
          </span>
        </div>

        {/* Content */}
        {loading && (
          <div style={{ padding: 60, textAlign: "center", color: T.mutedFg, fontSize: 13 }}>
            Carregando…
          </div>
        )}

        {error && (
          <div style={{
            padding: "12px 16px", borderRadius: 8, background: "#FEE2E2",
            border: "1px solid #FECACA", color: "#991B1B", fontSize: 13, marginBottom: 16,
          }}>
            Erro ao carregar: {error}{" "}
            <button onClick={load} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#991B1B", textDecoration: "underline", fontSize: 13,
            }}>
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && visibleRows.length === 0 && (
          <div style={{
            padding: 60, textAlign: "center", color: T.mutedFg,
            background: T.cinza50, borderRadius: 14, border: `1px solid ${T.border}`,
          }}>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: T.fg }}>
              Nenhum empreendimento em {vertical}
            </p>
          </div>
        )}

        {!loading && !error && visibleRows.length > 0 && (
          <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${T.border}`, boxShadow: T.elevSm }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: T.card, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle(true)}>Empreendimento</th>
                  {cols.map(c => (
                    <th key={c.field} style={thStyle()}>
                      <span style={{ color: accentColor }}>{c.label}</span>
                    </th>
                  ))}
                  <th style={{ ...thStyle(), minWidth: 100 }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => {
                  const key     = `${row.table}:${row.id}`
                  const isEditing = editingKey === key
                  const rowBg  = i % 2 === 0 ? T.card : T.cinza50
                  const squad  = (row.commercial_squad || "").replace("_", "-").toUpperCase()

                  return (
                    <tr key={key} style={{ background: rowBg }}>

                      {/* Nome */}
                      <td style={{ ...tdBase(true), background: rowBg }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                            background: row.status ? "#22C55E" : T.cinza300,
                          }} />
                          <span style={{
                            fontSize: 12.5, fontWeight: 600, color: T.fg,
                            fontFamily: T.font, letterSpacing: "-0.01em",
                          }}>
                            {row.nome}
                          </span>
                          {squad && (
                            <span style={{
                              fontSize: 9, fontWeight: 600, color: accentColor,
                              background: `${accentColor}12`, border: `1px solid ${accentColor}20`,
                              borderRadius: 4, padding: "1px 5px", fontFamily: T.font,
                              letterSpacing: "0.03em", flexShrink: 0,
                            }}>
                              {squad}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Colunas de critérios */}
                      {cols.map(c => {
                        const accepted = isEditing && draft
                          ? draft[c.field]
                          : new Set(row[c.field])

                        return (
                          <td key={c.field} style={tdBase()}>
                            {isEditing && (
                              <div style={{
                                fontSize: 10, color: accentColor, fontWeight: 700,
                                letterSpacing: "0.06em", textTransform: "uppercase",
                                marginBottom: 5, opacity: 0.7,
                              }}>
                                {c.label}
                              </div>
                            )}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {c.options.map(opt => (
                                <Pill
                                  key={opt}
                                  label={opt}
                                  accepted={accepted.has(opt)}
                                  editing={isEditing}
                                  onToggle={() => toggleOption(c.field, opt)}
                                />
                              ))}
                            </div>
                          </td>
                        )
                      })}

                      {/* Ação */}
                      <td style={tdBase()}>
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {saveError && (
                              <span style={{ fontSize: 11, color: T.destructive, lineHeight: 1.4 }}>
                                {saveError}
                              </span>
                            )}
                            <button
                              onClick={() => saveEdit(row)}
                              disabled={saving}
                              style={{
                                padding: "5px 12px", borderRadius: 6, border: "none",
                                background: accentColor, color: "#fff", fontSize: 12,
                                fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
                                fontFamily: T.font, opacity: saving ? 0.7 : 1,
                                transition: "opacity 0.15s",
                              }}
                            >
                              {saving ? "Salvando…" : "Salvar"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              style={{
                                padding: "5px 12px", borderRadius: 6,
                                border: `1px solid ${T.border}`, background: T.card,
                                color: T.mutedFg, fontSize: 12, fontWeight: 500,
                                cursor: "pointer", fontFamily: T.font,
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(row)}
                            style={{
                              padding: "5px 12px", borderRadius: 6,
                              border: `1px solid ${T.border}`, background: T.card,
                              color: T.mutedFg, fontSize: 12, fontWeight: 500,
                              cursor: "pointer", fontFamily: T.font,
                              display: "flex", alignItems: "center", gap: 5,
                              transition: "border-color 0.15s, color 0.15s",
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor
                              ;(e.currentTarget as HTMLButtonElement).style.color = accentColor
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = T.border
                              ;(e.currentTarget as HTMLButtonElement).style.color = T.mutedFg
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Editar
                          </button>
                        )}
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && visibleRows.length > 0 && (
          <p style={{ marginTop: 10, fontSize: 11.5, color: T.cinza300, fontFamily: T.font }}>
            {visibleRows.length} empreendimento{visibleRows.length > 1 ? "s" : ""} · {vertical}
          </p>
        )}
      </main>
    </div>
  )
}
