"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/constants";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface CanalMeta {
  canal: string;
  meta: number;
  realizado: number;
  esperadoMTD: number;
  forecast: number;
  desvio: number;
  pctMeta: number;
}

interface SubRegiao {
  subregiao: string;
  meta: number;
  realizado: number;
  esperadoMTD: number;
  forecast: number;
  desvio: number;
  pctMeta: number;
}

interface PipelineForecast {
  wonCount: number;
  advancedOppCount: number;
  advancedOppValue: number;
  earlyOppCount: number;
  earlyOppValue: number;
  forecastTotal: number;
  advancedConversion: number;
  earlyConversion: number;
  leadtimeMedio: number;
}

interface WonDeal {
  dealId: number;
  title: string;
  owner: string;
  wonTime: string;
  value: number;
  canal: string;
  empreendimento: string;
}

interface ProbableDeal {
  dealId: number;
  title: string;
  owner: string;
  stage: string;
  value: number;
  canal: string;
  conversion: number;
}

interface MetasData {
  pipeline: string;
  ano: number;
  mes: number;
  mesNome: string;
  diasUteisTotal: number;
  diasUteisPassados: number;
  isCurrentMonth: boolean;
  resumo: {
    metaTotal: number;
    realizadoTotal: number;
    esperadoMTD: number;
    forecast: number;
    desvio: number;
    pctMeta: number;
  };
  canais: CanalMeta[];
  subregioes: SubRegiao[] | null;
  pipelineForecast: PipelineForecast | null;
  wonDeals: WonDeal[];
  probableDeals: ProbableDeal[];
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = [
  { num: 1, label: "Jan" },
  { num: 2, label: "Fev" },
  { num: 3, label: "Mar" },
  { num: 4, label: "Abr" },
  { num: 5, label: "Mai" },
  { num: 6, label: "Jun" },
  { num: 7, label: "Jul" },
  { num: 8, label: "Ago" },
  { num: 9, label: "Set" },
  { num: 10, label: "Out" },
  { num: 11, label: "Nov" },
  { num: 12, label: "Dez" },
];

function formatDesvio(val: number): string {
  if (val > 0) return `+${val}`;
  return String(val);
}

// ─── Barra de Progresso ───────────────────────────────────────────────────────

function ProgressBar({
  realizado,
  meta,
  esperadoMTD,
}: {
  realizado: number;
  meta: number;
  esperadoMTD: number;
}) {
  if (meta === 0) return null;

  const pctRealizado = Math.min(100, Math.round((realizado / meta) * 100));
  const pctEsperado = Math.min(100, Math.round((esperadoMTD / meta) * 100));
  const isAhead = realizado >= esperadoMTD;
  const barColor = isAhead ? T.verde600 : "#F87171";

  return (
    <div
      style={{
        backgroundColor: T.bg,
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        boxShadow: T.elevSm,
        padding: "16px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          fontSize: 12,
          color: T.mutedFg,
        }}
      >
        <span>Progresso do Mes</span>
        <span style={{ fontFamily: "monospace" }}>
          {realizado} / {meta}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 20,
          backgroundColor: T.cinza100,
          borderRadius: 9999,
          overflow: "visible",
        }}
      >
        {/* Barra realizado */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: 20,
            borderRadius: 9999,
            transition: "all 0.3s",
            backgroundColor: barColor,
            width: `${pctRealizado}%`,
          }}
        />
        {/* Marcador esperado MTD */}
        {pctEsperado > 0 && pctEsperado <= 100 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              height: 20,
              width: 2,
              backgroundColor: T.fg,
              zIndex: 10,
              left: `${pctEsperado}%`,
            }}
            title={`Esperado MTD: ${esperadoMTD}`}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
          color: T.cinza200,
        }}
      >
        <span>0</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: 12,
              backgroundColor: T.fg,
            }}
          />
          Esperado MTD: {esperadoMTD} ({pctEsperado}%)
        </span>
        <span>Meta: {meta}</span>
      </div>
    </div>
  );
}

