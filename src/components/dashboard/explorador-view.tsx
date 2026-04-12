"use client"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Search, Download, ChevronLeft, ChevronRight, Database, Loader2, X, RefreshCw } from "lucide-react"
import { T } from "@/lib/constants"

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })

const NUMERIC_COLS = new Set(["impressions", "reach", "clicks", "frequency", "dias_ativos", "lead", "ctr", "mql", "sql", "opp", "won", "spend"])
const CURRENCY_COLS = new Set(["spend"])
const PAGE_SIZE = 50

type Row = Record<string, string | number | null>

const S = {
  card: {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 10,
    color: T.mutedFg,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: 4,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    color: T.fg,
    outline: "none",
    fontFamily: "inherit",
  },
  select: {
    width: "100%",
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    color: T.fg,
    outline: "none",
    appearance: "none" as const,
    fontFamily: "inherit",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: T.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnOutline: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    color: T.mutedFg,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    fontSize: 10,
    color: T.mutedFg,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    whiteSpace: "nowrap" as const,
    background: T.cinza50,
    borderBottom: `1px solid ${T.border}`,
  },
  td: {
    padding: "7px 10px",
    fontSize: 11,
    color: T.fg,
    whiteSpace: "nowrap" as const,
    borderBottom: `1px solid ${T.cinza100}`,
  },
}

function SearchableSelect({ options, value, onChange, placeholder }: {
  options: string[]; value: string; onChange: (v: string) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {value && !open ? (
        <div
          onClick={() => { setOpen(true); setQuery("") }}
          style={{ ...S.input, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
          title={value}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
          <button
            onClick={e => { e.stopPropagation(); onChange(""); setQuery("") }}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg, display: "flex", padding: 0 }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.mutedFg, pointerEvents: "none" }} />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            style={{ ...S.input, paddingLeft: 28 }}
          />
        </div>
      )}
      {open && (
        <div style={{
          position: "absolute", zIndex: 20, marginTop: 4, width: "100%",
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto",
        }}>
          {filtered.length === 0 ? (
            <p style={{ padding: "8px 12px", fontSize: 11, color: T.mutedFg }}>Nenhum resultado</p>
          ) : filtered.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); setQuery("") }}
              style={{
                width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 11,
                cursor: "pointer", background: "none", border: "none",
                color: opt === value ? T.primary : T.fg,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}
              title={opt}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const MODULE_VERTICAL: Record<string, string> = { szi: "Investimentos", mktp: "Marketplace", szs: "SZS" }

export function ExploradorView({ moduleId = "szi" }: { moduleId?: string }) {
  const [vertical, setVertical] = useState(MODULE_VERTICAL[moduleId] || "")
  const [campaignName, setCampaignName] = useState("")
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [page, setPage] = useState(0)

  const campaigns = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const camp = r.campaign_name
      if (!camp) continue
      if (vertical && r.vertical !== vertical) continue
      set.add(String(camp))
    }
    return [...set].sort()
  }, [rows, vertical])

  const filteredRows = useMemo(() => {
    if (!campaignName) return rows
    return rows.filter(r => r.campaign_name === campaignName)
  }, [rows, campaignName])

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE)
  const pageRows = useMemo(() => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filteredRows, page])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    setPage(0)
    try {
      const params = new URLSearchParams()
      if (vertical) params.set("vertical", vertical)
      if (status) params.set("status", status)
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const res = await fetch(`/api/meta-ads/nekt?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao buscar dados")
      }
      const data = await res.json()
      setColumns(data.columns || [])
      setRows(data.rows || [])
    } catch (err) {
      setError(String(err))
      setRows([])
      setColumns([])
    } finally {
      setLoading(false)
    }
  }, [vertical, status, dateFrom, dateTo])

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = () => {
    if (columns.length === 0 || filteredRows.length === 0) return
    const header = columns.join(",")
    const lines = filteredRows.map(row =>
      columns.map(col => {
        const val = row[col]
        if (val === null || val === undefined) return ""
        const str = String(val)
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(",")
    )
    const csv = [header, ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `nekt_export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCell = (col: string, val: string | number | null) => {
    if (val === null || val === undefined) return "—"
    if (CURRENCY_COLS.has(col) && typeof val === "number") return fmt(val)
    if (NUMERIC_COLS.has(col) && typeof val === "number") return fmtNum(val)
    return String(val)
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.label}>Vertical</label>
            <select value={vertical} onChange={e => setVertical(e.target.value)} style={S.select}>
              <option value="">Todas</option>
              <option value="Investimentos">Investimentos</option>
              <option value="Marketplace">Marketplace</option>
              <option value="SZS">SZS</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Campanha</label>
            <SearchableSelect
              options={campaigns}
              value={campaignName}
              onChange={v => { setCampaignName(v); setPage(0) }}
              placeholder="Buscar campanha..."
            />
          </div>
          <div>
            <label style={S.label}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={S.select}>
              <option value="">Todos</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="CAMPAIGN_PAUSED">CAMPAIGN_PAUSED</option>
              <option value="ADSET_PAUSED">ADSET_PAUSED</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Data início</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Data fim</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={S.input} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={fetchData} disabled={loading} style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={13} />}
            {loading ? "Buscando..." : "Atualizar dados"}
          </button>
          {filteredRows.length > 0 && (
            <button onClick={exportCSV} style={S.btnOutline}>
              <Download size={13} /> Exportar CSV
            </button>
          )}
          {filteredRows.length > 0 && (
            <span style={{ fontSize: 12, color: T.mutedFg, marginLeft: 4 }}>
              {filteredRows.length.toLocaleString("pt-BR")} registros
              {campaignName ? ` (${rows.length.toLocaleString("pt-BR")} total)` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div style={{ background: "rgba(231,0,11,0.06)", border: "1px solid rgba(231,0,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: T.destructive }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 10 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: T.primary }} />
          <span style={{ fontSize: 13, color: T.mutedFg }}>Carregando dados Nekt...</span>
        </div>
      )}

      {/* Tabela */}
      {!loading && columns.length > 0 && filteredRows.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col} style={S.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? T.bg : T.cinza50 }}>
                    {columns.map(col => (
                      <td key={col} style={{ ...S.td, textAlign: NUMERIC_COLS.has(col) ? "right" : "left", fontFamily: NUMERIC_COLS.has(col) ? "monospace" : "inherit" }}>
                        {formatCell(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 11, color: T.mutedFg }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} de {filteredRows.length.toLocaleString("pt-BR")}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ padding: 6, borderRadius: 6, border: `1px solid ${T.border}`, background: "none", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1, color: T.fg }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, color: T.mutedFg, padding: "0 8px" }}>{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{ padding: 6, borderRadius: 6, border: `1px solid ${T.border}`, background: "none", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", opacity: page >= totalPages - 1 ? 0.4 : 1, color: T.fg }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredRows.length === 0 && !error && (
        <div style={{ ...S.card, padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
          <Database size={28} style={{ color: T.cinza300 }} />
          <p style={{ fontSize: 13, color: T.mutedFg, margin: 0 }}>Nenhum dado encontrado</p>
          <p style={{ fontSize: 11, color: T.cinza300, margin: 0 }}>Dados dos últimos 90 dias por padrão</p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
