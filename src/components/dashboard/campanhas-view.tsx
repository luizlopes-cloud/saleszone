"use client";

import { useState } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { CampanhasData, MetaAdRow, MediaFilter } from "@/lib/types";
import { MediaFilterToggle, DataSourceFooter } from "./ui";

interface Props {
  data: CampanhasData | null;
  loading: boolean;
  mediaFilter: MediaFilter;
  setMediaFilter: (f: MediaFilter) => void;
  lastUpdated?: Date | null;
  moduleId?: string;
}

function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CampanhasView({ data, loading, mediaFilter, setMediaFilter, lastUpdated, moduleId }: Props) {
  const isSZS = moduleId === "szs";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showInfo, setShowInfo] = useState(false);

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados de campanhas...
      </div>
    );
  }

  if (!data || data.summary.totalAds === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Nenhum dado de campanhas disponível. Execute o sync primeiro.
      </div>
    );
  }

  const { summary, squads, snapshotDate } = data;

  const toggleExpand = (sqId: number, emp: string) => {
    const key = `${sqId}:${emp}`;
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // cmql, copp, cpw now come directly from summary (computed in API)

  return (
    <>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <MediaFilterToggle value={mediaFilter} onChange={setMediaFilter} />
        <BrlPillWithTip label="Investimento" value={summary.totalSpendMonth} tip={`Gasto Meta Ads em ${monthLabel(snapshotDate)}`} />
        <StatPillWithTip label="Leads" value={summary.totalLeadsMonth} color={T.verde600} tip={`Leads Meta Ads em ${monthLabel(snapshotDate)}`} />
        <StatPillWithTip label="MQL" value={summary.totalMql} tip={`MQLs do mês (Pipedrive — todos os canais)`} />
        <StatPillWithTip label="WON" value={summary.totalWon} color={T.verde600} tip={`WONs do mês (Pipedrive)`} />
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <BrlPillWithTip label="CMQL" value={summary.cmql} tip="Investimento mês ÷ MQLs mês" />
          <span style={{ color: T.cinza300, fontSize: "16px", fontWeight: 300 }}>|</span>
          <BrlPillWithTip label="COPP" value={summary.copp} tip="Investimento mês ÷ OPPs mês" />
          <span style={{ color: T.cinza300, fontSize: "16px", fontWeight: 300 }}>|</span>
          <BrlPillWithTip label="CPW" value={summary.cpw} tip="Investimento mês ÷ WONs mês" />
        </div>
        <Disclaimer />
        <span style={{ fontSize: "11px", color: T.cinza400, marginLeft: "auto" }}>
          {summary.totalAds} ads ativos · {monthLabel(snapshotDate)}
        </span>
      </div>

      {/* Per squad */}
      {squads.map((sq) => {
        const clr = SQUAD_COLORS[sq.id] || T.azul600;
        const hasData = sq.empreendimentos.some((e) => e.ads > 0 || e.mql > 0 || e.sql > 0 || e.opp > 0 || e.won > 0);

        return (
          <div
            key={sq.id}
            style={{
              backgroundColor: T.card,
              borderRadius: "12px",
              border: `1px solid ${T.border}`,
              boxShadow: T.elevSm,
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            {/* Squad header */}
            <div
              style={{
                padding: "10px 16px",
                backgroundColor: clr,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ color: "#FFF", fontWeight: 600, fontSize: "14px" }}>{sq.name}</span>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginLeft: "auto" }}>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  Gasto: {formatBRL(sq.totalSpendMonth)}
                  {sq.spendAlert && (
                    <span style={{ marginLeft: "4px", fontSize: "10px" }} title="Gasto desbalanceado entre squads (>5% do target)">🔴</span>
                  )}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  Leads: {sq.totalLeadsMonth}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  WON: {sq.totalWon}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  CPW: {sq.cpw > 0 ? formatBRL(sq.cpw) : "-"}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowInfo((p) => !p); }}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    color: "#FFF",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    lineHeight: "18px",
                    textAlign: "center",
                    padding: 0,
                  }}
                  title="Como ler os dados"
                >
                  i
                </button>
              </div>
            </div>

            {showInfo && (
              <div style={{
                padding: "8px 16px",
                backgroundColor: "rgba(0,0,0,0.03)",
                borderBottom: "1px solid #E6E7EA",
                fontSize: "11px",
                color: T.cinza600,
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
              }}>
                <span><b>Header:</b> Investimento, Leads, MQL, WON — dados do mês</span>
                <span><b>CMQL, COPP, CPW (header):</b> Investimento mês ÷ volume mês</span>
                <span><b>Tabela:</b> dados do mês por empreendimento</span>
              </div>
            )}

            {hasData ? (
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>
                <thead>
                  {/* Linha 1: grupos */}
                  <tr style={{ backgroundColor: "#EAEBEF" }}>
                    <th rowSpan={2} style={{ ...thStyle, textAlign: "left", backgroundColor: "#EAEBEF", borderRight: "1px solid #D9DAE0" }}>Nome</th>
                    <th rowSpan={2} style={{ ...thStyle, textAlign: "right", backgroundColor: "#EAEBEF", borderRight: "1px solid #D9DAE0" }}>Gasto</th>
                    <th colSpan={8} style={{ ...thStyle, textAlign: "center", backgroundColor: "#EEF0F7", borderBottom: "none", borderRight: "1px solid #D9DAE0", fontSize: "9px", letterSpacing: "0.06em" }}>Volume (funil)</th>
                    <th colSpan={6} style={{ ...thStyle, textAlign: "center", backgroundColor: "#F5EDE8", borderBottom: "none", fontSize: "9px", letterSpacing: "0.06em" }}>Custo por Etapa</th>
                  </tr>
                  {/* Linha 2: colunas individuais */}
                  <tr>
                    <th style={{ ...thStyle, textAlign: "right", backgroundColor: "#EEF0F7" }}>Impr</th>
                    <th style={{ ...thStyle, textAlign: "right", backgroundColor: "#EEF0F7" }}>Clicks</th>
                    <th style={{ ...thStyle, textAlign: "right", backgroundColor: "#EEF0F7" }}>Leads</th>
                    <th style={{ ...thStyle, textAlign: "right", backgroundColor: "#EEF0F7" }}>MQL</th>
                    <th style={{ ...thStyle, textAlign: "right", backgroundColor: "#EEF0F7" }}>SQL</th>
                    <th style={{ ...thStyle, textAlign: "right", backgroundColor: "#EEF0F7" }}>OPP</th>
                    <th style={{ ...thStyle, textAlign: "right", backgroundColor: "#EEF0F7" }}>WON</th>
                    <ThInfo label="WON*" tip="WONs rastreados via ad deste emp, mas ganhos em OUTRO empreendimento" bg="#EEF0F7" border />
                    <ThInfo label="CPC" tip="Custo por Clique (Gasto / Clicks)" bg="#F5EDE8" />
                    <ThInfo label="CPL" tip="Custo por Lead (Gasto / Leads)" bg="#F5EDE8" />
                    <ThInfo label="CMQL" tip="Custo por MQL (Gasto / MQLs)" bg="#F5EDE8" />
                    <ThInfo label="CSQL" tip="Custo por SQL (Gasto / SQLs)" bg="#F5EDE8" />
                    <ThInfo label="COPP" tip="Custo por Oportunidade (Gasto / OPPs)" bg="#F5EDE8" />
                    <ThInfo label="CPW" tip="Custo por Ganho (Gasto / WONs)" bg="#F5EDE8" />
                  </tr>
                </thead>
                <tbody>
                  {sq.empreendimentos.map((emp) => {
                    const key = `${sq.id}:${emp.emp}`;
                    const isOpen = !!expanded[key];
                    const hasAds = emp.adsDetail && emp.adsDetail.length > 0;

                    return (
                      <>
                        <tr
                          key={emp.emp}
                          onClick={() => hasAds && toggleExpand(sq.id, emp.emp)}
                          style={{ cursor: hasAds ? "pointer" : "default" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                        >
                          {/* Nome */}
                          <td style={{ ...tdStyle, color: T.cinza800 }}>
                            {hasAds && (
                              <span style={{ display: "inline-block", width: "16px", fontSize: "10px", color: T.cinza400 }}>
                                {isOpen ? "▼" : "▶"}
                              </span>
                            )}
                            {!hasAds && <span style={{ display: "inline-block", width: "16px" }} />}
                            {emp.emp}
                            {(emp.criticos > 0 || emp.alertas > 0) && (
                              <span style={{ marginLeft: "6px", fontSize: "10px", color: emp.criticos > 0 ? T.destructive : T.laranja500 }}>
                                {emp.criticos > 0 ? `${emp.criticos}C` : ""}{emp.criticos > 0 && emp.alertas > 0 ? " " : ""}{emp.alertas > 0 ? `${emp.alertas}A` : ""}
                              </span>
                            )}
                          </td>
                          {/* Gasto */}
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.spend > 0 ? formatBRL(emp.spend) : "-"}</td>
                          {/* Volume: Impr, Clicks, Leads, MQL, SQL, OPP, WON */}
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.impressions > 0 ? emp.impressions.toLocaleString("pt-BR") : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.clicks > 0 ? emp.clicks.toLocaleString("pt-BR") : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.leads > 0 ? 600 : 400 }}>{emp.leads > 0 ? emp.leads : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.mql > 0 ? 600 : 400 }}>{emp.mql > 0 ? emp.mql : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.sql > 0 ? emp.sql : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.opp > 0 ? emp.opp : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.won > 0 ? 700 : 400, color: emp.won > 0 ? T.verde700 : T.cinza300 }}>{emp.won > 0 ? emp.won : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.wonOutro > 0 ? 600 : 400, color: emp.wonOutro > 0 ? T.laranja500 : T.cinza300 }}>{emp.wonOutro > 0 ? emp.wonOutro : "-"}</td>
                          {/* Custo: CPC, CPL, CMQL, CSQL, COPP, CPW */}
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.cpc > 0 ? formatBRL(emp.cpc) : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.cpl > 0 ? formatBRL(emp.cpl) : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.cmql > 0 ? formatBRL(emp.cmql) : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.csql > 0 ? formatBRL(emp.csql) : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{emp.copp > 0 ? formatBRL(emp.copp) : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.cpw > 0 ? 600 : 400 }}>{emp.cpw > 0 ? formatBRL(emp.cpw) : "-"}</td>
                        </tr>
                        {isOpen && hasAds && <AdRows ads={emp.adsDetail} />}
                      </>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: T.cinza400, fontSize: "13px" }}>
                Sem ads ativos {isSZS ? "nesta cidade" : "neste squad"}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: "10px", textAlign: "right" }}>
        <span style={{ fontSize: "11px", color: T.cinza400 }}>
          Meta Ads · Conta SZI · Dados do mês
        </span>
      </div>
      <DataSourceFooter lastUpdated={lastUpdated} />
    </>
  );
}

