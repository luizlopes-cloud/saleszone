'use client'

import { useEffect, useState } from 'react'
import { T } from '@/lib/constants'
import SquadDealTimeline from './squad-deal-timeline'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DealAtencao {
  dealId: number
  dealTitle: string
  dealUrl: string
  responsavel: string
  etapa: string
  etapaGroup: string
  empreendimento: string
  nextActivityDate: string | null
  lastActivityDate: string | null
  motivo: 'sem_atividade' | 'atrasada'
}

interface RankingItem {
  name: string
  sem: number
  atrasada: number
  total: number
}

interface AtencaoData {
  totalOpen: number
  totalSemAtividade: number
  totalAtrasada: number
  totalComProblema: number
  pctComProblema: number
  ranking: RankingItem[]
  semAtividade: DealAtencao[]
  atrasada: DealAtencao[]
  updatedAt: string
}

type AtencaoFilter = 'todos' | 'sem_atividade' | 'atrasada'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dateStr
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SquadAtencaoView({ pipelineSlug, role }: { pipelineSlug: string; role: 'prevenda' | 'venda' }) {
  const [data, setData] = useState<AtencaoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AtencaoFilter>('todos')
  const [filterResponsavel, setFilterResponsavel] = useState<string>('todos')
  const [filterEtapa, setFilterEtapa] = useState<string>('todos')
  const [page, setPage] = useState(1)
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null)
  const pageSize = 50

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      setFilter('todos')
      setFilterResponsavel('todos')
      setFilterEtapa('todos')
      setPage(1)
      try {
        const res = await fetch(`/api/squad/atencao?pipeline=${pipelineSlug}&role=${role}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [pipelineSlug, role])

  if (loading) return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${T.azul600}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: T.mutedFg }}>Analisando deals sem atencao...</span>
      </div>
    </>
  )

  if (error) return (
    <div style={{ backgroundColor: T.vermelho50, color: "#B91C1C", padding: "12px 16px", borderRadius: 8, border: `1px solid ${T.vermelho100}`, fontSize: 13 }}>
      {error}
    </div>
  )

  if (!data) return null

  // Combina deals e aplica filtros
  const allDeals = [...data.semAtividade, ...data.atrasada]
  const filtered = allDeals.filter(d => {
    if (filter === 'sem_atividade' && d.motivo !== 'sem_atividade') return false
    if (filter === 'atrasada' && d.motivo !== 'atrasada') return false
    if (filterResponsavel !== 'todos' && d.responsavel !== filterResponsavel) return false
    if (filterEtapa !== 'todos' && d.etapaGroup !== filterEtapa) return false
    return true
  })

  // Paginacao
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginatedDeals = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Listas unicas para filtros
  const responsaveis = [...new Set(allDeals.map(d => d.responsavel))].sort()
  const etapas = [...new Set(allDeals.map(d => d.etapaGroup))].sort()

  // Color helper for summary cards
  function cardValueColor(value: number, thresholdOrange: number, thresholdRed: number): string {
    if (value > thresholdRed) return T.destructive
    if (value > thresholdOrange) return T.laranja500
    return T.fg
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div style={{ backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 18px", boxShadow: T.elevSm }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.03em" }}>DEALS ABERTOS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>{data.totalOpen}</div>
        </div>
        <div style={{ backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 18px", boxShadow: T.elevSm }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.03em" }}>SEM ATENCAO</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: cardValueColor(data.pctComProblema, 10, 20), fontVariantNumeric: "tabular-nums" }}>
            {data.totalComProblema}
          </div>
          <div style={{ fontSize: 10, color: T.mutedFg, marginTop: 2 }}>{data.pctComProblema}% dos deals abertos</div>
        </div>
        <div style={{ backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 18px", boxShadow: T.elevSm }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.03em" }}>SEM ATIVIDADE</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: cardValueColor(data.totalSemAtividade, 20, 50), fontVariantNumeric: "tabular-nums" }}>
            {data.totalSemAtividade}
          </div>
        </div>
        <div style={{ backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 18px", boxShadow: T.elevSm }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: T.mutedFg, textTransform: "uppercase", letterSpacing: "0.03em" }}>ATRASADOS (+1 DIA)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: cardValueColor(data.totalAtrasada, 20, 50), fontVariantNumeric: "tabular-nums" }}>
            {data.totalAtrasada}
          </div>
        </div>
      </div>

      {/* Ranking por responsavel */}
      {data.ranking.length > 0 && (
        <div style={{ backgroundColor: T.card, borderRadius: 8, border: `1px solid ${T.border}`, boxShadow: T.elevSm, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg, margin: 0 }}>Ranking — Deals sem Atencao por Responsavel</h3>
          </div>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: T.cinza50 }}>
                <th style={{ padding: "8px 16px", textAlign: "left", fontWeight: 500, fontSize: 11, color: T.cinza600, textTransform: "uppercase" }}>RESPONSAVEL</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600, textTransform: "uppercase" }}>SEM ATIVIDADE</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600, textTransform: "uppercase" }}>ATRASADOS</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600, textTransform: "uppercase" }}>TOTAL</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, fontSize: 11, color: T.cinza600, textTransform: "uppercase", width: "33%" }}>PROPORCAO</th>
              </tr>
            </thead>
            <tbody>
              {data.ranking.slice(0, 10).map((r, i) => {
                const maxTotal = data.ranking[0]?.total || 1
                const barWidth = Math.round((r.total / maxTotal) * 100)
                const isSelected = filterResponsavel === r.name
                return (
                  <tr
                    key={r.name}
                    style={{ borderBottom: `1px solid ${T.cinza100}`, cursor: "pointer", backgroundColor: isSelected ? T.azul50 : "transparent" }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = T.cinza50 }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent" }}
                    onClick={() => {
                      setFilterResponsavel(isSelected ? 'todos' : r.name)
                      setPage(1)
                    }}
                  >
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontWeight: 500, color: isSelected ? T.azul600 : T.fg }}>
                        {i + 1}. {r.name}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace" }}>
                      {r.sem > 0 ? (
                        <span style={{ color: T.laranja500 }}>{r.sem}</span>
                      ) : (
                        <span style={{ color: T.cinza200 }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace" }}>
                      {r.atrasada > 0 ? (
                        <span style={{ color: T.destructive }}>{r.atrasada}</span>
                      ) : (
                        <span style={{ color: T.cinza200 }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontFamily: "monospace", fontWeight: 600 }}>{r.total}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, backgroundColor: T.cinza100, borderRadius: 9999, height: 10, overflow: "hidden" }}>
                          <div style={{ display: "flex", height: "100%" }}>
                            <div
                              style={{ backgroundColor: "#FB923C", height: "100%", width: `${r.total > 0 ? (r.sem / r.total) * barWidth : 0}%` }}
                            />
                            <div
                              style={{ backgroundColor: "#F87171", height: "100%", width: `${r.total > 0 ? (r.atrasada / r.total) * barWidth : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela de deals */}
      <div style={{ backgroundColor: T.card, borderRadius: 8, border: `1px solid ${T.border}`, boxShadow: T.elevSm, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg, margin: 0 }}>
              Deals ({filtered.length})
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {/* Filtro motivo */}
              <div style={{ display: "flex", gap: 2, backgroundColor: T.cinza50, borderRadius: 6, padding: 2 }}>
                {([
                  { key: 'todos' as AtencaoFilter, label: 'Todos', count: allDeals.length },
                  { key: 'sem_atividade' as AtencaoFilter, label: 'Sem atividade', count: data.totalSemAtividade },
                  { key: 'atrasada' as AtencaoFilter, label: 'Atrasados', count: data.totalAtrasada },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setFilter(opt.key); setPage(1) }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                      backgroundColor: filter === opt.key ? T.bg : "transparent",
                      color: filter === opt.key ? T.fg : T.cinza600,
                      boxShadow: filter === opt.key ? T.elevSm : "none",
                    }}
                  >
                    {opt.label} ({opt.count})
                  </button>
                ))}
              </div>
              {/* Filtro responsavel */}
              <select
                value={filterResponsavel}
                onChange={(e) => { setFilterResponsavel(e.target.value); setPage(1) }}
                style={{ fontSize: 12, border: `1px solid ${T.cinza200}`, borderRadius: 8, padding: "6px 8px", color: T.cinza600, outline: "none", backgroundColor: T.bg }}
              >
                <option value="todos">Todos responsaveis</option>
                {responsaveis.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {/* Filtro etapa */}
              <select
                value={filterEtapa}
                onChange={(e) => { setFilterEtapa(e.target.value); setPage(1) }}
                style={{ fontSize: 12, border: `1px solid ${T.cinza200}`, borderRadius: 8, padding: "6px 8px", color: T.cinza600, outline: "none", backgroundColor: T.bg }}
              >
                <option value="todos">Todas etapas</option>
                {etapas.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: T.cinza50 }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, fontSize: 11, color: T.cinza600, minWidth: 200 }}>DEAL</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, fontSize: 11, color: T.cinza600 }}>RESPONSAVEL</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600 }}>ETAPA</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600 }}>PROX. ATIVIDADE</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600 }}>ULTIMA ATIV.</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600 }}>MOTIVO</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, fontSize: 11, color: T.cinza600 }}>ACAO</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDeals.map((deal) => (
                <tr
                  key={deal.dealId}
                  style={{ borderBottom: `1px solid ${T.cinza100}` }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = T.cinza50}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "8px 12px" }}>
                    <a
                      href={deal.dealUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: T.azul600, textDecoration: "none", fontWeight: 500 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = "underline"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = "none"}
                    >
                      {deal.dealTitle}
                    </a>
                    <div style={{ fontSize: 10, color: T.cinza400, marginTop: 2 }}>ID {deal.dealId}</div>
                  </td>
                  <td style={{ padding: "8px 12px", color: T.cinza700 }}>{deal.responsavel}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, backgroundColor: T.cinza100, color: T.cinza600, fontSize: 10, fontWeight: 500 }}>
                      {deal.etapa}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center", color: T.cinza600 }}>
                    {deal.nextActivityDate ? (
                      <span style={{ color: new Date(deal.nextActivityDate) < new Date() ? T.destructive : T.cinza600, fontWeight: new Date(deal.nextActivityDate) < new Date() ? 500 : 400 }}>
                        {formatDateBR(deal.nextActivityDate)}
                      </span>
                    ) : (
                      <span style={{ color: T.cinza200 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center", color: T.cinza600 }}>
                    {formatDateBR(deal.lastActivityDate)}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {deal.motivo === 'sem_atividade' ? (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, backgroundColor: "#FED7AA", color: "#C2410C", fontSize: 10, fontWeight: 500 }}>
                        Sem atividade
                      </span>
                    ) : (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, backgroundColor: T.vermelho100, color: "#B91C1C", fontSize: 10, fontWeight: 500 }}>
                        Atrasado
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button
                      onClick={() => setSelectedDealId(deal.dealId)}
                      style={{ fontSize: 12, color: T.azul600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = "underline"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = "none"}
                    >
                      Timeline
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedDeals.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: T.cinza400 }}>
                    Nenhum deal com problema encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Paginacao */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: T.cinza600 }}>
            <span>
              Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${T.cinza200}`, backgroundColor: T.bg, cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.3 : 1, fontSize: 12, color: T.fg }}
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i
                if (p > totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: `1px solid ${p === page ? T.azul600 : T.cinza200}`,
                      backgroundColor: p === page ? T.azul50 : T.bg,
                      color: p === page ? T.azul600 : T.fg,
                      fontWeight: p === page ? 500 : 400,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${T.cinza200}`, backgroundColor: T.bg, cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.3 : 1, fontSize: 12, color: T.fg }}
              >
                Proxima
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedDealId !== null && (
        <SquadDealTimeline
          dealId={selectedDealId}
          onClose={() => setSelectedDealId(null)}
        />
      )}
    </div>
  )
}