// ─── Tabela de Canais ─────────────────────────────────────────────────────────

function TabelaCanais({
  canais,
  titulo,
}: {
  canais: CanalMeta[] | SubRegiao[];
  titulo: string;
}) {
  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "right",
    fontWeight: 500,
    fontSize: 11,
    color: T.mutedFg,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const tdBase: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "right",
    fontFamily: "monospace",
    fontSize: 13,
    borderBottom: `1px solid ${T.cinza100}`,
  };

  return (
    <div
      style={{
        backgroundColor: T.bg,
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        boxShadow: T.elevSm,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <h3 style={{ fontWeight: 600, fontSize: 13, color: T.fg }}>{titulo}</h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: T.cinza50 }}>
              <th style={{ ...thStyle, textAlign: "left" }}>CANAL</th>
              <th style={thStyle}>META</th>
              <th style={thStyle}>REALIZADO</th>
              <th style={thStyle}>ESPERADO</th>
              <th style={thStyle}>DESVIO</th>
              <th style={thStyle}>%</th>
            </tr>
          </thead>
          <tbody>
            {canais.map((row) => {
              const nome = "canal" in row ? row.canal : (row as SubRegiao).subregiao;
              const isPositive = row.desvio >= 0;
              const desvioColor = isPositive ? T.verde700 : T.destructive;
              return (
                <tr key={nome}>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: "left",
                      fontWeight: 500,
                      color: T.fg,
                      fontFamily: "inherit",
                    }}
                  >
                    {nome}
                  </td>
                  <td style={{ ...tdBase, color: T.cinza700 }}>{row.meta}</td>
                  <td style={{ ...tdBase, fontWeight: 600, color: T.fg }}>
                    {row.realizado}
                  </td>
                  <td style={{ ...tdBase, color: T.mutedFg }}>{row.esperadoMTD}</td>
                  <td style={{ ...tdBase, fontWeight: 600, color: desvioColor }}>
                    {formatDesvio(row.desvio)}
                  </td>
                  <td style={{ ...tdBase, color: desvioColor }}>{row.pctMeta}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Forecast de Pipeline ─────────────────────────────────────────────────

function ForecastPipeline({
  forecast,
  metaTotal,
}: {
  forecast: PipelineForecast;
  metaTotal: number;
}) {
  const pctMeta =
    metaTotal > 0 ? Math.round((forecast.forecastTotal / metaTotal) * 100) : 0;

  let bgColor: string;
  let borderColor: string;
  let textColor: string;
  let headerColor: string;

  if (pctMeta >= 100) {
    bgColor = T.verde50;
    borderColor = "#BBF7D0";
    textColor = T.verde700;
    headerColor = "#166534";
  } else if (pctMeta >= 80) {
    bgColor = "#FFF7ED";
    borderColor = "#FED7AA";
    textColor = T.laranja500;
    headerColor = "#9A3412";
  } else {
    bgColor = T.vermelho50;
    borderColor = T.vermelho100;
    textColor = T.destructive;
    headerColor = "#991B1B";
  }

  const cellStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 4,
    padding: "8px 12px",
    flex: "1 1 0",
  };

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        boxShadow: T.elevSm,
        padding: 20,
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontWeight: 600, fontSize: 13, color: headerColor }}>
          Forecast de Pipeline
        </h3>
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            fontFamily: "monospace",
            color: headerColor,
          }}
        >
          {forecast.forecastTotal}
          <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>
            / {metaTotal}
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
            ({pctMeta}%)
          </span>
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
        <div style={cellStyle}>
          <div style={{ color: T.mutedFg, marginBottom: 2 }}>WON no mes</div>
          <div
            style={{
              fontFamily: "monospace",
              fontWeight: 700,
              color: T.fg,
              fontSize: 18,
            }}
          >
            {forecast.wonCount}
          </div>
        </div>
        <div style={cellStyle}>
          <div style={{ color: T.mutedFg, marginBottom: 2 }}>
            OPP Avancado
            <span style={{ fontSize: 10, marginLeft: 4 }}>
              ({Math.round(forecast.advancedConversion * 100)}% conv.)
            </span>
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontWeight: 700,
              color: T.fg,
              fontSize: 18,
            }}
          >
            {forecast.advancedOppCount}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: T.mutedFg,
                marginLeft: 4,
              }}
            >
              = +{Math.round(forecast.advancedOppCount * forecast.advancedConversion)}
            </span>
          </div>
        </div>
        <div style={cellStyle}>
          <div style={{ color: T.mutedFg, marginBottom: 2 }}>
            OPP Inicial
            <span style={{ fontSize: 10, marginLeft: 4 }}>
              ({Math.round(forecast.earlyConversion * 100)}% conv.)
            </span>
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontWeight: 700,
              color: T.fg,
              fontSize: 18,
            }}
          >
            {forecast.earlyOppCount}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: T.mutedFg,
                marginLeft: 4,
              }}
            >
              = +{Math.round(forecast.earlyOppCount * forecast.earlyConversion)}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          marginTop: 8,
          opacity: 0.7,
        }}
      >
        <span>
          Forecast = WON + (OPP avancado x{" "}
          {Math.round(forecast.advancedConversion * 100)}%) + (OPP inicial x{" "}
          {Math.round(forecast.earlyConversion * 100)}%)
        </span>
        <span style={{ fontWeight: 500 }}>
          Leadtime medio: {forecast.leadtimeMedio} dias
        </span>
      </div>
    </div>
  );
}