function Disclaimer() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          background: "#F3F4F6",
          border: "1px solid #D1D3DB",
          borderRadius: "6px",
          padding: "4px 8px",
          fontSize: "11px",
          color: "#6B6E84",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Como ler os dados
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "100%",
            marginTop: "6px",
            backgroundColor: "#1F2937",
            color: "#E5E7EB",
            fontSize: "12px",
            fontWeight: 400,
            padding: "12px 16px",
            borderRadius: "8px",
            width: "380px",
            zIndex: 30,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            lineHeight: "1.5",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#FFF" }}>Cards de resumo</p>
          <p style={{ margin: "0 0 10px" }}>
            Investimento e Leads referem-se a <b>Meta Ads do mês</b>. MQL e WON vêm do <b>Pipedrive</b> (todos os canais de marketing). CMQL, COPP e CPW são calculados como Investimento mês ÷ volume mês.
          </p>
          <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#FFF" }}>Tabela por empreendimento</p>
          <p style={{ margin: "0 0 10px" }}>
            Dados do <b>mês atual</b>. Leads = Meta Ads, MQL/SQL/OPP/WON = Pipedrive. Custos calculados como Gasto Meta Ads ÷ volume do Pipedrive.
          </p>
          <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#FFF" }}>Coluna WON*</p>
          <p style={{ margin: 0 }}>
            Mostra WONs onde o lead entrou por um ad deste empreendimento, mas o deal foi <b>ganho em outro empreendimento</b> no Pipedrive. Ex: lead de Ponta das Canas que fechou em Natal Spot.
          </p>
        </div>
      )}
    </div>
  );
}

