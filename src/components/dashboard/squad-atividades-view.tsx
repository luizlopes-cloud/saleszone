'use client'

import { useEffect, useState, useMemo } from 'react'
import { T } from '@/lib/constants'
// SquadAtencaoView removed — this view now renders only AtividadesContent

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface PresellerStats {
  name: string
  color: string
  tempoResposta: string
  tempoRespostaMinutos: number
  abaixo30min: number
  total: number
  comLigacao: number
  comLigacaoPct: number
  pendentes: number
  chamadasTotal?: number
  chamadasDia?: number
  chamadasOntem?: number
  duracaoMedia?: string
  taxaAtendimento?: number
}

interface RecentDeal {
  dealId: number
  dealTitle: string
  dealUrl: string
  preVendedor: string
  criacaoDeal: string
  transbordo: string
  ultimaMia: string
  tempoResposta: string
  tempoRespostaMinutos: number
  status: 'respondido' | 'pendente' | 'atrasado'
}

interface PreVendaData {
  mediaTempoResposta: string
  dealsOpen: number
  abaixo30minPct: number
  pendentes: number
  presellers: PresellerStats[]
  recentDeals: RecentDeal[]
  noData?: boolean
  message?: string
}

interface ActivityType {
  type: string
  label: string
  color: string
  count: number
}

interface PVAtividade {
  name: string
  squadName: string
  color: string
  realizado: number
  metaEsperada: number
  metaTotal: number
  pctMeta: number
  projecao: number
  porDia: Record<string, number>
  porTipo: Record<string, number>
  porHora: Record<number, number>
}

interface AtividadesData {
  totalAtividades: number
  pctMetaGeral: number
  projecaoGeral: number
  metaMensal: number
  metaDiaria: number
  diasUteisTotal: number
  diasUteisPassados: number
  preVendedores: PVAtividade[]
  activityTypes: ActivityType[]
  heatmap: Record<string, Record<number, number>>
  noData?: boolean
  message?: string
}

// ─── Spinner keyframes ──────────────────────────────────────────────────────

const spinKeyframes = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

// ─── Helpers ────────────────────────────────────────────────────────────────

function tempoBadgeStyle(minutos: number): React.CSSProperties {
  if (minutos <= 15) return { backgroundColor: '#dcfce7', color: '#15803d' }
  if (minutos <= 30) return { backgroundColor: '#dbeafe', color: '#1d4ed8' }
  if (minutos <= 60) return { backgroundColor: '#ffedd5', color: '#c2410c' }
  return { backgroundColor: T.vermelho50, color: '#dc2626' }
}

function statusBadgeStyle(status: string): { style: React.CSSProperties; label: string } {
  switch (status) {
    case 'respondido': return { style: { backgroundColor: '#dcfce7', color: '#15803d' }, label: 'Respondido' }
    case 'pendente': return { style: { backgroundColor: '#ffedd5', color: '#c2410c' }, label: 'Pendente' }
    case 'atrasado': return { style: { backgroundColor: T.vermelho50, color: '#dc2626' }, label: 'Atrasado' }
    default: return { style: { backgroundColor: T.cinza50, color: T.cinza600 }, label: status }
  }
}

function metaColorStyle(pct: number): React.CSSProperties {
  if (pct >= 100) return { backgroundColor: '#dcfce7', color: '#15803d' }
  if (pct >= 70) return { backgroundColor: '#fef9c3', color: '#a16207' }
  return { backgroundColor: T.vermelho50, color: '#dc2626' }
}

function metaRowBgColor(pct: number): string {
  if (pct >= 100) return '#f0fdf4'
  if (pct >= 70) return '#fefce8'
  return '#fef2f2'
}

function progressBarColor(pct: number): string {
  if (pct >= 100) return '#22c55e'
  if (pct >= 70) return '#facc15'
  return '#f87171'
}

