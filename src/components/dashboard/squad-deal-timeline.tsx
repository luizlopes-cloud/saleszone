'use client'

import { useEffect, useState } from 'react'
import { T } from '@/lib/constants'

interface TimelineData {
  deal: {
    id: number; title: string; url: string; status: string; owner: string; addTime: string; wonTime: string | null; value: number; currency: string
  }
  person: { name: string | null; phone: string | null; email: string | null }
  fireflies: { id: string; title: string; date: string; duration: number; transcriptUrl: string; speakers: string[]; summaryStatus: string } | null
  whatsapp: { link: string; phone: string | null } | null
}

function fmtDateTimeBR(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtCurrency(value: number, currency: string): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: currency || 'BRL', minimumFractionDigits: 0 })
}

function statusLabel(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'won': return { label: 'Ganho', bg: T.verde50, color: T.verde700 }
    case 'lost': return { label: 'Perdido', bg: T.vermelho50, color: T.destructive }
    case 'open': return { label: 'Aberto', bg: T.azul50, color: T.azul600 }
    default: return { label: status, bg: T.cinza50, color: T.cinza600 }
  }
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

export default function SquadDealTimeline({ dealId, onClose }: { dealId: number; onClose: () => void }) {
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/squad/deal-timeline/${dealId}`)
      .then(res => {
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) setData(json)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [dealId])

  const st = statusLabel(data?.deal.status ?? '')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        fontFamily: T.font,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: T.bg,
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 640,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 0,
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: T.fg }}>Timeline do Deal</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.mutedFg,
                backgroundColor: T.cinza50,
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              #{dealId}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 22,
              color: T.mutedFg,
              lineHeight: 1,
              padding: '4px 8px',
              borderRadius: 6,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = T.cinza50 }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 24px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: `3px solid ${T.cinza100}`,
                  borderTopColor: T.primary,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: 14, color: T.mutedFg }}>Carregando timeline...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {error && (
            <div
              style={{
                backgroundColor: T.vermelho50,
                border: `1px solid ${T.destructive}`,
                borderRadius: 10,
                padding: '16px 20px',
                color: T.destructive,
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Deal Info */}
              <div
                style={{
                  backgroundColor: T.cinza50,
                  borderRadius: 12,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <a
                    href={data.deal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: T.primary,
                      textDecoration: 'none',
                      maxWidth: '70%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
                  >
                    {data.deal.title}
                  </a>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: st.color,
                      backgroundColor: st.bg,
                      padding: '3px 10px',
                      borderRadius: 6,
                    }}
                  >
                    {st.label}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px 16px',
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ color: T.mutedFg }}>Proprietário: </span>
                    <span style={{ color: T.cardFg, fontWeight: 600 }}>{data.deal.owner}</span>
                  </div>
                  <div>
                    <span style={{ color: T.mutedFg }}>Valor: </span>
                    <span style={{ color: T.cardFg, fontWeight: 600 }}>{fmtCurrency(data.deal.value, data.deal.currency)}</span>
                  </div>
                  <div>
                    <span style={{ color: T.mutedFg }}>Criado: </span>
                    <span style={{ color: T.cardFg }}>{fmtDateTimeBR(data.deal.addTime)}</span>
                  </div>
                  <div>
                    <span style={{ color: T.mutedFg }}>Ganho: </span>
                    <span style={{ color: T.cardFg }}>{fmtDateTimeBR(data.deal.wonTime)}</span>
                  </div>
                </div>
              </div>

              {/* Person */}
              {data.person && (data.person.name || data.person.phone || data.person.email) && (
                <div
                  style={{
                    backgroundColor: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    padding: '14px 20px',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.fg, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Contato
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    {data.person.name && (
                      <div>
                        <span style={{ color: T.mutedFg }}>Nome: </span>
                        <span style={{ color: T.cardFg, fontWeight: 600 }}>{data.person.name}</span>
                      </div>
                    )}
                    {data.person.phone && (
                      <div>
                        <span style={{ color: T.mutedFg }}>Telefone: </span>
                        <span style={{ color: T.cardFg }}>{data.person.phone}</span>
                      </div>
                    )}
                    {data.person.email && (
                      <div>
                        <span style={{ color: T.mutedFg }}>Email: </span>
                        <span style={{ color: T.cardFg }}>{data.person.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fireflies */}
              <div
                style={{
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: '14px 20px',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: T.fg, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Reunião (Fireflies)
                </div>
                {data.fireflies ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <a
                        href={data.fireflies.transcriptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: T.primary, textDecoration: 'none', fontWeight: 600 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
                      >
                        {data.fireflies.title}
                      </a>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: data.fireflies.summaryStatus === 'completed' ? T.verde700 : T.laranja500,
                          backgroundColor: data.fireflies.summaryStatus === 'completed' ? T.verde50 : T.vermelho50,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {data.fireflies.summaryStatus === 'completed' ? 'Resumo OK' : data.fireflies.summaryStatus}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <span style={{ color: T.mutedFg }}>Data: </span>
                        <span style={{ color: T.cardFg }}>{fmtDateTimeBR(data.fireflies.date)}</span>
                      </div>
                      <div>
                        <span style={{ color: T.mutedFg }}>Duração: </span>
                        <span style={{ color: T.cardFg }}>{fmtDuration(data.fireflies.duration)}</span>
                      </div>
                    </div>
                    {data.fireflies.speakers.length > 0 && (
                      <div>
                        <span style={{ color: T.mutedFg }}>Participantes: </span>
                        <span style={{ color: T.cardFg }}>{data.fireflies.speakers.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: T.mutedFg, fontStyle: 'italic' }}>
                    Nenhuma reunião encontrada
                  </span>
                )}
              </div>

              {/* WhatsApp */}
              <div
                style={{
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: '14px 20px',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: T.fg, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  WhatsApp
                </div>
                {data.whatsapp ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                    <a
                      href={data.whatsapp.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: T.primary,
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
                    >
                      Abrir conversa
                    </a>
                    {data.whatsapp.phone && (
                      <span style={{ color: T.mutedFg }}>{data.whatsapp.phone}</span>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: T.mutedFg, fontStyle: 'italic' }}>
                    Nenhuma conversa encontrada
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
