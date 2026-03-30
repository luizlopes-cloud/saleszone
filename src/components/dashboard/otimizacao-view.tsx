"use client"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Loader2, Copy, Check, Settings, Pause, CheckSquare, Square, X, Info, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, RefreshCw } from "lucide-react"
import { computePerformanceRolling } from "@/lib/parseNekt"
import type { NektRow, AdPerformance } from "@/lib/adsTypes"
import { VERTICAL_CONFIGS, DEFAULT_CONFIG, normalizeStatus } from "@/lib/adsTypes"
import { T } from "@/lib/constants"

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

const GREEN = "#16a34a"
const AMBER = "#d97706"
const RED = T.destructive

const S = {
  card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 },
  th: {
    textAlign: "left" as const, padding: "8px 8px", fontSize: 10, color: T.mutedFg,
    fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em",
    whiteSpace: "nowrap" as const, background: T.cinza50, borderBottom: `1px solid ${T.border}`,
  },
  td: { padding: "7px 8px", fontSize: 11, color: T.fg, whiteSpace: "nowrap" as const, borderBottom: `1px solid ${T.cinza100}` },
}

interface PauseLogEntry {
  date: string; ad_id: string; ad_name: string; campaign_name: string; vertical: string; reason: string
}

function savePauseLog(entries: PauseLogEntry[]) {
  const existing = getPauseLog()
  existing.unshift(...entries)
  try { localStorage.setItem("otimizacao-pause-log", JSON.stringify(existing.slice(0, 500))) } catch { /**/ }
}

function getPauseLog(): PauseLogEntry[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem("otimizacao-pause-log") || "[]") } catch { return [] }
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      style={{ padding: 3, borderRadius: 4, border: "none", background: "none", cursor: "pointer", color: T.mutedFg }}
      title="Copiar ID"
    >
      {copied ? <Check size={11} style={{ color: GREEN }} /> : <Copy size={11} />}
    </button>
  )
}

function BenchBadge({ ratio }: { ratio: number }) {
  if (!ratio || ratio === 0) return <span style={{ fontSize: 10, color: T.mutedFg }}>—</span>
  const good = ratio <= 1
  return (
    <span style={{ fontSize: 10, fontFamily: "monospace", padding: "2px 4px", borderRadius: 4, background: good ? "rgba(22,163,74,0.1)" : "rgba(231,0,11,0.08)", color: good ? GREEN : RED }}>
      {good ? `↓${((1 - ratio) * 100).toFixed(0)}%` : `↑${((ratio - 1) * 100).toFixed(0)}%`}
    </span>
  )
}

function RateBadge({ rate, min }: { rate: number; min: number }) {
  if (rate === 0) return <span style={{ fontSize: 10, color: T.mutedFg }}>—</span>
  const good = rate >= min
  return (
    <span style={{ fontSize: 10, fontFamily: "monospace", padding: "2px 4px", borderRadius: 4, background: good ? "rgba(22,163,74,0.1)" : "rgba(231,0,11,0.08)", color: good ? GREEN : RED }}>
      {pct(rate)}
    </span>
  )
}

function TendenciaBadge({ tendencia }: { tendencia?: string }) {
  if (!tendencia || tendencia === "SEM_DADOS") return <span style={{ fontSize: 10, color: T.mutedFg }}>—</span>
  if (tendencia === "MELHORANDO") return <span style={{ fontSize: 10, fontWeight: 500, color: GREEN, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}><TrendingUp size={10} /> Melhorando</span>
  if (tendencia === "DEGRADANDO") return <span style={{ fontSize: 10, fontWeight: 500, color: RED, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}><TrendingDown size={10} /> Degradando</span>
  return <span style={{ fontSize: 10, color: T.mutedFg, whiteSpace: "nowrap" }}>→ Estável</span>
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    MANTER: { bg: "rgba(22,163,74,0.1)", color: GREEN, border: "rgba(22,163,74,0.3)" },
    MONITORAR: { bg: "rgba(217,119,6,0.1)", color: AMBER, border: "rgba(217,119,6,0.3)" },
    PAUSAR: { bg: "rgba(231,0,11,0.08)", color: RED, border: "rgba(231,0,11,0.3)" },
    AGUARDAR: { bg: T.cinza50, color: T.mutedFg, border: T.border },
  }
  const st = styles[status] || styles.AGUARDAR
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 4, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
      {status}
    </span>
  )
}

function generateRecommendation(ad: AdPerformance): string {
  const cfg = VERTICAL_CONFIGS[ad.vertical] || DEFAULT_CONFIG
  const bm = cfg.benchmarks
  const cp = cfg.checkpoints
  const parts: string[] = []

  if (ad.ad_status === "AGUARDAR") return `${ad.dias_ativos}d ativo — aguardando Day ${cp.mql} para primeira avaliação.`
  if (ad.ad_status === "MANTER") return "Performance dentro dos benchmarks. Manter rodando."

  if (ad.opp === 0 && ad.sql === 0 && ad.mql === 0 && ad.dias_ativos >= cp.mql) return `${ad.dias_ativos}d ativo sem nenhuma conversão.`
  if (ad.opp === 0 && ad.dias_ativos >= cp.opp) parts.push(`${ad.dias_ativos}d ativo sem OPP (passou Day ${cp.opp})`)
  else if (ad.sql === 0 && ad.dias_ativos >= cp.sql) parts.push(`${ad.dias_ativos}d ativo sem SQL (passou Day ${cp.sql})`)
  else if (ad.mql === 0 && ad.dias_ativos >= cp.mql) parts.push(`${ad.dias_ativos}d ativo sem MQL (passou Day ${cp.mql})`)

  if (ad.cost_per_mql > 0 && ad.cost_per_mql > bm.cost_per_mql) parts.push(`R$/MQL ${((ad.cost_per_mql / bm.cost_per_mql - 1) * 100).toFixed(0)}% acima`)
  if (ad.cost_per_sql > 0 && ad.cost_per_sql > bm.cost_per_sql) parts.push(`R$/SQL ${((ad.cost_per_sql / bm.cost_per_sql - 1) * 100).toFixed(0)}% acima`)
  if (ad.cost_per_opp > 0 && ad.cost_per_opp > bm.cost_per_opp) parts.push(`R$/OPP ${((ad.cost_per_opp / bm.cost_per_opp - 1) * 100).toFixed(0)}% acima`)

  const rateMqlSql = ad.mql > 0 ? ad.sql / ad.mql : 0
  const rateSqlOpp = ad.sql > 0 ? ad.opp / ad.sql : 0
  if (ad.mql >= 3 && rateMqlSql < 0.17) parts.push(`Taxa MQL→SQL ${pct(rateMqlSql)} (min 17%)`)
  if (ad.sql >= 3 && rateSqlOpp < 0.06) parts.push(`Taxa SQL→OPP ${pct(rateSqlOpp)} (min 6%)`)

  if (parts.length === 0) return ad.ad_status === "MONITORAR" ? "Métricas no limite — acompanhar." : "Avaliar manualmente."
  return parts.join(" · ")
}