function SevDot({ ad }: { ad: MetaAdRow }) {
  const [show, setShow] = useState(false);
  const sevColor =
    ad.severidade === "CRITICO" ? T.destructive : ad.severidade === "ALERTA" ? T.laranja500 : ad.severidade === "OPORTUNIDADE" ? T.primary : T.verde600;
  const sevLabel = ad.severidade === "CRITICO" ? "Crítico" : ad.severidade === "ALERTA" ? "Alerta" : ad.severidade === "OPORTUNIDADE" ? "Oportunidade" : "OK";
  const diagnosticos = ad.diagnostico ? ad.diagnostico.split(" | ") : [];

  return (
    <span
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", flexShrink: 0, cursor: diagnosticos.length > 0 ? "help" : "default" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ display: "block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: sevColor }} />
      {show && diagnosticos.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: "0",
            backgroundColor: "#1a1a2e",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "11px",
            lineHeight: 1.5,
            whiteSpace: "nowrap",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 700, color: sevColor, marginBottom: "4px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {sevLabel}
          </div>
          {diagnosticos.map((d, i) => (
            <div key={i} style={{ marginBottom: i < diagnosticos.length - 1 ? "3px" : 0 }}>• {d.trim()}</div>
          ))}
        </div>
      )}
    </span>
  );
}

