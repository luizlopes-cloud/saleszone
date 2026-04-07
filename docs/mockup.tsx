import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Calendar, RefreshCw, Columns3, ChevronLeft, Users, BarChart3 } from "lucide-react";

/* ─── SEAZONE ICON ─── */
const SeazoneIcon = () => (
  <svg width="28" height="29" viewBox="0 0 48 49" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M46.2131 15.1755L37.6794 10.1673C37.6977 10.0485 37.7528 9.9388 37.7528 9.81999V2.2665C37.7528 1.01444 36.7342 0 35.4771 0H30.9257C29.6686 0 28.6501 1.01444 28.6501 2.2665V4.90314L25.5531 3.09816C24.296 2.34876 22.6397 2.4767 21.4744 3.33578L21.4147 3.35863L1.78243 14.7003C0.144493 15.6736-0.539125 17.9355 0.479423 19.6308C1.53468 21.3901 3.86081 21.8654 5.49416 20.892L6.6687 20.2157C5.27852 22.9255 4.41138 25.9871 4.41138 29.3275C4.41138 34.6099 6.44848 39.8146 10.2107 43.5662C11.688 45.0422 13.4086 46.276 15.2942 47.1853C16.7441 47.8845 18.2765 48.4694 19.8685 48.7618C21.979 49.1457 24.1629 48.9492 26.2964 48.9537C28.5996 48.9537 30.9074 48.9583 33.2106 48.9629C35.2982 48.9674 37.3857 48.9766 39.4962 48.9811C40.0239 48.9811 40.5423 48.8441 41.0103 48.6064C41.6113 48.3003 41.9692 47.9667 42.3638 47.4412C42.8134 46.8472 43.1254 46.1297 43.1254 45.3621V21.582C44.6899 22.1441 46.5894 21.6552 47.5207 20.1015C48.5393 18.4062 47.8557 16.1443 46.2131 15.171M36.3947 29.7022C36.3947 36.9312 31.4809 42.8077 24.0712 42.8077C16.6615 42.8077 11.2155 36.5565 11.2155 29.3275C11.2155 22.0984 16.6615 16.0757 24.0712 16.0757C31.4809 16.0757 36.3947 21.6506 36.3947 28.802V29.7067V29.7022Z" fill="#FC6058"/>
  </svg>
);

/* ─── TOKENS ─── */
const T = {
  primary: "#0055FF", primaryFg: "#FFFFFF",
  bg: "#FFFFFF", fg: "#080E32",
  card: "#FFFFFF", cardFg: "#141A3C",
  muted: "#E6E7EA", mutedFg: "#6B6E84",
  destructive: "#E7000B", border: "#E6E7EA",
  elevSm: "0 1px 2px rgba(0,0,0,0.2), 0 0.1px 0.3px rgba(0,0,0,0.1)",
  azul50: "#F0F2FA", azul600: "#0055FF",
  cinza50: "#F3F3F5", cinza100: "#E6E7EA", cinza200: "#CECFD6", cinza300: "#B5B7C1",
  cinza400: "#9C9FAD", cinza600: "#6B6E84", cinza700: "#525670", cinza800: "#393E5B",
  verde50: "#F0FDF4", verde600: "#5EA500", verde700: "#15803D",
  vermelho50: "#FEE2E2", vermelho100: "#FECACA",
  laranja500: "#FF6900", roxo600: "#9810FA", teal600: "#0D9488",
  font: "'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
};

const SQUAD_COLORS = { 1: T.azul600, 2: T.roxo600, 3: T.teal600 };
const TAB_COLORS = { mql: T.azul600, sql: T.roxo600, opp: T.laranja500, won: T.verde600 };
const TABS = [{ key: "mql", label: "MQL" }, { key: "sql", label: "SQL" }, { key: "opp", label: "OPP" }, { key: "won", label: "WON" }];