function formatDateBR(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function getDayName(dateStr: string): string {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return days[new Date(dateStr + 'T12:00:00').getDay()]
}

function cellColor(count: number, max: number): React.CSSProperties {
  if (count === 0) return { backgroundColor: T.cinza50, color: T.cinza200 }
  const intensity = Math.min(count / max, 1)
  if (intensity >= 0.75) return { backgroundColor: T.azul600, color: '#FFF' }
  if (intensity >= 0.5) return { backgroundColor: '#6B8AFF', color: '#FFF' }
  if (intensity >= 0.25) return { backgroundColor: T.azul50, color: T.azul600 }
  return { backgroundColor: '#E8EEFF', color: T.azul600 }
}

// ─── Inline SummaryCard ─────────────────────────────────────────────────────

function SummaryCard({ label, value, color, tip }: { label: string; value: string | number; color?: string; tip?: string }) {
  const valueColor = color === 'green' ? T.verde700 : color === 'red' ? T.destructive : color === 'orange' ? T.laranja500 : T.fg
  return (
    <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', boxShadow: T.elevSm }} title={tip}>
      <div style={{ fontSize: 11, color: T.mutedFg, marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, fontFamily: T.font }}>{value}</div>
    </div>
  )
}

// ─── Inline Spinner ─────────────────────────────────────────────────────────

function Spinner({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <style>{spinKeyframes}</style>
      <div style={{ width: 28, height: 28, border: `3px solid ${T.border}`, borderTopColor: T.azul600, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <div style={{ fontSize: 13, color: T.cinza600 }}>{message}</div>
    </div>
  )
}

// ─── Toggle Button Group ────────────────────────────────────────────────────

function ToggleGroup({ items, active, onChange }: { items: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, backgroundColor: T.cinza50, borderRadius: 8, padding: 3 }}>
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.15s',
            ...(active === item.key
              ? { backgroundColor: T.bg, color: T.fg, boxShadow: T.elevSm }
              : { backgroundColor: 'transparent', color: T.cinza600 }),
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Componente Principal ───────────────────────────────────────────────────

type SubTab = 'tempo-resposta' | 'atividades' | 'atencao'

export default function SquadAtividadesView({ pipelineSlug, dateFrom, dateTo }: { pipelineSlug: string; dateFrom: string; dateTo: string }) {
  return (
    <AtividadesContent
      pipelineSlug={pipelineSlug}
      dateFrom={dateFrom}
      dateTo={dateTo}
      filterPreseller="todos"
      onFilterChange={() => {}}
    />
  )
}

// ─── Sub-aba: Ligações (Tempo de Resposta) ──────────────────────────────────

function TempoRespostaContent({
  pipelineSlug, dateFrom, dateTo, selectedPreseller, onSelectPreseller, onNavigateToAtividades
}: {
  pipelineSlug: string; dateFrom: string; dateTo: string
  selectedPreseller: string
  onSelectPreseller: (name: string) => void
  onNavigateToAtividades: (name: string) => void
}) {
  const [data, setData] = useState<PreVendaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/dashboard/presales?pipeline=${pipelineSlug}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [pipelineSlug, dateFrom, dateTo])

  if (loading) return <Spinner message="Carregando pré-venda..." />
  if (error) return (
    <div style={{ backgroundColor: T.vermelho50, color: '#dc2626', padding: '10px 16px', borderRadius: 8, border: `1px solid ${T.vermelho100}`, fontSize: 13 }}>
      {error}
    </div>
  )
  if (!data) return null
  if (data.noData) return (
    <div style={{ backgroundColor: '#fefce8', color: '#a16207', padding: '10px 16px', borderRadius: 8, border: '1px solid #fde68a', fontSize: 13 }}>
      {data.message || 'Pré-venda não disponível para este funil.'}
    </div>
  )

  const filteredDeals = selectedPreseller === 'todos'
    ? data.recentDeals
    : data.recentDeals.filter((d) => d.preVendedor === selectedPreseller)

  const totalChamadasOntem = data.presellers.reduce((sum, ps) => sum + (ps.chamadasOntem ?? 0), 0)
  const totalChamadasDia = data.presellers.reduce((sum, ps) => sum + (ps.chamadasDia ?? 0), 0)
  const mediaComLigacaoPct = data.presellers.length > 0
    ? Math.round(data.presellers.reduce((sum, ps) => sum + ps.comLigacaoPct, 0) / data.presellers.length)
    : 0

  const thStyle: React.CSSProperties = { padding: '8px 12px', fontWeight: 500, fontSize: 11, color: T.cinza600, textTransform: 'uppercase' as const }
  const tdStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 13, fontFamily: 'monospace' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <SummaryCard label="Deals no Período" value={data.dealsOpen} />
        <SummaryCard
          label="% Deals com Ligação"
          value={`${mediaComLigacaoPct}%`}
          color={mediaComLigacaoPct >= 70 ? 'green' : mediaComLigacaoPct >= 40 ? 'orange' : 'red'}
        />
        <SummaryCard label="Chamadas/Dia (Média 7d)" value={totalChamadasDia} />
        <SummaryCard
          label="Chamadas Ontem"
          value={totalChamadasOntem}
          color={totalChamadasOntem >= totalChamadasDia ? 'green' : 'red'}
        />
      </div>

      {/* Racional */}
      <div style={{ backgroundColor: T.azul50, border: `1px solid #bfdbfe`, borderRadius: 8, padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ color: T.azul600, fontSize: 13, marginTop: 1 }}>i</span>
          <div style={{ fontSize: 11, color: '#1e40af' }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Racional — Ligações</p>
            <p style={{ margin: 0 }}>
              Verifica se os deals receberam ao menos uma ligação após a criação no Pipedrive.
              &quot;Com Ligação&quot; = deal tem atividade tipo <strong>call</strong> registrada.
              Média atual: <strong>{data.mediaTempoResposta}</strong> de tempo de resposta | {data.pendentes} deals pendentes (sem nenhuma atividade).
            </p>
          </div>
        </div>
      </div>

      {/* Tabela por Pré-Vendedor */}
      <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.elevSm, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg, margin: 0 }}>Ligações por Pré-Vendedor</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedPreseller !== 'todos' && (
              <button
                onClick={() => onSelectPreseller('todos')}
                style={{ fontSize: 11, color: T.azul600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Limpar filtro
              </button>
            )}
            <span style={{ fontSize: 10, color: T.cinza400 }}>Clique para filtrar atividades</span>
          </div>
        </div>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: T.cinza50 }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>PRÉ-VENDEDOR</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>DEALS</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>COM LIGAÇÃO</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>PENDENTES</th>
              <th style={{ ...thStyle, textAlign: 'right', borderLeft: `1px solid ${T.border}` }}>CHAMADAS/DIA</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>ONTEM</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>DUR. MÉDIA</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>% ATEND.</th>
            </tr>
          </thead>
          <tbody>
            {data.presellers.map((ps) => {
              const isSelected = selectedPreseller === ps.name
              return (
                <tr
                  key={ps.name}
                  onClick={() => onNavigateToAtividades(isSelected ? 'todos' : ps.name)}
                  style={{
                    borderBottom: `1px solid ${T.cinza50}`,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? T.azul50 : 'transparent',
                    outline: isSelected ? `1px solid #bfdbfe` : 'none',
                    outlineOffset: -1,
                  }}
                >
                  <td style={{ ...tdStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: ps.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, color: T.fg, fontFamily: 'inherit' }}>{ps.name}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{ps.total}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {ps.comLigacao} <span style={{ color: T.cinza400 }}>({ps.comLigacaoPct}%)</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {ps.pendentes > 0 ? (
                      <span style={{ color: T.destructive, fontWeight: 600 }}>{ps.pendentes}</span>
                    ) : (
                      <span style={{ color: T.cinza200 }}>0</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', borderLeft: `1px solid ${T.border}` }}>
                    {ps.chamadasDia != null ? (
                      <span style={{ color: ps.chamadasDia >= 15 ? '#16a34a' : ps.chamadasDia >= 8 ? T.fg : T.laranja500, fontWeight: ps.chamadasDia >= 15 ? 600 : 400 }}>
                        {ps.chamadasDia}
                      </span>
                    ) : <span style={{ color: T.cinza200 }}>-</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {ps.chamadasOntem != null ? (
                      <span style={{
                        color: ps.chamadasDia != null && ps.chamadasOntem >= ps.chamadasDia
                          ? '#16a34a'
                          : ps.chamadasOntem > 0
                            ? T.fg
                            : '#ef4444',
                        fontWeight: ps.chamadasDia != null && ps.chamadasOntem >= ps.chamadasDia ? 600 : 400,
                      }}>
                        {ps.chamadasOntem}
                      </span>
                    ) : <span style={{ color: T.cinza200 }}>-</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: T.cinza700, fontFamily: 'monospace' }}>
                    {ps.duracaoMedia || '-'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {ps.taxaAtendimento != null ? (
                      <span style={{ color: ps.taxaAtendimento >= 50 ? '#16a34a' : ps.taxaAtendimento >= 30 ? T.laranja500 : '#ef4444' }}>
                        {ps.taxaAtendimento}%
                      </span>
                    ) : <span style={{ color: T.cinza200 }}>-</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Deals Recentes */}
      <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.elevSm, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg, margin: 0 }}>
            Deals Recentes
            {selectedPreseller !== 'todos' && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: T.azul600 }}>— {selectedPreseller}</span>
            )}
          </h3>
          <select
            value={selectedPreseller}
            onChange={(e) => onSelectPreseller(e.target.value)}
            style={{ fontSize: 11, border: `1px solid ${T.border}`, borderRadius: 8, padding: '5px 8px', color: T.cinza600, outline: 'none' }}
          >
            <option value="todos">Todos</option>
            {data.presellers.map((ps) => (
              <option key={ps.name} value={ps.name}>{ps.name}</option>
            ))}
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: T.cinza50 }}>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 180 }}>DEAL</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>PRÉ-VENDEDOR</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>CRIAÇÃO DEAL</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>TRANSBORDO</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ÚLTIMA MIA</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>TEMPO RESP.</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal) => {
                const st = statusBadgeStyle(deal.status)
                return (
                  <tr key={deal.dealId} style={{ borderBottom: `1px solid ${T.cinza50}` }}>
                    <td style={{ padding: '8px 12px' }}>
                      <a
                        href={deal.dealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: T.azul600, textDecoration: 'none', fontWeight: 500, fontSize: 11 }}
                      >
                        {deal.dealTitle}
                      </a>
                    </td>
                    <td style={{ padding: '8px 12px', color: T.cinza700, fontSize: 11 }}>{deal.preVendedor}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: T.cinza600, fontSize: 11 }}>{deal.criacaoDeal}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: T.cinza600, fontSize: 11 }}>{deal.transbordo}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: T.cinza600, fontSize: 11 }}>{deal.ultimaMia}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {deal.tempoRespostaMinutos < 9999 ? (
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontWeight: 500, fontSize: 11, ...tempoBadgeStyle(deal.tempoRespostaMinutos) }}>
                          {deal.tempoResposta}
                        </span>
                      ) : (
                        <span style={{ color: T.cinza200, fontSize: 11 }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontWeight: 500, fontSize: 11, ...st.style }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: T.cinza400, fontSize: 13 }}>
                    Nenhum deal encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-aba: Atividades ─────────────────────────────────────────────────────