function computePauseImpact(ad: AdPerformance, allAds: AdPerformance[]): { label: string; positive: boolean } | null {
  const siblings = allAds.filter(a => a.adset_name === ad.adset_name && a.ad_id !== ad.ad_id && a.effective_status === "ACTIVE")
  if (siblings.length === 0) return { label: "Último ativo no adset", positive: false }
  const sibsWithMql = siblings.filter(a => a.mql > 0 && a.cost_per_mql > 0)
  if (sibsWithMql.length === 0 || ad.mql === 0) return null
  const avgSibCostMql = sibsWithMql.reduce((s, a) => s + a.cost_per_mql, 0) / sibsWithMql.length
  const improvement = ((ad.cost_per_mql - avgSibCostMql) / ad.cost_per_mql) * 100
  return improvement > 0
    ? { label: `+${improvement.toFixed(0)}% MQL estimado`, positive: true }
    : { label: `${improvement.toFixed(0)}% MQL estimado`, positive: false }
}

function CampaignDropdown({ campaigns, selected, onChange }: {
  campaigns: string[]; selected: Set<string>; onChange: (s: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filtered = useMemo(() => campaigns.filter(c => c.toLowerCase().includes(search.toLowerCase())), [campaigns, search])
  const toggle = (c: string) => { const next = new Set(selected); next.has(c) ? next.delete(c) : next.add(c); onChange(next) }

  const label = selected.size === 0 ? "Todas as campanhas"
    : selected.size === 1 ? ([...selected][0].slice(0, 24) + ([...selected][0].length > 24 ? "…" : ""))
    : `${selected.size} campanhas`

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px",
          borderRadius: 8, border: `1px solid ${selected.size > 0 ? T.primary : T.border}`,
          background: selected.size > 0 ? `rgba(0,85,255,0.06)` : T.card,
          color: selected.size > 0 ? T.primary : T.mutedFg,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {label}
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", marginTop: 4, right: 0, width: 288,
          background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 30,
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${T.border}` }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campanha..."
              style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.fg, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ padding: "4px 8px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 4 }}>
            <button onClick={() => onChange(new Set())} style={{ fontSize: 10, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 4, fontFamily: "inherit" }}>Deselecionar todas</button>
            <button onClick={() => onChange(new Set(campaigns))} style={{ fontSize: 10, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 4, fontFamily: "inherit" }}>Selecionar todas</button>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", padding: 4 }}>
            {filtered.length === 0 && <p style={{ fontSize: 11, color: T.mutedFg, textAlign: "center", padding: "16px 12px" }}>Nenhuma campanha encontrada</p>}
            {filtered.map(c => (
              <button key={c} onClick={() => toggle(c)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", borderRadius: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${selected.has(c) ? T.primary : T.border}`, background: selected.has(c) ? T.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {selected.has(c) && <Check size={9} style={{ color: "#fff" }} />}
                </div>
                <span style={{ fontSize: 11, color: T.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const MODULE_VERTICAL: Record<string, string> = { szi: "Investimentos", mktp: "Marketplace", szs: "SZS" }

export function OtimizacaoView({ moduleId = "szi" }: { moduleId?: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [allAds, setAllAds] = useState<AdPerformance[]>([])
  const tab: string = MODULE_VERTICAL[moduleId] || "Investimentos"
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [pauseProgress, setPauseProgress] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [filterStatus, setFilterStatus] = useState("PAUSAR")
  const [filterCampaigns, setFilterCampaigns] = useState<Set<string>>(new Set())
  const [searchId, setSearchId] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/meta-ads/nekt?window=90")
      if (!res.ok) throw new Error((await res.json()).error || "Erro")
      const data = await res.json()
      const rows: NektRow[] = (data.rows || []).map((r: Record<string, unknown>) => ({
        date: String(r.date || ""), ad_id: String(r.ad_id || ""), ad_name: String(r.ad_name || ""),
        first_day_ad: String(r.first_day_ad || ""), adset_name: String(r.adset_name || ""),
        campaign_name: String(r.campaign_name || ""), first_day_campaign: String(r.first_day_campaign || ""),
        vertical: String(r.vertical || ""), status: String(r.status || ""),
        effective_status: normalizeStatus(String(r.effective_status || r.status || "")),
        plataforma: String(r.plataforma || ""), dias_ativos: Number(r.dias_ativos) || 0,
        spend: Number(r.spend) || 0, lead: Number(r.lead) || 0, mql: Number(r.mql) || 0,
        sql: Number(r.sql) || 0, opp: Number(r.opp) || 0, won: Number(r.won) || 0,
        ctr: Number(r.ctr) || 0, adset_id: String(r.adset_id || ""),
      })).filter((r: NektRow) => r.ad_id)

      const perf = computePerformanceRolling(rows).filter(a => a.ad_id.length >= 15)

      try {
        const ids = [...new Set(perf.map(a => a.ad_id))]
        const metaRes = await fetch("/api/meta-ads/meta-status", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adIds: ids }),
        })
        if (metaRes.ok) {
          const { statuses } = await metaRes.json()
          if (statuses) {
            for (const ad of perf) {
              ad.effective_status = statuses[ad.ad_id] ?? "UNKNOWN"
            }
          }
        }

        // Retry para UNKNOWN + fallback spend_7d
        const unknownIds = perf.filter(a => a.effective_status === "UNKNOWN").map(a => a.ad_id)
        if (unknownIds.length > 0) {
          try {
            const retryRes = await fetch("/api/meta-ads/meta-status", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adIds: unknownIds }),
            })
            if (retryRes.ok) {
              const { statuses: retryStatuses } = await retryRes.json()
              if (retryStatuses) {
                for (const ad of perf) {
                  if (ad.effective_status === "UNKNOWN" && retryStatuses[ad.ad_id]) {
                    ad.effective_status = retryStatuses[ad.ad_id]
                  }
                }
              }
            }
          } catch { /* retry opcional */ }
          // Fallback: UNKNOWN = Meta não retornou o ad (sem permissão ou delay).
          // Se Meta confirmasse PAUSED, teria retornado "PAUSED". Portanto, assumir ACTIVE.
          for (const ad of perf) {
            if (ad.effective_status === "UNKNOWN") {
              ad.effective_status = "ACTIVE"
            }
          }
        }
      } catch { /* Meta status é opcional */ }

      setAllAds(perf)
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const availableCampaigns = useMemo(() => {
    const verticalKey = tab === "Serviços" ? "SZS" : tab
    return [...new Set(allAds.filter(a => a.vertical === verticalKey && a.effective_status === "ACTIVE").map(a => a.campaign_name))].sort()
  }, [allAds, tab])

  const tabAds = useMemo(() => {
    if (searchId.trim()) {
      const id = searchId.trim()
      const prefix = id.length >= 15 ? id.substring(0, 15) : id
      return allAds.filter(a => a.ad_id.startsWith(prefix))
    }
    const verticalKey = tab === "Serviços" ? "SZS" : tab
    let base = allAds.filter(a => a.vertical === verticalKey && a.effective_status === "ACTIVE")
    if (filterCampaigns.size > 0) base = base.filter(a => filterCampaigns.has(a.campaign_name))
    if (filterStatus) base = base.filter(a => a.ad_status === filterStatus)
    return base
  }, [allAds, tab, filterStatus, filterCampaigns, searchId])

  const pauseCount = useMemo(() => tabAds.filter(a => a.ad_status === "PAUSAR").length, [tabAds])
  const toggleSelect = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const selectAllPausar = () => setSelected(new Set(tabAds.filter(a => a.ad_status === "PAUSAR").map(a => a.ad_id)))
  const selectedAds = useMemo(() => tabAds.filter(a => selected.has(a.ad_id)), [tabAds, selected])

  const handlePause = async () => {
    setShowConfirm(false)
    setPausing(true)
    const ids = selectedAds.map(a => a.ad_id)
    const total = ids.length
    const results: { ad_id: string; success: boolean; error?: string }[] = []

    for (let i = 0; i < ids.length; i++) {
      setPauseProgress(`Pausando anúncio ${i + 1} de ${total}...`)
      try {
        const res = await fetch("/api/meta-ads/pause-ads", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adIds: [ids[i]] }),
        })
        const data = await res.json()
        results.push(data.results?.[0] || { ad_id: ids[i], success: false })
      } catch (err) {
        results.push({ ad_id: ids[i], success: false, error: String(err) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const logEntries: PauseLogEntry[] = results.filter(r => r.success).map(r => {
      const ad = selectedAds.find(a => a.ad_id === r.ad_id)!
      return { date: new Date().toISOString(), ad_id: r.ad_id, ad_name: ad.ad_name, campaign_name: ad.campaign_name, vertical: ad.vertical, reason: generateRecommendation(ad) }
    })

    if (logEntries.length > 0) {
      savePauseLog(logEntries)
      try {
        await fetch("/api/meta-ads/slack-notify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ads: logEntries }),
        })
      } catch { /* Slack opcional */ }
    }

    const pausedIds = new Set(results.filter(r => r.success).map(r => r.ad_id))
    if (pausedIds.size > 0) setAllAds(prev => prev.map(ad => pausedIds.has(ad.ad_id) ? { ...ad, effective_status: "PAUSED" } : ad))

    setPauseProgress(`${successCount} de ${total} anúncios pausados.${results.some(r => !r.success) ? ` ${total - successCount} falharam.` : ""}`)
    setSelected(new Set())
    setTimeout(() => { setPausing(false); setPauseProgress(""); fetchData() }, 3000)
  }

  const pauseLog = useMemo(() => showLog ? getPauseLog() : [], [showLog])

  return (
    <div style={{ position: "relative" }}>
      {/* Toolbar: Filtros à esquerda, ações à direita */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {/* Status pills */}
        {([["", "Todos"], ["PAUSAR", "Pausar"], ["MONITORAR", "Monitorar"], ["MANTER", "Manter"], ["AGUARDAR", "Aguardar"]] as [string, string][]).map(([val, label]) => {
          const active = filterStatus === val
          const color = val === "PAUSAR" ? RED : val === "MONITORAR" ? AMBER : val === "MANTER" ? GREEN : T.mutedFg
          const bg = val === "PAUSAR" ? "rgba(231,0,11,0.08)" : val === "MONITORAR" ? "rgba(217,119,6,0.1)" : val === "MANTER" ? "rgba(22,163,74,0.1)" : T.cinza50
          return (
            <button key={val} onClick={() => setFilterStatus(val)} style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: `1px solid ${active ? color : T.border}`,
              background: active ? bg : T.card, color: active ? color : T.mutedFg,
              fontFamily: "inherit",
            }}>
              {label}
            </button>
          )
        })}

        {/* Separador visual */}
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 2px" }} />

        {/* Campanhas */}
        <CampaignDropdown campaigns={availableCampaigns} selected={filterCampaigns} onChange={setFilterCampaigns} />

        {/* Busca por ID */}
        <input
          type="text" value={searchId} onChange={e => setSearchId(e.target.value)}
          placeholder="Buscar por ID..."
          style={{ width: 140, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.fg, fontFamily: "monospace", outline: "none" }}
        />

        {/* Contador */}
        {!loading && <span style={{ fontSize: 12, color: T.mutedFg, paddingLeft: 4 }}>{tabAds.length} anúncios</span>}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Ações utilitárias à direita */}
        <button onClick={() => setShowLog(true)} style={{ fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Log de pausas · v4</button>
        <button onClick={() => setShowAbout(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Info size={13} /> Sobre</button>
        <button onClick={() => setShowSettings(s => !s)} style={{ display: "flex", alignItems: "center", fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Settings size={13} /></button>
        <button onClick={fetchData} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><RefreshCw size={13} /></button>
      </div>

      {/* Action bar */}
      {tabAds.length > 0 && (
        <div style={{ ...S.card, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          {pauseCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: RED }}>
              <AlertTriangle size={13} /> {pauseCount} recomendados para pausa
            </span>
          )}
          <div style={{ flex: 1 }} />
          {pauseCount > 0 && (
            <button onClick={selectAllPausar} style={{ fontSize: 12, color: T.mutedFg, background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              Selecionar recomendados
            </button>
          )}
          <button
            onClick={() => selected.size > 0 && setShowConfirm(true)}
            disabled={selected.size === 0 || pausing}
            style={{ display: "flex", alignItems: "center", gap: 6, background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: selected.size === 0 || pausing ? "not-allowed" : "pointer", opacity: selected.size === 0 || pausing ? 0.5 : 1, fontFamily: "inherit" }}
          >
            <Pause size={12} /> Pausar selecionados ({selected.size})
          </button>
        </div>
      )}

      {/* Pause progress */}
      {pausing && (
        <div style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: AMBER }} />
          <span style={{ fontSize: 12, color: T.fg }}>{pauseProgress}</span>
        </div>
      )}

      {error && <div style={{ background: "rgba(231,0,11,0.06)", border: "1px solid rgba(231,0,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: RED }}>{error}</div>}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 10 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: T.primary }} />
          <span style={{ fontSize: 13, color: T.mutedFg }}>Carregando dados...</span>
        </div>
      )}

      {/* Tabela */}
      {!loading && tabAds.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 32 }}></th>
                  <th style={S.th}>ID</th>
                  <th style={{ ...S.th, minWidth: 200 }}>Anúncio</th>
                  <th style={{ ...S.th, minWidth: 150 }}>Adset</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Dias</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Checkpoint</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Spend</th>
                  <th style={{ ...S.th, textAlign: "right" }}>MQL</th>
                  <th style={{ ...S.th, textAlign: "right" }} title="R$/MQL últimos 7 dias">R$/MQL 7d</th>
                  <th style={{ ...S.th, textAlign: "right" }} title="R$/MQL acumulado">R$/MQL acum</th>
                  <th style={{ ...S.th, textAlign: "center" }}>vs BM</th>
                  <th style={{ ...S.th, textAlign: "right" }}>SQL</th>
                  <th style={{ ...S.th, textAlign: "right" }}>R$/SQL</th>
                  <th style={{ ...S.th, textAlign: "center" }}>vs BM</th>
                  <th style={{ ...S.th, textAlign: "right" }}>OPP</th>
                  <th style={{ ...S.th, textAlign: "right" }}>R$/OPP</th>
                  <th style={{ ...S.th, textAlign: "center" }}>vs BM</th>
                  <th style={{ ...S.th, textAlign: "right" }}>WON</th>
                  <th style={{ ...S.th, textAlign: "right" }}>R$/WON</th>
                  <th style={{ ...S.th, textAlign: "center" }}>vs BM</th>
                  <th style={{ ...S.th, textAlign: "center" }}>MQL→SQL</th>
                  <th style={{ ...S.th, textAlign: "center" }}>SQL→OPP</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Score</th>
                  <th style={{ ...S.th, textAlign: "center" }}>Tendência 7d</th>
                  <th style={{ ...S.th, textAlign: "center" }}>Status</th>
                  <th style={{ ...S.th, minWidth: 200 }}>Recomendação</th>
                  <th style={{ ...S.th, textAlign: "center" }}>Impacto pausa</th>
                </tr>
              </thead>
              <tbody>
                {tabAds.map((ad, i) => {
                  const rateMqlSql = ad.mql > 0 ? ad.sql / ad.mql : 0
                  const rateSqlOpp = ad.sql > 0 ? ad.opp / ad.sql : 0
                  const impact = ad.ad_status === "PAUSAR" ? computePauseImpact(ad, tabAds) : null
                  const isSelected = selected.has(ad.ad_id)
                  const rowBg = ad.ad_status === "PAUSAR" ? "rgba(231,0,11,0.02)" : ad.ad_status === "MONITORAR" ? "rgba(217,119,6,0.015)" : i % 2 === 0 ? T.bg : T.cinza50

                  return (
                    <tr key={ad.ad_id} style={{ background: rowBg }}>
                      <td style={{ ...S.td, textAlign: "center" }}>
                        <button onClick={() => toggleSelect(ad.ad_id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg, padding: 2 }}>
                          {isSelected ? <CheckSquare size={14} style={{ color: T.primary }} /> : <Square size={14} />}
                        </button>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <CopyId id={ad.ad_id} />
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: T.mutedFg }}>{ad.ad_id.slice(-6)}</span>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{ color: T.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 200 }} title={ad.ad_name}>{ad.ad_name}</span>
                      </td>
                      <td style={{ ...S.td, color: T.mutedFg, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }} title={ad.adset_name}>{ad.adset_name}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.dias_ativos}</td>
                      <td style={{ ...S.td, textAlign: "right", fontSize: 10, color: T.mutedFg }}>{ad.checkpoint_atual}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{fmt(ad.spend)}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.mql}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.cost_per_mql > 0 ? fmt(ad.cost_per_mql) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", color: T.mutedFg }}>{ad.cost_per_mql_total && ad.cost_per_mql_total > 0 ? fmt(ad.cost_per_mql_total) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "center" }}><BenchBadge ratio={ad.benchmark_vs_mql} /></td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.sql}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.cost_per_sql > 0 ? fmt(ad.cost_per_sql) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "center" }}><BenchBadge ratio={ad.benchmark_vs_sql} /></td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.opp}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.cost_per_opp > 0 ? fmt(ad.cost_per_opp) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "center" }}><BenchBadge ratio={ad.benchmark_vs_opp} /></td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.won}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{ad.cost_per_won > 0 ? fmt(ad.cost_per_won) : "—"}</td>
                      <td style={{ ...S.td, textAlign: "center" }}><BenchBadge ratio={ad.benchmark_vs_won} /></td>
                      <td style={{ ...S.td, textAlign: "center" }}><RateBadge rate={rateMqlSql} min={0.17} /></td>
                      <td style={{ ...S.td, textAlign: "center" }}><RateBadge rate={rateSqlOpp} min={0.06} /></td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>{ad.score.toFixed(0)}</td>
                      <td style={{ ...S.td, textAlign: "center" }}><TendenciaBadge tendencia={ad.tendencia} /></td>
                      <td style={{ ...S.td, textAlign: "center" }}><StatusBadge status={ad.ad_status} /></td>
                      <td style={{ ...S.td, color: T.mutedFg, fontSize: 10, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }} title={generateRecommendation(ad)}>{generateRecommendation(ad)}</td>
                      <td style={{ ...S.td, textAlign: "center" }}>
                        {impact && (
                          <span style={{ fontSize: 10, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, color: impact.positive ? GREEN : RED }}>
                            {impact.positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {impact.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tabAds.length === 0 && !error && (
        <div style={{ ...S.card, padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
          <p style={{ fontSize: 13, color: T.mutedFg, margin: 0 }}>Nenhum anúncio ativo encontrado para {tab}</p>
        </div>
      )}

      {/* Modal de confirmação */}
      {showConfirm && (
        <>
          <div onClick={() => setShowConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, maxWidth: 520, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={15} style={{ color: RED }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.fg }}>Confirmar pausa de {selectedAds.length} anúncio{selectedAds.length > 1 ? "s" : ""}</span>
                </div>
                <button onClick={() => setShowConfirm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg }}><X size={16} /></button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedAds.map(ad => {
                  const impact = computePauseImpact(ad, tabAds)
                  return (
                    <div key={ad.ad_id} style={{ ...S.card, padding: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ad.ad_name}</p>
                      <p style={{ fontSize: 10, color: T.mutedFg, margin: "2px 0 0" }}>{ad.campaign_name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: T.mutedFg }}>Score {ad.score.toFixed(0)}</span>
                        <span style={{ fontSize: 10, color: T.mutedFg }}>{fmt(ad.spend)}</span>
                        {impact && <span style={{ fontSize: 10, fontFamily: "monospace", color: impact.positive ? GREEN : RED }}>{impact.label}</span>}
                      </div>
                      <p style={{ fontSize: 10, color: T.mutedFg, margin: "4px 0 0" }}>{generateRecommendation(ad)}</p>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "12px 16px", borderTop: `1px solid ${T.border}` }}>
                <button onClick={() => setShowConfirm(false)} style={{ fontSize: 12, color: T.mutedFg, background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                <button onClick={handlePause} style={{ display: "flex", alignItems: "center", gap: 6, background: RED, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  <Pause size={12} /> Confirmar pausa
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Painel "Sobre" */}
      {showAbout && (
        <>
          <div onClick={() => setShowAbout(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
          <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "100%", maxWidth: 560, background: T.bg, borderLeft: `1px solid ${T.border}`, zIndex: 50, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, borderBottom: `1px solid ${T.border}`, background: T.card, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Info size={15} style={{ color: T.primary }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: T.fg }}>Sobre a Otimização Diária</span>
              </div>
              <button onClick={() => setShowAbout(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

              {/* O que é */}
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>O que é?</h2>
                <p style={{ fontSize: 13, color: T.mutedFg, lineHeight: 1.6, margin: 0 }}>Ferramenta de otimização diária para pausar anúncios que estão fora dos benchmarks. Identifica rapidamente o que pausar e executa a pausa direto via Meta Ads API, com notificação automática no Slack.</p>
              </div>

              {/* Investimentos */}
              <div style={{ border: `1px solid ${T.primary}33`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: T.primary, margin: "0 0 4px" }}>Investimentos</h3>
                <p style={{ fontSize: 11, color: T.mutedFg, margin: "0 0 20px", lineHeight: 1.5 }}>Todos os benchmarks, taxas, score e lógica de média móvel foram calibrados com a base de Investimentos.</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 11, color: T.mutedFg }}>

                  {/* Base de dados */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Base de dados</p>
                    <p style={{ lineHeight: 1.6, margin: 0 }}>826 anúncios do Meta Ads cruzados com 26.511 leads do Pipedrive, cobrindo R$2,29 milhões entre janeiro/2025 e março/2026. 826 anúncios casados por ID, cobrindo 98,5% dos leads e do spend total.</p>
                  </div>

                  {/* Por que esses benchmarks */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Por que esses benchmarks</p>
                    <p style={{ lineHeight: 1.5, margin: "0 0 8px" }}>O modelo anterior usava tetos baseados em intuição. O estudo revelou dois problemas:</p>
                    <ul style={{ margin: "0 0 8px", paddingLeft: 16, lineHeight: 1.7 }}>
                      <li><span style={{ color: RED }}>R$/MQL apertado demais</span> — teto de R$136 ficava abaixo do P75 real dos anúncios que geraram vendas. Pausava 20% dos ativos, incluindo 15 que geraram 18 vendas reais.</li>
                      <li><span style={{ color: RED }}>R$/SQL e R$/OPP frouxos demais</span> — tetos 34-53% acima do P90 real, permitindo criativos ineficientes continuarem consumindo verba.</li>
                    </ul>
                    <p style={{ lineHeight: 1.5, margin: 0 }}>Os benchmarks foram definidos com base no P90 dos 81 anúncios que geraram WON e tinham pelo menos 10 MQL — o limite superior do que anúncios bons realmente custam, baseado em 151 vendas reais.</p>
                  </div>

                  {/* Benchmarks calibrados */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 8px" }}>Benchmarks calibrados</p>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                            {["Etapa","Antes","Calibrado","Variação"].map((h, hi) => (
                              <th key={h} style={{ textAlign: hi === 0 ? "left" : "right", padding: "6px 8px", color: T.mutedFg, fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: `1px solid ${T.cinza100}` }}>
                            <td style={{ padding: "5px 8px", color: T.fg }}>R$/MQL</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>R$ 136</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: GREEN }}>R$ 170</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", color: GREEN }}>+25% mais folga</td>
                          </tr>
                          <tr style={{ borderBottom: `1px solid ${T.cinza100}` }}>
                            <td style={{ padding: "5px 8px", color: T.fg }}>R$/SQL</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>R$ 834</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: RED }}>R$ 554</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", color: RED }}>-34% mais apertado</td>
                          </tr>
                          <tr style={{ borderBottom: `1px solid ${T.cinza100}` }}>
                            <td style={{ padding: "5px 8px", color: T.fg }}>R$/OPP</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>R$ 4.520</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: RED }}>R$ 2.953</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", color: RED }}>-35% mais apertado</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "5px 8px", color: T.fg }}>R$/WON</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>R$ 11.894</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>R$ 10.190 (meta) / R$ 17.784 (teto)</td>
                            <td style={{ padding: "5px 8px", textAlign: "right" }}>—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Checkpoints */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Checkpoints</p>
                    <p style={{ lineHeight: 1.5, margin: "0 0 8px" }}>A mediana de MQL→SQL na Seazone é de 1,4 dias. Os checkpoints antecipam as decisões para quando os dados já são confiáveis:</p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          {["#","Dia","O que avalia"].map((h, hi) => (
                            <th key={h} style={{ textAlign: hi === 1 ? "right" : "left", padding: "5px 8px", color: T.mutedFg, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[["1º","Day 3","R$/MQL + taxa MQL→SQL ≥ 17%"],["2º","Day 7","R$/SQL + taxa SQL→OPP ≥ 6%"],["3º","Day 15","R$/OPP"],["4º","Day 35","R$/WON vs meta de R$10.190"]].map(([n,d,o]) => (
                          <tr key={n} style={{ borderBottom: `1px solid ${T.cinza100}` }}>
                            <td style={{ padding: "5px 8px", color: T.fg }}>{n}</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace" }}>{d}</td>
                            <td style={{ padding: "5px 8px" }}>{o}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Janelas */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Janelas de avaliação (média móvel)</p>
                    <p style={{ lineHeight: 1.5, margin: "0 0 8px" }}>Os custos não são calculados sobre o histórico completo — cada métrica usa uma janela proporcional ao seu ciclo de conversão:</p>
                    {[
                      ["MQL — 7 dias","rolling 7d",T.primary,"7 dias é o período de otimização do algoritmo do Meta. Quando a gente mexe em algo e reseta a aprendizagem, o algoritmo tem 7 dias para corrigir — então avaliar MQL nessa janela reflete a performance real após o ajuste."],
                      ["SQL — 14 dias","rolling 14d",T.primary,"Dobro da janela de MQL. Captura o ciclo MQL→SQL completo com folga estatística suficiente — 14 dias dá volume amostral sem perder sensibilidade a mudanças recentes."],
                      ["OPP e WON — acumulado","histórico completo",T.mutedFg,"Conversões raras demais para janela curta. Um ad com 1 OPP gerado há 10 dias perderia esse sinal em uma janela de 7d. OPP e WON sempre usam todo o histórico disponível (35 dias)."],
                    ].map(([t,badge,badgeColor,d]) => (
                      <div key={t} style={{ background: T.cinza50, borderRadius: 8, padding: 10, border: `1px solid ${T.border}`, marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: T.fg }}>{t}</span>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: badgeColor }}>{badge}</span>
                        </div>
                        <p style={{ fontSize: 11, color: T.mutedFg, margin: 0, lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                    <p style={{ lineHeight: 1.5, margin: "8px 0 0", fontSize: 11 }}>A coluna <span style={{ color: T.fg }}>R$/MQL 7d</span> é o valor usado para score e status. A coluna <span style={{ color: T.fg }}>R$/MQL acum</span> é referência — permite ver se o custo recente está acima ou abaixo da média histórica do anúncio.</p>
                  </div>

                  {/* Taxas mínimas */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Taxas mínimas de conversão</p>
                    <p style={{ lineHeight: 1.5, margin: "0 0 8px" }}>Definidas com base no P50 dos anúncios que geraram vendas na base de Investimentos. Aplicadas a todas as verticais.</p>
                    {[["MQL → SQL","≥ 17%"],["SQL → OPP","≥ 6%"]].map(([label, val]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bg, borderRadius: 6, padding: "6px 10px", border: `1px solid ${T.border}`, marginBottom: 4 }}>
                        <span>{label}</span>
                        <span style={{ fontFamily: "monospace", color: T.fg }}>{val}</span>
                      </div>
                    ))}
                    <p style={{ lineHeight: 1.5, margin: "6px 0 0", fontSize: 11 }}>Abaixo de 17% MQL→SQL indica problema de qualificação. Abaixo de 6% SQL→OPP indica problema na reunião ou proposta.</p>
                  </div>

                  {/* Lógica de decisão por checkpoint */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Lógica de decisão por checkpoint</p>
                    <p style={{ lineHeight: 1.5, margin: "0 0 8px" }}>Cada checkpoint tem uma regra diferente — o modelo fica mais exigente conforme o anúncio avança no tempo sem provar resultado:</p>
                    {[
                      { title: "Antes do Day 3 — alerta antecipado", body: "Normalmente retorna AGUARDAR. Exceção: se custo/MQL já estiver acima de 3× o benchmark com pelo menos R$100 investidos, o anúncio recebe MONITORAR. Para Investimentos: benchmark R$170, então o alerta dispara acima de R$510 de custo/MQL.", rules: [["Custo/MQL normal","AGUARDAR",T.mutedFg],["Custo/MQL > 3× bench + spend ≥ R$100","MONITORAR",AMBER]] },
                      { title: "Day 3 — checkpoint MQL", body: "Avalia custo/MQL E taxa MQL→SQL:", rules: [["Ambos ok","MANTER",GREEN],["Só um ruim","MONITORAR",AMBER],["Ambos ruins","PAUSAR",RED],["Sem MQL após Day 3","PAUSAR",RED]] },
                      { title: "Day 7 — checkpoint SQL", body: "Avalia custo/SQL E taxa SQL→OPP. Se custo/SQL alto com taxa boa, verifica o custo/MQL implícito: custo/SQL = custo/MQL ÷ taxa MQL→SQL. Taxa boa + custo/SQL alto = custo/MQL também alto.", rules: [["Ambos ok","MANTER",GREEN],["Ambos ruins","PAUSAR",RED],["Custo alto + taxa boa + custo/MQL > bench","PAUSAR",RED],["Custo ok + taxa ruim","MONITORAR",AMBER],["Sem SQL após Day 7","PAUSAR",RED]] },
                      { title: "Day 15 — checkpoint OPP", body: "Não há mais benefício da dúvida — já passou dois checkpoints. Se qualquer métrica estiver fora, é sinal claro de problema no funil.", rules: [["Ambos ok","MANTER",GREEN],["Qualquer um ruim","PAUSAR",RED],["Sem OPP após Day 15","PAUSAR",RED]] },
                      { title: "Day 35 — checkpoint WON", body: "Avalia custo/WON sobre histórico completo (35 dias).", rules: [["Custo/WON < R$10.190","MANTER",GREEN],["Entre R$10.190 e R$17.784","MONITORAR",AMBER],["Acima de R$17.784","PAUSAR",RED]] },
                    ].map(item => (
                      <div key={item.title} style={{ background: T.bg, borderRadius: 8, padding: 10, border: `1px solid ${T.border}`, marginBottom: 6 }}>
                        <p style={{ fontSize: 11, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: T.mutedFg, margin: "0 0 6px", lineHeight: 1.5 }}>{item.body}</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 8 }}>
                          {item.rules.map(([cond, result, color]) => (
                            <p key={cond} style={{ fontSize: 10, color: T.mutedFg, margin: 0 }}>
                              <span style={{ color: T.mutedFg }}>{cond}</span> → <span style={{ color, fontWeight: 500 }}>{result}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: 10, color: T.mutedFg, margin: "6px 0 0", lineHeight: 1.5 }}>Na simulação com dados de Investimentos: o modelo bidirecional pausou apenas 6 anúncios (1,6%) sem perder nenhuma venda. O modelo anterior pausaria 74 anúncios e perderia 18 vendas.</p>
                  </div>

                  {/* Tendência */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Tendência 7d</p>
                    <p style={{ lineHeight: 1.5, margin: "0 0 8px" }}>Compara o R$/MQL dos últimos 7 dias com o R$/MQL dos 7 dias anteriores (dias 8-14):</p>
                    {[["MELHORANDO",GREEN,"custo atual mais de 15% menor que semana anterior"],["ESTÁVEL",T.mutedFg,"variação dentro de ±15%/20%"],["DEGRADANDO",RED,"custo atual mais de 20% acima da semana anterior"]].map(([s,c,d]) => (
                      <div key={s} style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: c, flexShrink: 0 }}>{s}</span>
                        <span style={{ fontSize: 11 }}>— {d}</span>
                      </div>
                    ))}
                    <p style={{ fontSize: 11, color: T.mutedFg, lineHeight: 1.5, margin: "6px 0 0" }}>A tendência cruza com o status: PAUSAR + MELHORANDO vira MONITORAR. MANTER + DEGRADANDO vira MONITORAR.</p>
                  </div>

                  {/* Score */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 4px" }}>Como o score é calculado</p>
                    <p style={{ lineHeight: 1.5, margin: "0 0 8px" }}>Score hierárquico em camadas — a camada mais alta em que o anúncio se enquadra define a base de pontos:</p>
                    {[
                      ["WON","1000+ pts",GREEN,"Base 1000 + até 400 pts pelo custo/WON (interpolado entre R$10.190 e R$17.784) + taxa WON/OPP × 200 + bônus de velocidade (max 200 pts)."],
                      ["OPP","0–450 pts",T.primary,"Até 300 pts pelo custo/OPP (interpolado entre R$2.953 e R$4.520) + taxa OPP/SQL × 150 + bônus de velocidade (max 100 pts)."],
                      ["SQL","0–300 pts",AMBER,"Até 200 pts pelo custo/SQL (interpolado entre R$554 e R$834) + taxa SQL/MQL × 100 + bônus de velocidade (max 50 pts)."],
                      ["MQL","0–125 pts",T.mutedFg,"Até 100 pts pelo custo/MQL (interpolado entre R$170 e R$200) + bônus de velocidade (max 25 pts)."],
                    ].map(([tier, pts, color, desc]) => (
                      <div key={tier} style={{ background: T.cinza50, borderRadius: 8, padding: 10, border: `1px solid ${T.border}`, marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: T.fg }}>{tier}</span>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color }}>{pts}</span>
                        </div>
                        <p style={{ fontSize: 11, color: T.mutedFg, margin: 0, lineHeight: 1.5 }}>{desc}</p>
                      </div>
                    ))}
                    <p style={{ fontSize: 11, color: T.mutedFg, lineHeight: 1.5, margin: "6px 0 0" }}><span style={{ color: T.fg }}>Bônus de velocidade:</span> converter antes do checkpoint esperado vale pontos extras.</p>
                    <p style={{ fontSize: 11, color: T.mutedFg, lineHeight: 1.5, margin: "4px 0 0" }}><span style={{ color: T.fg }}>Fator de confiança:</span> spend abaixo de R$200 aplica fator 0,05. Acima de R$1.000 aplica 1,0. MQL abaixo de 5 aplica fator adicional de 0,4 — evita anúncios novos com 1 MQL barato dispararem no ranking.</p>
                  </div>

                </div>
              </div>

              {/* Lógica geral */}
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: T.fg, margin: "0 0 12px" }}>Lógica de avaliação</h2>
                <div style={{ fontSize: 11, color: T.mutedFg, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[["PAUSAR",RED,"Custo acima do benchmark E taxa abaixo do mínimo. Os dois critérios ruins ao mesmo tempo."],["MONITORAR",AMBER,"Apenas um dos critérios está fora (custo OU taxa) — ou anúncio em degradação recente. Acompanhar, não pausar ainda."],["MANTER",GREEN,"Custo dentro do benchmark e taxa acima do mínimo."],["AGUARDAR",T.mutedFg,"Anúncio com menos dias do que o primeiro checkpoint. Sem dados suficientes para avaliar."]].map(([s,c,d]) => (
                    <p key={s} style={{ margin: 0 }}><span style={{ fontWeight: 600, color: c }}>{s}:</span> <span>{d}</span></p>
                  ))}
                </div>
              </div>

              {/* Impacto da pausa */}
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>Impacto da pausa</h2>
                <p style={{ fontSize: 11, color: T.mutedFg, lineHeight: 1.6, margin: 0 }}>Calcula a redistribuição de verba no adset: compara o custo/MQL do anúncio a ser pausado com a média dos outros ativos no mesmo adset. Se o anúncio tem custo/MQL acima da média, pausar libera verba para os mais eficientes.</p>
              </div>

              {/* Fluxo */}
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>Fluxo recomendado</h2>
                <ol style={{ fontSize: 11, color: T.mutedFg, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
                  <li>Abra a aba diariamente de manhã</li>
                  <li>Use o filtro "Pausar" (já ativo por padrão)</li>
                  <li>Clique em "Selecionar recomendados" para marcar todos</li>
                  <li>Revise a lista e o impacto no modal de confirmação</li>
                  <li>Confirme a pausa — notificação vai automaticamente pro Slack</li>
                  <li>Consulte o Log de Pausas para histórico</li>
                </ol>
              </div>

              <p style={{ fontSize: 10, color: T.cinza300, textAlign: "center" }}>Otimização Diária v2.0 — Seazone</p>
            </div>
          </div>
        </>
      )}

      {/* Log de pausas */}
      {showLog && (
        <>
          <div onClick={() => setShowLog(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
          <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "100%", maxWidth: 440, background: T.bg, borderLeft: `1px solid ${T.border}`, zIndex: 50, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56, borderBottom: `1px solid ${T.border}`, background: T.card }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.fg }}>Log de Pausas</span>
              <button onClick={() => setShowLog(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {pauseLog.length === 0 && <p style={{ fontSize: 12, color: T.mutedFg, textAlign: "center", padding: "48px 20px" }}>Nenhuma pausa registrada.</p>}
              {pauseLog.map((entry, i) => (
                <div key={i} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.ad_name}</p>
                    <span style={{ fontSize: 10, color: T.mutedFg, flexShrink: 0 }}>
                      {new Date(entry.date).toLocaleDateString("pt-BR")} {new Date(entry.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: T.mutedFg, margin: "0 0 2px" }}>{entry.campaign_name}</p>
                  <p style={{ fontSize: 10, color: T.mutedFg, fontFamily: "monospace", margin: "0 0 4px" }}>{entry.ad_id}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(0,85,255,0.08)", color: T.primary, border: `1px solid rgba(0,85,255,0.2)` }}>{entry.vertical}</span>
                    <span style={{ fontSize: 10, color: RED }}>{entry.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div style={{ ...S.card, marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: T.mutedFg, display: "block", marginBottom: 4 }}>Meta Ads Token (opcional — usa env var por padrão)</label>
          <input type="password" placeholder="EAABsbCS..." style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: T.fg, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
