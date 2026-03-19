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

const VERTICALS = ["Investimentos", "Serviços", "Marketplace"]

export function OtimizacaoView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [allAds, setAllAds] = useState<AdPerformance[]>([])
  const [tab, setTab] = useState("Investimentos")
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
      const res = await fetch("/api/meta-ads/nekt?window=35")
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

      const perf = computePerformanceRolling(rows)

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
              if (statuses[ad.ad_id]) ad.effective_status = statuses[ad.ad_id]
              else ad.effective_status = "UNKNOWN"
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
    if (searchId.trim()) return allAds.filter(a => a.ad_id.includes(searchId.trim()) && a.effective_status === "ACTIVE")
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
      {/* Toolbar: Tabs + Filtros + Busca */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {VERTICALS.map(v => (
          <button
            key={v}
            onClick={() => { setTab(v); setSelected(new Set()); setFilterCampaigns(new Set()) }}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: `1px solid ${tab === v ? T.primary : T.border}`,
              background: tab === v ? T.primary : T.card,
              color: tab === v ? "#fff" : T.mutedFg,
              fontFamily: "inherit",
            }}
          >
            {v}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {!loading && <span style={{ fontSize: 12, color: T.mutedFg }}>{tabAds.length} anúncios</span>}
        <input
          type="text" value={searchId} onChange={e => setSearchId(e.target.value)}
          placeholder="Buscar por ID..."
          style={{ width: 140, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.fg, fontFamily: "monospace", outline: "none" }}
        />
        <button onClick={() => setShowLog(true)} style={{ fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Log de pausas</button>
        <button onClick={() => setShowAbout(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Info size={13} /> Sobre</button>
        <button onClick={() => setShowSettings(s => !s)} style={{ display: "flex", alignItems: "center", fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Settings size={13} /></button>
        <button onClick={fetchData} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.mutedFg, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><RefreshCw size={13} /></button>
      </div>

      {/* Filtros de status e campanha */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
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
        <div style={{ flex: 1 }} />
        <CampaignDropdown campaigns={availableCampaigns} selected={filterCampaigns} onChange={setFilterCampaigns} />
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
                      <td style={{ ...S.td, color: T.mutedFg, fontSize: 10, maxWidth: 250 }}>{generateRecommendation(ad)}</td>
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
          <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "100%", maxWidth: 520, background: T.bg, borderLeft: `1px solid ${T.border}`, zIndex: 50, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56, borderBottom: `1px solid ${T.border}`, background: T.card }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Info size={15} style={{ color: T.primary }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: T.fg }}>Sobre a Otimização Diária</span>
              </div>
              <button onClick={() => setShowAbout(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px" }}>
              <p style={{ fontSize: 13, color: T.mutedFg, lineHeight: 1.6, margin: "0 0 20px" }}>Ferramenta de otimização diária para pausar anúncios fora dos benchmarks. Identifica o que pausar e executa via Meta Ads API, com notificação automática no Slack.</p>

              <div style={{ border: `1px solid ${T.primary}33`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.primary, margin: "0 0 12px" }}>Benchmarks (Investimentos)</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead><tr>{["Etapa","Benchmark"].map(h => <th key={h} style={{ textAlign: h === "Benchmark" ? "right" : "left", padding: "4px 8px", color: T.mutedFg, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[["R$/MQL","R$ 170"],["R$/SQL","R$ 554"],["R$/OPP","R$ 2.953"],["R$/WON","R$ 10.190"]].map(([e,v]) => (
                      <tr key={e}><td style={{ padding: "4px 8px", color: T.fg, borderBottom: `1px solid ${T.cinza100}` }}>{e}</td><td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", color: T.fg, borderBottom: `1px solid ${T.cinza100}` }}>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>Checkpoints</h3>
                <p style={{ fontSize: 12, color: T.mutedFg, margin: "0 0 8px", lineHeight: 1.5 }}>Day 3 (MQL) → Day 7 (SQL) → Day 15 (OPP) → Day 35 (WON)</p>
                <p style={{ fontSize: 11, color: T.mutedFg, margin: 0, lineHeight: 1.5 }}>Marketplace e SZS: Day 7 → Day 25 → Day 35 → Day 50</p>
              </div>

              <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>Janelas de avaliação</h3>
                {[["MQL — 7 dias","Período de otimização do algoritmo do Meta. Janela mais sensível à performance recente."],["SQL — 14 dias","Cobre 1 ciclo MQL→SQL completo com folga estatística suficiente."],["OPP e WON — acumulado","Conversões raras demais para janela curta. Sempre usa todo o histórico (35 dias)."]].map(([t,d]) => (
                  <div key={t} style={{ background: T.cinza50, borderRadius: 8, padding: 10, border: `1px solid ${T.border}`, marginBottom: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: T.fg, margin: "0 0 3px" }}>{t}</p>
                    <p style={{ fontSize: 11, color: T.mutedFg, margin: 0, lineHeight: 1.5 }}>{d}</p>
                  </div>
                ))}
              </div>

              <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>Lógica de status</h3>
                {[["PAUSAR",RED,"Custo acima do benchmark E taxa abaixo do mínimo (dois critérios ruins ao mesmo tempo)."],["MONITORAR",AMBER,"Apenas um critério fora — ou anúncio em degradação recente. Acompanhar."],["MANTER",GREEN,"Custo dentro do benchmark e taxa acima do mínimo."],["AGUARDAR",T.mutedFg,"Menos dias do que o primeiro checkpoint. Sem dados suficientes."]].map(([s,c,d]) => (
                  <div key={s} style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c }}>{s}:</span>
                    <span style={{ fontSize: 11, color: T.mutedFg, marginLeft: 6 }}>{d}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 10, color: T.cinza300, textAlign: "center", marginTop: 16 }}>Otimização Diária v2.0 — Seazone</p>
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