/* ─── 28 DAYS ─── */
const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WEEKDAYS_PT = ["dom","seg","ter","qua","qui","sex","sáb"];
const NUM_DAYS = 28;
function generateDates() {
  const dates = [], today = new Date();
  for (let i = 0; i < NUM_DAYS; i++) { const d = new Date(today); d.setDate(today.getDate() - i); dates.push({ label: `${d.getDate()} ${MONTHS_PT[d.getMonth()]}`, weekday: WEEKDAYS_PT[d.getDay()], isWeekend: d.getDay() === 0 || d.getDay() === 6, isSunday: d.getDay() === 0 }); }
  return dates;
}
const DATES = generateDates();
function seededRand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function genDaily(seed, base) { const rng = seededRand(seed); return DATES.map(dt => dt.isWeekend ? Math.floor(rng() * base * 0.3) : Math.floor(rng() * base * 1.4) + Math.floor(base * 0.2)); }

/* ─── SQUADS ─── */
const SQUADS = [
  { id: 1, squad: "Squad 1", marketing: "Mari", preVenda: "Luciana Patrício", venda: "Laura", metaToDate: 304,
    rows: [{ emp: "Ponta das Canas Spot II", d: genDaily(101, 35) }, { emp: "Itacaré Spot", d: genDaily(102, 2) }, { emp: "Marista 144 Spot", d: genDaily(103, 0) }] },
  { id: 2, squad: "Squad 2", marketing: "Jean", preVenda: "Natália Saramago", venda: "Camila Santos", metaToDate: 593,
    rows: [{ emp: "Natal Spot", d: genDaily(201, 45) }, { emp: "Novo Campeche Spot II", d: genDaily(202, 2) }, { emp: "Caraguá Spot", d: genDaily(203, 1) }, { emp: "Bonito Spot II", d: genDaily(204, 0) }] },
  { id: 3, squad: "Squad 3", marketing: "Jean", preVenda: "Hellen Dias", venda: "Luana Schaikoski", metaToDate: 593,
    rows: [{ emp: "Jurerê Spot II", d: genDaily(301, 40) }, { emp: "Jurerê Spot III", d: genDaily(302, 1) }, { emp: "Barra Grande Spot", d: genDaily(303, 35) }, { emp: "Vistas de Anitá II", d: genDaily(304, 10) }] },
];
SQUADS.forEach(sq => sq.rows.forEach(r => { r.totalMes = r.d.reduce((a, b) => a + b, 0); }));

/* Flat rows for alignment table: squad id + empreendimento */
const FLAT_ROWS = SQUADS.flatMap(sq => sq.rows.map(r => ({ sqId: sq.id, sqName: sq.squad, emp: r.emp, correctPV: sq.preVenda, correctV: sq.venda })));

/* People columns — exact from the screenshot */
const PV_COLS = ["Luciana Patrício", "Natália Saramago", "Hellen Dias"];
const V_COLS = ["Laura", "Camila Santos", "Filipe Padoveze", "Luana Schaikoski", "Priscila Pestana", "Perrone"];

/* Mock alignment counts — seeded per cell */
function genAlignCounts() {
  const data = {};
  let seed = 42;
  FLAT_ROWS.forEach((row, ri) => {
    const key = `${row.sqId}-${ri}`;
    data[key] = { pv: {}, v: {} };
    PV_COLS.forEach((p, pi) => {
      const rng = seededRand(seed++);
      const isCorrect = p === row.correctPV;
      if (isCorrect) { data[key].pv[p] = Math.floor(rng() * 70 + 5); }
      else { data[key].pv[p] = rng() > 0.65 ? Math.floor(rng() * 3) : 0; }
    });
    V_COLS.forEach((p, vi) => {
      const rng = seededRand(seed++);
      const isCorrect = p === row.correctV;
      if (isCorrect) { data[key].v[p] = Math.floor(rng() * 18 + 1); }
      else { data[key].v[p] = rng() > 0.7 ? Math.floor(rng() * 10 + 1) : 0; }
    });
  });
  return data;
}
const ALIGN_DATA = genAlignCounts();