// ─── Lista de Deals Colapsavel ─────────────────────────────────────────────

function DealsColapsavel({
  titulo,
  icon,
  deals,
  col1Label,
  col2Label,
  col3Label,
}: {
  titulo: string;
  icon: string;
  deals: {
    dealId: number;
    title: string;
    col1: string;
    col2: string;
    col3: string;
  }[];
  col1Label: string;
  col2Label: string;
  col3Label: string;
}) {
  const [open, setOpen] = useState(false);

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontWeight: 500,
    fontSize: 11,
    color: T.mutedFg,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const tdBase: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 12,
    borderBottom: `1px solid ${T.cinza100}`,
  };

  return (
    <div
      style={{
        backgroundColor: T.bg,
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        boxShadow: T.elevSm,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = T.cinza50)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: T.fg,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{icon}</span>
          {titulo}
        </span>
        <span style={{ color: T.cinza200, fontSize: 12 }}>
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {open && (
        <div
          style={{
            overflowX: "auto",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <table
            style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}
          >
            <thead>
              <tr style={{ backgroundColor: T.cinza50 }}>
                <th style={thStyle}>DEAL</th>
                <th style={thStyle}>{col1Label}</th>
                <th style={{ ...thStyle, textAlign: "center" }}>{col2Label}</th>
                <th style={{ ...thStyle, textAlign: "center" }}>{col3Label}</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.dealId}>
                  <td style={tdBase}>
                    <a
                      href={`https://seazone-fd92b9.pipedrive.com/deal/${d.dealId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: T.primary,
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.textDecoration = "underline")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.textDecoration = "none")
                      }
                    >
                      {d.title}
                    </a>
                  </td>
                  <td style={{ ...tdBase, color: T.cinza700 }}>{d.col1}</td>
                  <td style={{ ...tdBase, textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        backgroundColor: T.cinza100,
                        color: T.cinza600,
                        fontSize: 10,
                        fontWeight: 500,
                      }}
                    >
                      {d.col2}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: "center",
                      fontFamily: "monospace",
                      color: T.cinza700,
                    }}
                  >
                    {d.col3}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function SquadMetasView({
  pipelineSlug,
}: {
  pipelineSlug: string;
}) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [canalFilter, setCanalFilter] = useState<
    "todos" | "diretas" | "parceiros"
  >("todos");
  const [data, setData] = useState<MetasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/squad/metas?pipeline=${pipelineSlug}&year=${currentYear}&month=${selectedMonth}`
        );
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [pipelineSlug, selectedMonth, currentYear]);

  // Filtrar canais e recalcular resumo conforme canal selecionado
  const filteredCanais =
    data?.canais?.filter((c) => {
      if (canalFilter === "todos") return true;
      if (canalFilter === "diretas") return /diret/i.test(c.canal);
      if (canalFilter === "parceiros") return /parceir/i.test(c.canal);
      return true;
    }) ?? [];

  const filteredResumo = data
    ? (() => {
        if (canalFilter === "todos") return data.resumo;
        const canais = filteredCanais;
        if (canais.length === 0) return data.resumo;
        const metaTotal = canais.reduce((s, c) => s + c.meta, 0);
        const realizadoTotal = canais.reduce((s, c) => s + c.realizado, 0);
        const esperadoMTD = canais.reduce((s, c) => s + c.esperadoMTD, 0);
        const forecast = canais.reduce((s, c) => s + c.forecast, 0);
        const desvio = canais.reduce((s, c) => s + c.desvio, 0);
        const pctMeta =
          metaTotal > 0 ? Math.round((realizadoTotal / metaTotal) * 100) : 0;
        return {
          metaTotal,
          realizadoTotal,
          esperadoMTD,
          forecast,
          desvio,
          pctMeta,
        };
      })()
    : null;

  const CANAL_FILTERS = [
    { key: "todos" as const, label: "Todos" },
    { key: "diretas" as const, label: "Vendas Diretas" },
    { key: "parceiros" as const, label: "Parceiros" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* @keyframes for spinner */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Seletor de mes */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}
      >
        <span
          style={{
            fontSize: 12,
            color: T.cinza200,
            fontWeight: 500,
            marginRight: 8,
          }}
        >
          MES:
        </span>
        {MESES.map((m) => {
          const isActive = selectedMonth === m.num;
          return (
            <button
              key={m.num}
              onClick={() => setSelectedMonth(m.num)}
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: isActive ? T.fg : "transparent",
                color: isActive ? "#FFF" : T.mutedFg,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Filtro por canal */}
      {!loading && !error && data && data.canais && data.canais.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: T.cinza200,
              fontWeight: 500,
              marginRight: 8,
            }}
          >
            CANAL:
          </span>
          {CANAL_FILTERS.map((f) => {
            const isActive = canalFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setCanalFilter(f.key)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: isActive ? T.fg : "transparent",
                  color: isActive ? "#FFF" : T.mutedFg,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              border: `2px solid ${T.cinza200}`,
              borderTopColor: T.primary,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: 13, color: T.mutedFg }}>
            Carregando metas...
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            backgroundColor: T.vermelho50,
            color: T.destructive,
            padding: "12px 16px",
            borderRadius: 8,
            border: `1px solid ${T.vermelho100}`,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Subtitulo do periodo */}
          <div
            style={{
              fontSize: 12,
              color: T.cinza200,
              textTransform: "capitalize",
            }}
          >
            {data.mesNome} {data.ano} &mdash; {data.diasUteisPassados} de{" "}
            {data.diasUteisTotal} dias uteis
            {data.isCurrentMonth && (
              <span
                style={{
                  marginLeft: 8,
                  display: "inline-block",
                  padding: "2px 8px",
                  backgroundColor: T.azul50,
                  color: T.primary,
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                mes atual
              </span>
            )}
          </div>

          {/* Cards resumo */}
          {filteredResumo && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
              }}
            >
              {/* Meta do Mes */}
              <div
                style={{
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "12px 18px",
                  boxShadow: T.elevSm,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: T.mutedFg,
                    textTransform: "uppercase",
                  }}
                >
                  Meta do Mes
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: T.fg,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {filteredResumo.metaTotal}
                </div>
              </div>

              {/* Realizado MTD */}
              <div
                style={{
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "12px 18px",
                  boxShadow: T.elevSm,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: T.mutedFg,
                    textTransform: "uppercase",
                  }}
                >
                  Realizado MTD
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color:
                      filteredResumo.realizadoTotal >= filteredResumo.esperadoMTD
                        ? T.verde700
                        : T.laranja500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {filteredResumo.realizadoTotal}
                </div>
              </div>

              {/* Forecast */}
              <div
                style={{
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "12px 18px",
                  boxShadow: T.elevSm,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: T.mutedFg,
                    textTransform: "uppercase",
                  }}
                >
                  Forecast
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color:
                      filteredResumo.forecast >= filteredResumo.metaTotal
                        ? T.verde700
                        : T.destructive,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {filteredResumo.forecast}
                </div>
              </div>

              {/* Desvio vs Esperado */}
              <div
                style={{
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "12px 18px",
                  boxShadow: T.elevSm,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: T.mutedFg,
                    textTransform: "uppercase",
                  }}
                >
                  Desvio vs Esperado
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color:
                      filteredResumo.desvio >= 0 ? T.verde700 : T.destructive,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatDesvio(filteredResumo.desvio)}
                </div>
              </div>
            </div>
          )}

          {/* Barra de progresso */}
          {filteredResumo && (
            <ProgressBar
              realizado={filteredResumo.realizadoTotal}
              meta={filteredResumo.metaTotal}
              esperadoMTD={filteredResumo.esperadoMTD}
            />
          )}

          {/* Forecast de Pipeline */}
          {data.pipelineForecast && filteredResumo && (
            <ForecastPipeline
              forecast={data.pipelineForecast}
              metaTotal={filteredResumo.metaTotal}
            />
          )}

          {/* Lista de Ganhos do Mes */}
          {data.wonDeals && data.wonDeals.length > 0 && (
            <DealsColapsavel
              titulo={`Ganhos do Mes (${data.wonDeals.length})`}
              icon={"\uD83C\uDFC6"}
              deals={data.wonDeals.map((d) => ({
                dealId: d.dealId,
                title: d.title,
                col1: d.owner,
                col2: d.canal,
                col3: d.wonTime
                  ? new Date(d.wonTime).toLocaleDateString("pt-BR")
                  : "-",
              }))}
              col1Label="RESPONSAVEL"
              col2Label="CANAL"
              col3Label="DATA"
            />
          )}

          {/* Provaveis Ganhos */}
          {data.probableDeals && data.probableDeals.length > 0 && (
            <DealsColapsavel
              titulo={`Provaveis Ganhos (${data.probableDeals.length})`}
              icon={"\uD83C\uDFAF"}
              deals={data.probableDeals.map((d) => ({
                dealId: d.dealId,
                title: d.title,
                col1: d.owner,
                col2: d.stage,
                col3: `${Math.round(d.conversion * 100)}%`,
              }))}
              col1Label="RESPONSAVEL"
              col2Label="ETAPA"
              col3Label="PROB."
            />
          )}

          {/* Tabela por canal */}
          {data.canais && data.canais.length > 0 && (
            <TabelaCanais
              canais={canalFilter === "todos" ? data.canais : filteredCanais}
              titulo={
                canalFilter === "todos"
                  ? "Resultado por Canal"
                  : `Resultado \u2014 ${CANAL_FILTERS.find((f) => f.key === canalFilter)?.label}`
              }
            />
          )}

          {/* Sub-regioes (apenas SZS) */}
          {data.subregioes && data.subregioes.length > 0 && (
            <TabelaCanais
              canais={data.subregioes as unknown as CanalMeta[]}
              titulo="Resultado por Sub-regiao"
            />
          )}

          {/* Rodape com timestamp */}
          <p
            style={{
              fontSize: 11,
              color: T.cinza200,
              textAlign: "right",
              margin: 0,
            }}
          >
            Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}