function AdRows({ ads }: { ads: MetaAdRow[] }) {
  const adTd: React.CSSProperties = { ...tdStyle, fontSize: "12px", backgroundColor: "#FAFBFC" };

  return (
    <>
      {ads.map((ad) => {
        return (
          <tr
            key={ad.ad_id}
            style={{ backgroundColor: "#FAFBFC" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FAFBFC")}
          >
            {/* Nome com bolinha de severidade + ID */}
            <td
              style={{ ...adTd, paddingLeft: "32px", color: T.cinza700, maxWidth: "280px", overflow: "visible", position: "relative" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0px" }}>
                <SevDot ad={ad} />
                <div style={{ overflow: "hidden", minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.ad_name}>
                    {ad.ad_name}
                  </div>
                  <div style={{ fontSize: "10px", color: T.cinza400, fontFamily: "monospace", marginTop: "2px" }}>
                    ID: {ad.ad_id}
                  </div>
                </div>
              </div>
            </td>
            {/* Gasto */}
            <td style={{ ...adTd, textAlign: "right" }}>{ad.spend > 0 ? formatBRL(ad.spend) : "-"}</td>
            {/* Volume: Impr, Clicks, Leads, MQL, SQL, OPP, WON */}
            <td style={{ ...adTd, textAlign: "right" }}>{ad.impressions > 0 ? ad.impressions.toLocaleString("pt-BR") : "-"}</td>
            <td style={{ ...adTd, textAlign: "right" }}>{ad.clicks > 0 ? ad.clicks.toLocaleString("pt-BR") : "-"}</td>
            <td style={{ ...adTd, textAlign: "right", fontWeight: ad.leads > 0 ? 600 : 400 }}>{ad.leads > 0 ? ad.leads : "-"}</td>
            <td style={{ ...adTd, textAlign: "right", fontWeight: ad.mql > 0 ? 600 : 400 }}>{ad.mql > 0 ? ad.mql : "-"}</td>
            <td style={{ ...adTd, textAlign: "right" }}>{ad.sql > 0 ? ad.sql : "-"}</td>
            <td style={{ ...adTd, textAlign: "right" }}>{ad.opp > 0 ? ad.opp : "-"}</td>
            <td style={{ ...adTd, textAlign: "right", fontWeight: ad.won > 0 ? 700 : 400, color: ad.won > 0 ? T.verde700 : T.cinza300 }}>{ad.won > 0 ? ad.won : "-"}</td>
            <td style={{ ...adTd, textAlign: "right", fontWeight: ad.wonOutro > 0 ? 600 : 400, color: ad.wonOutro > 0 ? T.laranja500 : T.cinza300 }}>{ad.wonOutro > 0 ? ad.wonOutro : "-"}</td>
            {/* Custo: CPC, CPL, CMQL, CSQL, COPP, CPW */}
            <td style={{ ...adTd, textAlign: "right" }}>{ad.cpc > 0 ? formatBRL(ad.cpc) : "-"}</td>
            <td style={{ ...adTd, textAlign: "right" }}>{ad.cpl > 0 ? formatBRL(ad.cpl) : "-"}</td>
            <td style={{ ...adTd, textAlign: "right" }}>{ad.cmql > 0 ? formatBRL(ad.cmql) : "-"}</td>
            <td style={{ ...adTd, textAlign: "right" }}>{ad.csql > 0 ? formatBRL(ad.csql) : "-"}</td>
            <td style={{ ...adTd, textAlign: "right" }}>{ad.copp > 0 ? formatBRL(ad.copp) : "-"}</td>
            <td style={{ ...adTd, textAlign: "right", fontWeight: ad.cpw > 0 ? 600 : 400 }}>{ad.cpw > 0 ? formatBRL(ad.cpw) : "-"}</td>
          </tr>
        );
      })}
    </>
  );
}

function ThInfo({ label, tip, bg, border }: { label: string; tip: string; bg?: string; border?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <th style={{ ...thStyle, textAlign: "right", position: "relative", backgroundColor: bg || thStyle.backgroundColor, ...(border ? { borderRight: "1px solid #D9DAE0" } : {}) }}>
      {label}
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: "inline-block",
          marginLeft: "3px",
          width: "13px",
          height: "13px",
          borderRadius: "50%",
          backgroundColor: "#D1D3DB",
          color: "#FFF",
          fontSize: "9px",
          fontWeight: 700,
          lineHeight: "13px",
          textAlign: "center",
          cursor: "help",
          verticalAlign: "middle",
        }}
      >
        i
      </span>
      {show && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: "4px",
            backgroundColor: "#1F2937",
            color: "#FFF",
            fontSize: "11px",
            fontWeight: 400,
            padding: "6px 10px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            zIndex: 20,
            textTransform: "none",
            letterSpacing: "0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          {tip}
        </div>
      )}
    </th>
  );
}

function BrlPillWithTip({ label, value, tip }: { label: string; value: number; tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        position: "relative",
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span style={{ fontSize: "20px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
        {formatBRL(value)}
      </span>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: "inline-block",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: "#D1D3DB",
          color: "#FFF",
          fontSize: "9px",
          fontWeight: 700,
          lineHeight: "14px",
          textAlign: "center",
          cursor: "help",
        }}
      >
        i
      </span>
      {show && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "100%",
            transform: "translateX(-50%)",
            marginTop: "4px",
            backgroundColor: "#1F2937",
            color: "#FFF",
            fontSize: "11px",
            fontWeight: 400,
            padding: "6px 10px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            zIndex: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          {tip}
        </div>
      )}
    </div>
  );
}

function StatPillWithTip({ label, value, color, tip }: { label: string; value: number; color?: string; tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        position: "relative",
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span style={{ fontSize: "20px", fontWeight: 700, color: color || T.fg, fontVariantNumeric: "tabular-nums" }}>
        {value.toLocaleString("pt-BR")}
      </span>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: "inline-block",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: "#D1D3DB",
          color: "#FFF",
          fontSize: "9px",
          fontWeight: 700,
          lineHeight: "14px",
          textAlign: "center",
          cursor: "help",
        }}
      >
        i
      </span>
      {show && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "100%",
            transform: "translateX(-50%)",
            marginTop: "4px",
            backgroundColor: "#1F2937",
            color: "#FFF",
            fontSize: "11px",
            fontWeight: 400,
            padding: "6px 10px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            zIndex: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          {tip}
        </div>
      )}
    </div>
  );
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

function BrlPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span style={{ fontSize: "20px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
        {formatBRL(value)}
      </span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  backgroundColor: "#F3F3F5",
};


const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid #E6E7EA",
  fontSize: "13px",
  fontWeight: 400,
  color: "#141A3C",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