/* ──────────────────────────── */
/* ─── MAIN COMPONENT ─── */
/* ──────────────────────────── */
export default function SalesTracker() {
  const [mainView, setMainView] = useState("acompanhamento");
  const [activeTab, setActiveTab] = useState("mql");
  const [expanded, setExpanded] = useState({ 1: true, 2: true, 3: true });
  const [showTeamCols, setShowTeamCols] = useState(false);
  const [hCol, setHCol] = useState(null);

  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const grand = useMemo(() => {
    let tm = 0, mt = 0; const dd = new Array(NUM_DAYS).fill(0);
    SQUADS.forEach(s => { mt += s.metaToDate; s.rows.forEach(r => { tm += r.totalMes; r.d.forEach((v, i) => dd[i] += v); }); });
    return { tm, mt, dd };
  }, []);
  const pct = grand.mt > 0 ? Math.round((grand.tm / grand.mt) * 100) : 0;
  const cellBg = (i) => hCol === i ? T.azul50 : DATES[i]?.isWeekend ? "#FAFAFB" : "transparent";
  const weekStarts = useMemo(() => { const s = new Set(); DATES.forEach((d, i) => { if (d.isSunday && i > 0) s.add(i); }); return s; }, []);

  /* Alignment stats */
  const alignStats = useMemo(() => {
    let total = 0, mis = 0;
    FLAT_ROWS.forEach((row, ri) => {
      const key = `${row.sqId}-${ri}`;
      const d = ALIGN_DATA[key];
      PV_COLS.forEach(p => { const v = d.pv[p] || 0; total += v; if (v > 0 && p !== row.correctPV) mis += v; });
      V_COLS.forEach(p => { const v = d.v[p] || 0; total += v; if (v > 0 && p !== row.correctV) mis += v; });
    });
    return { total, mis, ok: total - mis };
  }, []);

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", letterSpacing: "0.02em" }}>
      {/* HEADER */}
      <header style={{ backgroundColor: T.bg, borderBottom: `1px solid ${T.border}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", position: "sticky", top: 0, zIndex: 20 }}>
        <SeazoneIcon />
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: "17px", fontWeight: 500, color: T.fg, margin: 0 }}>Acompanhamento de Vendas</h4>
          <span style={{ fontSize: "11px", fontWeight: 400, color: T.mutedFg }}>Squads Manual · Pipeline SZI</span>
        </div>
        <div style={{ display: "flex", gap: "2px", backgroundColor: T.cinza50, borderRadius: "9999px", padding: "3px", border: `1px solid ${T.border}` }}>
          <button onClick={() => setMainView("acompanhamento")} style={{ ...vBtn, backgroundColor: mainView === "acompanhamento" ? T.fg : "transparent", color: mainView === "acompanhamento" ? "#FFF" : T.cinza600 }}>
            <BarChart3 size={12} /> Acompanhamento
          </button>
          <button onClick={() => setMainView("alinhamento")} style={{ ...vBtn, backgroundColor: mainView === "alinhamento" ? T.fg : "transparent", color: mainView === "alinhamento" ? "#FFF" : T.cinza600 }}>
            <Users size={12} /> Alinhamento Squad
          </button>
        </div>
        <button style={pillBtn()}><Calendar size={13} /> 4 semanas</button>
        <button style={pillBtnPrimary()}><RefreshCw size={12} /> Atualizar</button>
      </header>

      <div style={{ padding: "16px 20px", maxWidth: "2200px", margin: "0 auto" }}>

        {mainView === "acompanhamento" ? (
          /* ═══════ ACOMPANHAMENTO ═══════ */
          <AcompanhamentoView
            activeTab={activeTab} setActiveTab={setActiveTab}
            expanded={expanded} toggle={toggle}
            showTeamCols={showTeamCols} setShowTeamCols={setShowTeamCols}
            hCol={hCol} setHCol={setHCol}
            grand={grand} pct={pct} cellBg={cellBg} weekStarts={weekStarts}
          />
        ) : (
          /* ═══════ ALINHAMENTO SQUAD ═══════ */
          <>
            {/* Stats bar */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
              <StatPill label="Negócios Abertos" value={alignStats.total} />
              <StatPill label="Alinhados" value={alignStats.ok} color={T.verde600} />
              <StatPill label="Desalinhados" value={alignStats.mis} color={T.destructive} />
              <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "20px", height: "14px", border: `3px solid ${T.primary}`, borderRadius: "3px", backgroundColor: T.azul50 }} />
                  <span style={{ fontSize: "11px", color: T.cinza600 }}>Zona correta (pessoa designada)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "20px", height: "14px", borderRadius: "3px", backgroundColor: T.vermelho50, border: `1px solid ${T.destructive}44` }} />
                  <span style={{ fontSize: "11px", color: T.cinza600 }}>Desalinhado (pessoa errada)</span>
                </div>
              </div>
            </div>

            {/* SINGLE FLAT TABLE */}
            <div style={{ backgroundColor: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, boxShadow: T.elevSm, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
                  <thead>
                    {/* Group header: Pre Venda | Venda */}
                    <tr style={{ backgroundColor: T.cinza50 }}>
                      <th style={{ ...thBase, borderBottom: "none" }} />
                      <th style={{ ...thBase, borderBottom: "none" }} />
                      <th colSpan={PV_COLS.length} style={{ ...thBase, textAlign: "center", borderBottom: "none", fontSize: "11px", fontWeight: 700, color: T.cinza800, borderLeft: `1px solid ${T.cinza200}` }}>
                        Pré Venda
                      </th>
                      <th colSpan={V_COLS.length} style={{ ...thBase, textAlign: "center", borderBottom: "none", fontSize: "11px", fontWeight: 700, color: T.cinza800, borderLeft: `2px solid ${T.cinza300}` }}>
                        Venda
                      </th>
                    </tr>
                    {/* Person names */}
                    <tr style={{ backgroundColor: T.cinza50 }}>
                      <th style={{ ...thBase, textAlign: "left", minWidth: 50 }}>Squad</th>
                      <th style={{ ...thBase, textAlign: "left", minWidth: 180 }}>Empreendimento</th>
                      {PV_COLS.map((p, i) => (
                        <th key={`pv-${i}`} style={{ ...thBase, textAlign: "right", minWidth: 110, borderLeft: i === 0 ? `1px solid ${T.cinza200}` : undefined }}>
                          {p}
                        </th>
                      ))}
                      {V_COLS.map((p, i) => (
                        <th key={`v-${i}`} style={{ ...thBase, textAlign: "right", minWidth: 100, borderLeft: i === 0 ? `2px solid ${T.cinza300}` : undefined }}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FLAT_ROWS.map((row, ri) => {
                      const key = `${row.sqId}-${ri}`;
                      const d = ALIGN_DATA[key];
                      const clr = SQUAD_COLORS[row.sqId] || T.azul600;
                      /* Is this the first row of a new squad? */
                      const isFirst = ri === 0 || FLAT_ROWS[ri - 1].sqId !== row.sqId;
                      /* How many rows in this squad (for border box height) */
                      const sqRows = FLAT_ROWS.filter(r => r.sqId === row.sqId);
                      const isLast = ri === FLAT_ROWS.length - 1 || FLAT_ROWS[ri + 1]?.sqId !== row.sqId;
                      const sqPVIdx = PV_COLS.indexOf(row.correctPV);
                      const sqVIdx = V_COLS.indexOf(row.correctV);

                      return (
                        <tr key={ri} style={{ borderTop: isFirst ? `2px solid ${clr}44` : undefined }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = T.cinza50}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}>
                          {/* Squad */}
                          <td style={{ ...td, color: T.cinza600, fontWeight: 500 }}>{row.sqId}</td>
                          {/* Empreendimento */}
                          <td style={{ ...td, color: T.cinza800 }}>{row.emp}</td>
                          {/* Pre Venda columns */}
                          {PV_COLS.map((p, pi) => {
                            const val = d.pv[p] || 0;
                            const isZone = pi === sqPVIdx;
                            const isMis = val > 0 && !isZone;
                            return (
                              <td key={`pv-${pi}`} style={{
                                ...td, textAlign: "right",
                                borderLeft: pi === 0 ? `1px solid ${T.cinza200}` : `1px solid ${T.border}`,
                                /* Thick border box for the correct zone */
                                ...(isZone ? {
                                  backgroundColor: T.azul50,
                                  borderLeft: `3px solid ${T.primary}`,
                                  borderRight: `3px solid ${T.primary}`,
                                  borderTop: isFirst ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                  borderBottom: isLast ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                } : {}),
                                /* Red for misaligned */
                                ...(isMis ? { backgroundColor: T.vermelho50, color: T.destructive, fontWeight: 700 } : {}),
                                color: val === 0 ? T.cinza300 : isMis ? T.destructive : isZone ? T.primary : T.cardFg,
                                fontWeight: isZone && val > 0 ? 600 : isMis ? 700 : 400,
                              }}>
                                {val}
                              </td>
                            );
                          })}
                          {/* Venda columns */}
                          {V_COLS.map((p, vi) => {
                            const val = d.v[p] || 0;
                            const isZone = vi === sqVIdx;
                            const isMis = val > 0 && !isZone;
                            return (
                              <td key={`v-${vi}`} style={{
                                ...td, textAlign: "right",
                                borderLeft: vi === 0 ? `2px solid ${T.cinza300}` : `1px solid ${T.border}`,
                                ...(isZone ? {
                                  backgroundColor: T.azul50,
                                  borderLeft: `3px solid ${T.primary}`,
                                  borderRight: `3px solid ${T.primary}`,
                                  borderTop: isFirst ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                  borderBottom: isLast ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                } : {}),
                                ...(isMis ? { backgroundColor: T.vermelho50, color: T.destructive, fontWeight: 700 } : {}),
                                color: val === 0 ? T.cinza300 : isMis ? T.destructive : isZone ? T.primary : T.cardFg,
                                fontWeight: isZone && val > 0 ? 600 : isMis ? 700 : 400,
                              }}>
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: "10px", textAlign: "right" }}>
              <span style={{ fontSize: "11px", color: T.cinza400 }}>Pipedrive · Negócios em aberto · {new Date().toLocaleDateString("pt-BR")}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/* ═══ ACOMPANHAMENTO VIEW (extracted) ═══ */
/* ══════════════════════════════════════════════ */
function AcompanhamentoView({ activeTab, setActiveTab, expanded, toggle, showTeamCols, setShowTeamCols, hCol, setHCol, grand, pct, cellBg, weekStarts }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "3px", backgroundColor: T.bg, borderRadius: "12px", padding: "3px", border: `1px solid ${T.border}` }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: "7px 22px", borderRadius: "9999px", border: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: 500, letterSpacing: "0.02em", transition: "all 0.15s",
              backgroundColor: activeTab === tab.key ? TAB_COLORS[tab.key] : "transparent",
              color: activeTab === tab.key ? "#FFF" : T.mutedFg,
            }}>{tab.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Pill label="Total 28d" value={grand.tm} />
          <Pill label="Meta TD" value={grand.mt} />
          <Pill label="% Meta" value={`${pct}%`} color={pct >= 100 ? T.verde600 : pct >= 60 ? T.laranja500 : T.destructive} />
        </div>
      </div>

      <div style={{ backgroundColor: T.card, borderRadius: "12px", border: `1px solid ${T.border}`, boxShadow: T.elevSm, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: showTeamCols ? "2400px" : "2100px" }}>
            <thead>
              <tr style={{ backgroundColor: T.fg }}>
                <th colSpan={showTeamCols ? 5 : 3} style={{ ...hdrBase, borderBottom: "none" }} />
                <th style={{ ...hdrBase, borderBottom: "none" }} /><th style={{ ...hdrBase, borderBottom: "none" }} />
                {(() => { const weeks = []; let cw = { start: 0, count: 0 }; DATES.forEach((d, i) => { if (weekStarts.has(i) && cw.count > 0) { weeks.push({ ...cw }); cw = { start: i, count: 0 }; } cw.count++; }); if (cw.count > 0) weeks.push(cw); return weeks.map((w, wi) => (<th key={wi} colSpan={w.count} style={{ ...hdrBase, textAlign: "center", borderBottom: "none", borderLeft: wi > 0 ? "2px solid rgba(255,255,255,0.15)" : "none", fontSize: "9px", color: "rgba(255,255,255,0.6)" }}>Sem. {wi + 1}</th>)); })()}
              </tr>
              <tr style={{ backgroundColor: T.cinza50 }}>
                <TH w={120}>Squad</TH>
                {showTeamCols ? (
                  <><TH w={90}><span style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }} onClick={() => setShowTeamCols(false)}><ChevronLeft size={11} style={{ color: T.primary }} /> Mkt</span></TH><TH w={120}>Pré-Venda</TH><TH w={100}>Venda</TH></>
                ) : (
                  <TH w={150}><span style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }} onClick={() => setShowTeamCols(true)}><Columns3 size={11} style={{ color: T.primary }} /> Equipe</span></TH>
                )}
                <TH w={170}>Empreendimento</TH>
                <TH w={68} right>Total</TH><TH w={68} right>Meta</TH>
                {DATES.map((d, i) => (
                  <TH key={i} w={52} right onMouseEnter={() => setHCol(i)} onMouseLeave={() => setHCol(null)}
                    extraStyle={{ backgroundColor: hCol === i ? T.azul50 : d.isWeekend ? "#FAFAFB" : undefined, borderLeft: weekStarts.has(i) ? `2px solid ${T.cinza200}` : undefined, paddingLeft: "4px", paddingRight: "4px" }}>
                    <div style={{ lineHeight: "1.1" }}><div style={{ fontSize: "9px", color: d.isWeekend ? T.cinza400 : T.cinza600, fontWeight: 400, textTransform: "none" }}>{d.weekday}</div><div>{d.label.split(" ")[0]}/{MONTHS_PT.indexOf(d.label.split(" ")[1]) + 1}</div></div>
                  </TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {SQUADS.map(sq => {
                const isOpen = expanded[sq.id] !== false;
                const clr = SQUAD_COLORS[sq.id] || T.azul600;
                const sqTm = sq.rows.reduce((s, r) => s + r.totalMes, 0);
                const sqD = new Array(NUM_DAYS).fill(0);
                sq.rows.forEach(r => r.d.forEach((v, i) => sqD[i] += v));
                return [
                  <tr key={sq.id} onClick={() => toggle(sq.id)} style={{ cursor: "pointer", borderTop: `2px solid ${clr}33` }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = T.cinza50} onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}>
                    <td style={{ ...c, fontWeight: 600 }}><div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      {isOpen ? <ChevronDown size={13} style={{ color: clr, flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: clr, flexShrink: 0 }} />}
                      <span style={{ width: "7px", height: "7px", borderRadius: "9999px", backgroundColor: clr, flexShrink: 0 }} />{sq.squad}
                    </div></td>
                    {showTeamCols ? (<><td style={{ ...c, color: T.cinza700, fontWeight: 500 }}>{sq.marketing}</td><td style={{ ...c, color: T.cinza700, fontSize: "12px" }}>{sq.preVenda}</td><td style={{ ...c, color: T.cinza700, fontWeight: 500 }}>{sq.venda}</td></>) : (
                      <td style={{ ...c, color: T.cinza700 }}><div style={{ display: "flex", gap: "3px", alignItems: "center" }}><Tag color={clr}>{sq.marketing}</Tag><Tag color={T.cinza600}>{sq.preVenda.split(" ")[0]}</Tag><Tag color={T.cinza600}>{sq.venda.split(" ")[0]}</Tag></div></td>
                    )}
                    <td style={{ ...c, fontWeight: 600, color: T.cinza600 }}>TOTAL</td>
                    <td style={{ ...cR, fontWeight: 700, color: T.primary }}>{sqTm}</td><td style={{ ...cR, fontWeight: 600 }}>{sq.metaToDate}</td>
                    {sqD.map((v, i) => (<td key={i} style={{ ...cR, fontWeight: 600, backgroundColor: cellBg(i), borderLeft: weekStarts.has(i) ? `2px solid ${T.cinza200}` : undefined }} onMouseEnter={() => setHCol(i)} onMouseLeave={() => setHCol(null)}>{v}</td>))}
                  </tr>,
                  ...(isOpen ? sq.rows.map((r, ri) => (
                    <tr key={`${sq.id}-${ri}`} onMouseEnter={e => e.currentTarget.style.backgroundColor = T.cinza50} onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}>
                      <td style={c} />{showTeamCols ? <><td style={c} /><td style={c} /><td style={c} /></> : <td style={c} />}
                      <td style={{ ...c, paddingLeft: "28px", color: T.cinza800 }}>{r.emp}</td>
                      <td style={cR}>{r.totalMes}</td><td style={cR} />
                      {r.d.map((v, i) => (<td key={i} style={{ ...cR, color: v === 0 ? T.cinza300 : T.cardFg, backgroundColor: cellBg(i), borderLeft: weekStarts.has(i) ? `2px solid ${T.cinza200}` : undefined }} onMouseEnter={() => setHCol(i)} onMouseLeave={() => setHCol(null)}>{v}</td>))}
                    </tr>
                  )) : []),
                ];
              })}
              <tr style={{ backgroundColor: T.fg }}>
                <td colSpan={showTeamCols ? 5 : 3} style={{ ...c, fontWeight: 700, color: T.primaryFg }}>TOTAL GERAL</td>
                <td style={{ ...cR, fontWeight: 700, color: T.primaryFg }}>{grand.tm}</td><td style={{ ...cR, fontWeight: 700, color: T.primaryFg }}>{grand.mt}</td>
                {grand.dd.map((v, i) => (<td key={i} style={{ ...cR, fontWeight: 700, color: T.primaryFg, borderLeft: weekStarts.has(i) ? "2px solid rgba(255,255,255,0.12)" : undefined }}>{v}</td>))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: "12px", display: "flex", gap: "16px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          {Object.entries(SQUAD_COLORS).map(([n, cc]) => (<div key={n} style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "7px", height: "7px", borderRadius: "9999px", backgroundColor: cc }} /><span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600 }}>Squad {n}</span></div>))}
        </div>
        <span style={{ fontSize: "11px", color: T.cinza400 }}>Pipedrive · {new Date().toLocaleDateString("pt-BR")}</span>
      </div>
    </>
  );
}

/* ─── COMPONENTS ─── */
function Pill({ label, value, color }) {
  return (<div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "9999px", padding: "5px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
    <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase" }}>{label}</span>
    <span style={{ fontSize: "14px", fontWeight: 700, color: color || "#080E32", fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</span>
  </div>);
}
function StatPill({ label, value, color }) {
  return (<div style={{ backgroundColor: "#FFF", border: "1px solid #E6E7EA", borderRadius: "12px", padding: "10px 18px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
    <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
    <span style={{ fontSize: "20px", fontWeight: 700, color: color || "#080E32", fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString("pt-BR")}</span>
  </div>);
}
function Tag({ children, color }) {
  return (<span style={{ display: "inline-block", padding: "1px 7px", borderRadius: "9999px", fontSize: "10px", fontWeight: 500, backgroundColor: `${color}12`, color, whiteSpace: "nowrap" }}>{children}</span>);
}
function TH({ children, w, right, extraStyle, ...rest }) {
  return (<th {...rest} style={{ textAlign: right ? "right" : "left", padding: "8px 6px", fontSize: "9px", fontWeight: 500, color: "#6B6E84", borderBottom: "1px solid #E6E7EA", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", backgroundColor: "#F3F3F5", fontVariantNumeric: right ? "tabular-nums" : undefined, ...(w ? { minWidth: w, width: w } : {}), ...extraStyle }}>{children}</th>);
}

/* ─── STYLES ─── */
const c = { padding: "7px 6px", borderBottom: "1px solid #E6E7EA", fontSize: "12px", fontWeight: 400, color: "#141A3C", letterSpacing: "0.02em", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", transition: "background 0.1s" };
const cR = { ...c, textAlign: "right" };
const td = { padding: "7px 10px", borderBottom: "1px solid #E6E7EA", fontSize: "13px", fontWeight: 400, color: "#141A3C", letterSpacing: "0.02em", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", transition: "background 0.1s" };
const thBase = { padding: "8px 10px", fontSize: "10px", fontWeight: 500, color: "#6B6E84", borderBottom: "1px solid #E6E7EA", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", backgroundColor: "#F3F3F5" };
const hdrBase = { padding: "4px 6px", fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" };
const vBtn = { padding: "5px 14px", borderRadius: "9999px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s", letterSpacing: "0.02em" };
function pillBtn() { return { padding: "6px 14px", borderRadius: "9999px", border: "1px solid #E6E7EA", backgroundColor: "#FFF", color: "#525670", cursor: "pointer", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "5px" }; }
function pillBtnPrimary() { return { padding: "6px 14px", borderRadius: "9999px", border: "none", backgroundColor: "#0055FF", color: "#FFF", cursor: "pointer", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "5px" }; }