type PeriodFilter = 'dia' | 'ontem' | 'semana' | 'mes'

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateRange(period: PeriodFilter, dateFrom: string, dateTo: string): { start: string; end: string } {
  const now = new Date()
  switch (period) {
    case 'dia':
      return { start: fmtLocal(now), end: fmtLocal(now) }
    case 'ontem': {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      return { start: fmtLocal(yesterday), end: fmtLocal(yesterday) }
    }
    case 'semana': {
      const mon = new Date(now)
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      return { start: fmtLocal(mon), end: fmtLocal(now) }
    }
    case 'mes':
    default:
      return { start: dateFrom, end: dateTo }
  }
}

function AtividadesContent({
  pipelineSlug, dateFrom, dateTo, filterPreseller, onFilterChange
}: {
  pipelineSlug: string; dateFrom: string; dateTo: string
  filterPreseller: string
  onFilterChange: (name: string) => void
}) {
  const [data, setData] = useState<AtividadesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodFilter>('mes')

  const { start: periodStart, end: periodEnd } = getDateRange(period, dateFrom, dateTo)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/squad/activities?pipeline=${pipelineSlug}&dateFrom=${periodStart}&dateTo=${periodEnd}`, { signal: controller.signal })
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const json = await res.json()
        if (!controller.signal.aborted) setData(json)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchData()
    return () => controller.abort()
  }, [pipelineSlug, periodStart, periodEnd])

  const filteredPVs = useMemo(() => {
    if (!data) return []
    if (filterPreseller === 'todos') return data.preVendedores
    return data.preVendedores.filter(pv => pv.name === filterPreseller)
  }, [data, filterPreseller])

  if (loading) return <Spinner message="Carregando atividades..." />
  if (error) return (
    <div style={{ backgroundColor: T.vermelho50, color: '#dc2626', padding: '10px 16px', borderRadius: 8, border: `1px solid ${T.vermelho100}`, fontSize: 13 }}>
      {error}
    </div>
  )
  if (!data) return null
  if (data.noData) return (
    <div style={{ backgroundColor: '#fefce8', color: '#a16207', padding: '10px 16px', borderRadius: 8, border: '1px solid #fde68a', fontSize: 13 }}>
      {data.message || 'Atividades não disponíveis para este funil.'}
    </div>
  )

  const totalFiltered = filteredPVs.reduce((s, pv) => s + pv.realizado, 0)

  const periodItems = [
    { key: 'dia', label: 'Hoje' },
    { key: 'ontem', label: 'Ontem' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mês' },
  ]

  const thStyle: React.CSSProperties = { padding: '8px 12px', fontWeight: 500, fontSize: 11, color: T.cinza600, textTransform: 'uppercase' as const }
  const tdStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 13 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filtros de período + pessoa */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <ToggleGroup
          items={periodItems}
          active={period}
          onChange={(key) => setPeriod(key as PeriodFilter)}
        />

        {filterPreseller !== 'todos' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: T.cinza600 }}>Filtrando:</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#1d4ed8', backgroundColor: T.azul50, padding: '4px 8px', borderRadius: 4 }}>
              {filterPreseller}
            </span>
            <button onClick={() => onFilterChange('todos')} style={{ fontSize: 11, color: T.azul600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <SummaryCard label="Total de Atividades" value={filterPreseller === 'todos' ? data.totalAtividades : totalFiltered} />
        <SummaryCard
          label="% da Meta"
          value={`${data.pctMetaGeral}%`}
          color={data.pctMetaGeral >= 100 ? 'green' : data.pctMetaGeral >= 70 ? 'orange' : 'red'}
        />
        <SummaryCard label="Projeção Mensal" value={data.projecaoGeral} />
        <SummaryCard
          label="Dias Úteis"
          value={`${data.diasUteisPassados}/${data.diasUteisTotal}`}
          tip={`Meta mensal: ${data.metaMensal} | Meta diária: ${data.metaDiaria} atividades`}
        />
      </div>

      {/* Contadores por tipo de atividade */}
      {data.activityTypes && data.activityTypes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {data.activityTypes.map((at) => (
            <div
              key={at.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 9999,
                border: `1px solid ${at.color}40`,
                backgroundColor: `${at.color}10`,
                color: at.color,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: at.color }} />
              {at.label}
              <span style={{ fontWeight: 700, marginLeft: 2 }}>{at.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabela por pré-vendedor */}
      <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.elevSm, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg, margin: 0 }}>Atividades por Responsável</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: T.cinza400 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4ade80', display: 'inline-block' }} /> &ge; 100%</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#facc15', display: 'inline-block' }} /> &ge; 70%</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f87171', display: 'inline-block' }} /> &lt; 70%</span>
          </div>
        </div>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: T.cinza50 }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>RESPONSÁVEL</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>REALIZADO</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>ESPERADO</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>%</th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 200 }}>PROGRESSO</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>PROJEÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {filteredPVs.map((pv) => (
              <tr
                key={pv.name}
                onClick={() => onFilterChange(filterPreseller === pv.name ? 'todos' : pv.name)}
                style={{
                  borderBottom: `1px solid ${T.cinza50}`,
                  cursor: 'pointer',
                  backgroundColor: filterPreseller === pv.name ? T.azul50 : metaRowBgColor(pv.pctMeta),
                  outline: filterPreseller === pv.name ? '1px solid #bfdbfe' : 'none',
                  outlineOffset: -1,
                }}
              >
                <td style={{ ...tdStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: pv.color, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontWeight: 500, color: T.fg }}>{pv.name}</span>
                    <span style={{ fontSize: 11, color: T.cinza400, marginLeft: 6 }}>{pv.squadName}</span>
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{pv.realizado}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: T.cinza600 }}>{pv.metaEsperada}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, ...metaColorStyle(pv.pctMeta) }}>
                    {pv.pctMeta}%
                  </span>
                </td>
                <td style={{ ...tdStyle }}>
                  <div style={{ width: '100%', backgroundColor: T.cinza200, borderRadius: 9999, height: 12, position: 'relative', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 9999,
                        transition: 'width 0.5s',
                        backgroundColor: progressBarColor(pv.pctMeta),
                        width: `${Math.min(pv.pctMeta, 100)}%`,
                      }}
                    />
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: T.cinza700 }}>{pv.projecao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Breakdown por tipo */}
      {filteredPVs.length > 0 && filteredPVs.some(pv => Object.keys(pv.porTipo || {}).length > 0) && (
        <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.elevSm, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg, margin: 0 }}>Detalhamento por Tipo</h3>
          </div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {filteredPVs.map((pv) => {
              const tipos = Object.entries(pv.porTipo || {}).sort((a, b) => b[1] - a[1])
              if (tipos.length === 0) return null
              const typeColors: Record<string, string> = {}
              const typeLabels: Record<string, string> = {}
              for (const at of (data.activityTypes || [])) {
                typeColors[at.type] = at.color
                typeLabels[at.type] = at.label
              }
              return (
                <div key={pv.name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: T.fg }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: pv.color }} />
                    {pv.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {tipos.map(([type, count]) => {
                      const color = typeColors[type] || '#6B7280'
                      const label = typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)
                      const pct = pv.realizado > 0 ? Math.round((count / pv.realizado) * 100) : 0
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                          <span style={{ color: T.cinza600, flex: 1 }}>{label}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: T.fg }}>{count}</span>
                          <div style={{ width: 64, backgroundColor: T.cinza50, borderRadius: 9999, height: 6, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 9999, backgroundColor: color, width: `${pct}%` }} />
                          </div>
                          <span style={{ color: T.cinza400, width: 32, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Heatmaps */}
      <PeopleHeatmaps preVendedores={filteredPVs} heatmap={data.heatmap} periodStart={periodStart} periodEnd={periodEnd} />
    </div>
  )
}

// ─── Heatmaps: Pessoas × Horas / Pessoas × Dias ────────────────────────────

type HeatmapView = 'horas' | 'dias'

function PeopleHeatmaps({ preVendedores, heatmap, periodStart, periodEnd }: {
  preVendedores: PVAtividade[]
  heatmap: Record<string, Record<number, number>>
  periodStart: string
  periodEnd: string
}) {
  const [view, setView] = useState<HeatmapView>('horas')
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

  const days = useMemo(() => {
    const result: string[] = []
    const d = new Date(periodStart + 'T12:00:00')
    const end = new Date(periodEnd + 'T12:00:00')
    while (d <= end) {
      result.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }
    return result
  }, [periodStart, periodEnd])

  const pvByHour = useMemo(() => {
    return preVendedores.map(pv => ({
      name: pv.name, color: pv.color,
      hours: hours.map(h => pv.porHora?.[h] || 0),
      total: pv.realizado,
    }))
  }, [preVendedores])

  const pvByDay = useMemo(() => {
    return preVendedores.map(pv => ({
      name: pv.name,
      color: pv.color,
      days: days.map(d => pv.porDia?.[d] || 0),
      total: days.reduce((s, d) => s + (pv.porDia?.[d] || 0), 0),
    }))
  }, [preVendedores, days])

  const maxHour = useMemo(() => {
    let m = 0
    for (const pv of pvByHour) for (const v of pv.hours) if (v > m) m = v
    return m || 1
  }, [pvByHour])

  const maxDay = useMemo(() => {
    let m = 0
    for (const pv of pvByDay) for (const v of pv.days) if (v > m) m = v
    return m || 1
  }, [pvByDay])

  if (preVendedores.length === 0) return null

  const heatmapViews = [
    { key: 'horas', label: 'Por Hora' },
    { key: 'dias', label: 'Por Dia' },
  ]

  const legendColors = [
    { bg: T.cinza50, border: T.cinza200 },
    { bg: '#E8EEFF', border: undefined },
    { bg: T.azul50, border: undefined },
    { bg: '#6B8AFF', border: undefined },
    { bg: T.azul600, border: undefined },
  ]

  const colorLegend = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.cinza400 }}>
      <span>Menos</span>
      {legendColors.map((lc, i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: lc.bg, border: lc.border ? `1px solid ${lc.border}` : undefined }} />
      ))}
      <span>Mais</span>
    </div>
  )

  const thCell: React.CSSProperties = { padding: '0 2px', paddingBottom: 8, textAlign: 'center', fontWeight: 500, color: T.cinza400, minWidth: 36 }
  const stickyTd: React.CSSProperties = { paddingRight: 12, paddingTop: 4, paddingBottom: 4, position: 'sticky' as const, left: 0, backgroundColor: T.bg, minWidth: 130 }

  return (
    <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.elevSm, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg, margin: 0 }}>Mapa de Atividades</h3>
          <ToggleGroup
            items={heatmapViews}
            active={view}
            onChange={(key) => setView(key as HeatmapView)}
          />
        </div>
        {colorLegend}
      </div>
      <div style={{ overflowX: 'auto', padding: 16 }}>
        {view === 'horas' ? (
          <table style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thCell, textAlign: 'left', position: 'sticky' as const, left: 0, backgroundColor: T.bg, minWidth: 130, paddingRight: 12 }}>Pessoa</th>
                {hours.map(h => (
                  <th key={h} style={thCell}>
                    {String(h).padStart(2, '0')}h
                  </th>
                ))}
                <th style={{ ...thCell, textAlign: 'right', paddingLeft: 12 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pvByHour.map(pv => (
                <tr key={pv.name}>
                  <td style={stickyTd}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pv.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, color: T.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }} title={pv.name}>
                        {pv.name.split(' ')[0]}
                      </span>
                    </div>
                  </td>
                  {pv.hours.map((count, i) => (
                    <td key={i} style={{ padding: '2px 2px' }}>
                      <div
                        style={{
                          height: 32,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontFamily: 'monospace',
                          fontWeight: 500,
                          ...cellColor(count, maxHour),
                        }}
                        title={`${pv.name} às ${hours[i]}h: ${count} atividades`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    </td>
                  ))}
                  <td style={{ paddingLeft: 12, paddingTop: 4, paddingBottom: 4, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: T.cinza700 }}>{pv.total}</td>
                </tr>
              ))}
              {/* Linha totais */}
              <tr style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ ...stickyTd, paddingTop: 8, paddingBottom: 8, fontWeight: 600, color: T.cinza600, fontSize: 11 }}>TOTAL</td>
                {hours.map((h, i) => {
                  const total = pvByHour.reduce((s, pv) => s + pv.hours[i], 0)
                  return (
                    <td key={h} style={{ padding: '8px 2px', textAlign: 'center', fontFamily: 'monospace', fontSize: 10, color: T.cinza600, fontWeight: 600 }}>
                      {total > 0 ? total : ''}
                    </td>
                  )
                })}
                <td style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: T.fg }}>
                  {pvByHour.reduce((s, pv) => s + pv.total, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thCell, textAlign: 'left', position: 'sticky' as const, left: 0, backgroundColor: T.bg, minWidth: 130, paddingRight: 12 }}>Pessoa</th>
                {days.map(day => (
                  <th key={day} style={{ ...thCell, minWidth: 36 }}>
                    <div style={{ fontSize: 10 }}>{getDayName(day)}</div>
                    <div style={{ fontSize: 9, color: T.cinza200 }}>{formatDateBR(day)}</div>
                  </th>
                ))}
                <th style={{ ...thCell, textAlign: 'right', paddingLeft: 12 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pvByDay.map(pv => (
                <tr key={pv.name}>
                  <td style={stickyTd}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pv.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, color: T.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }} title={pv.name}>
                        {pv.name.split(' ')[0]}
                      </span>
                    </div>
                  </td>
                  {pv.days.map((count, i) => (
                    <td key={i} style={{ padding: '2px 2px' }}>
                      <div
                        style={{
                          height: 32,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontFamily: 'monospace',
                          fontWeight: 500,
                          ...cellColor(count, maxDay),
                        }}
                        title={`${pv.name} em ${formatDateBR(days[i])}: ${count} atividades`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    </td>
                  ))}
                  <td style={{ paddingLeft: 12, paddingTop: 4, paddingBottom: 4, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: T.cinza700 }}>{pv.total}</td>
                </tr>
              ))}
              {/* Linha totais */}
              <tr style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ ...stickyTd, paddingTop: 8, paddingBottom: 8, fontWeight: 600, color: T.cinza600, fontSize: 11 }}>TOTAL</td>
                {days.map((day, i) => {
                  const total = pvByDay.reduce((s, pv) => s + pv.days[i], 0)
                  return (
                    <td key={day} style={{ padding: '8px 2px', textAlign: 'center', fontFamily: 'monospace', fontSize: 10, color: T.cinza600, fontWeight: 600 }}>
                      {total > 0 ? total : ''}
                    </td>
                  )
                })}
                <td style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: T.fg }}>
                  {pvByDay.reduce((s, pv) => s + pv.total, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
