"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/constants";
import { getModuleConfig, DEFAULT_MODULE } from "@/lib/modules";
import type { TabKey, MediaFilter, AcompanhamentoData, AlinhamentoData, CampanhasData, RegrasMqlData, OciosidadeData, PresalesData, FunilData, MisalignedDealsData, PlanejamentoData, OrcamentoData, PerformanceData, BaselineData, DiagVendasData, ForecastData, LeadtimeData, AvaliacoesData, LostsData, UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/dashboard/header";
import { AcompanhamentoView } from "@/components/dashboard/acompanhamento-view";
import { AlinhamentoView } from "@/components/dashboard/alinhamento-view";
import { BalanceamentoView } from "@/components/dashboard/balanceamento-view";
import { CampanhasView } from "@/components/dashboard/campanhas-view";
import { DiagnosticoMktView } from "@/components/dashboard/diagnostico-mkt-view";
import { OciosidadeView } from "@/components/dashboard/ociosidade-view";
import { PresalesView } from "@/components/dashboard/presales-view";
import { ResultadosView } from "@/components/dashboard/resultados-view";
import { PlanejamentoView } from "@/components/dashboard/planejamento-view";
import { OrcamentoView } from "@/components/dashboard/orcamento-view";
import { PerformancePreVendasView, PerformanceVendasView } from "@/components/dashboard/performance-view";
import { BaselineView } from "@/components/dashboard/baseline-view";
import { DiagnosticoVendasView } from "@/components/dashboard/diagnostico-vendas-view";
import { ForecastView } from "@/components/dashboard/forecast-view";
import { LeadtimeView } from "@/components/dashboard/leadtime-view";
import { AvaliacoesView } from "@/components/dashboard/avaliacoes-view";
import { LostsView } from "@/components/dashboard/losts-view";
import { BacklogView } from "@/components/backlog/backlog-view";
import { AdminView } from "@/components/dashboard/admin-view";
import { ExploradorView } from "@/components/dashboard/explorador-view";
import { OtimizacaoView } from "@/components/dashboard/otimizacao-view";
import SquadAtividadesView from "@/components/dashboard/squad-atividades-view";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name: string } | undefined>();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [activeModule, setActiveModule] = useState(DEFAULT_MODULE);
  const moduleConfig = getModuleConfig(activeModule);
  const [mainView, setMainViewRaw] = useState("campanhas");
  const [hydrated, setHydrated] = useState(false);
  const setMainView = (v: string) => {
    setMainViewRaw(v);
    localStorage.setItem("mainView", v);
  };
  const [activeTab, setActiveTab] = useState<TabKey>("mql");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Restore persisted state from localStorage after hydration
  useEffect(() => {
    const savedModule = localStorage.getItem("activeModule");
    if (savedModule) setActiveModule(savedModule);
    const savedView = localStorage.getItem("mainView");
    if (savedView) setMainViewRaw(savedView);
    const savedUpdated = localStorage.getItem("lastUpdated");
    if (savedUpdated) setLastUpdated(new Date(savedUpdated));
    setHydrated(true);
  }, []);
  const [acompData, setAcompData] = useState<Record<string, AcompanhamentoData>>({});
  const [alinhData, setAlinhData] = useState<AlinhamentoData | null>(null);
  const [misalignedDeals, setMisalignedDeals] = useState<MisalignedDealsData | null>(null);
  const [campData, setCampData] = useState<CampanhasData | null>(null);
  const [balancData, setBalancData] = useState<RegrasMqlData | null>(null);
  const [ocioData, setOcioData] = useState<OciosidadeData | null>(null);
  const [presalesData, setPresalesData] = useState<PresalesData | null>(null);
  const [funilData, setFunilData] = useState<FunilData | null>(null);
  const [planejData, setPlanejData] = useState<PlanejamentoData | null>(null);
  const [orcData, setOrcData] = useState<OrcamentoData | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("paid");
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [perfDays, setPerfDays] = useState(90);
  const [baselineData, setBaselineData] = useState<BaselineData | null>(null);
  const [diagVendasData, setDiagVendasData] = useState<DiagVendasData | null>(null);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [leadtimeData, setLeadtimeData] = useState<LeadtimeData | null>(null);
  const [leadtimeDays, setLeadtimeDays] = useState(90);
  const [avaliacoesData, setAvaliacoesData] = useState<AvaliacoesData | null>(null);
  const [avaliacoesDays, setAvaliacoesDays] = useState(30);
  const [lostsData, setLostsData] = useState<LostsData | null>(null);
  const [lostsDate, setLostsDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [syncElapsed, setSyncElapsed] = useState<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const sessionId = crypto.randomUUID();
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser({
          email: u.email || "",
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email || "",
        });
        // Carregar role do user_profiles
        supabase
          .from("user_profiles")
          .select("role")
          .eq("email", u.email || "")
          .single()
          .then(({ data: profile }) => {
            if (profile) setUserRole(profile.role as UserRole);
          });
        // Registrar acesso com session_id
        const fullName = u.user_metadata?.full_name || u.user_metadata?.name || null;
        Promise.resolve(supabase.rpc("log_user_access", { p_email: u.email, p_full_name: fullName, p_session_id: sessionId })).catch(() => {});
        // Heartbeat a cada 3 minutos
        heartbeatInterval = setInterval(() => {
          Promise.resolve(supabase.rpc("update_session_heartbeat", { p_session_id: sessionId })).catch(() => {});
        }, 3 * 60 * 1000);
      }
    });

    return () => { if (heartbeatInterval) clearInterval(heartbeatInterval); };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const fetchAcomp = useCallback(async (tab: TabKey, filter: MediaFilter = "all") => {
    setLoading(true);
    try {
      const params = filter === "paid" ? `?tab=${tab}&filter=paid` : `?tab=${tab}`;
      const res = await fetch(`${moduleConfig.apiBase}${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAcompData((prev) => ({ ...prev, [tab]: data }));
    } catch (err) {
      console.error("Fetch acomp error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchAlinh = useCallback(async () => {
    setLoading(true);
    try {
      const [alinhRes, dealsRes] = await Promise.all([
        fetch(`${moduleConfig.apiBase}/alinhamento`),
        fetch(`${moduleConfig.apiBase}/alinhamento/deals`),
      ]);
      if (alinhRes.ok) setAlinhData(await alinhRes.json());
      if (dealsRes.ok) setMisalignedDeals(await dealsRes.json());
    } catch (err) {
      console.error("Fetch alinh error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchCamp = useCallback(async (filter: MediaFilter = "all") => {
    setLoading(true);
    try {
      const params = filter === "paid" ? "?filter=paid" : "";
      const res = await fetch(`${moduleConfig.apiBase}/campanhas${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCampData(await res.json());
    } catch (err) {
      console.error("Fetch camp error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchOcio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/ociosidade`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOcioData(await res.json());
    } catch (err) {
      console.error("Fetch ocio error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchBalanc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/regras-mql`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBalancData(await res.json());
    } catch (err) {
      console.error("Fetch balanc error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchPresales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/presales`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPresalesData(await res.json());
    } catch (err) {
      console.error("Fetch presales error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchFunil = useCallback(async (filter: MediaFilter = "all") => {
    setLoading(true);
    try {
      const params = filter === "paid" ? "?filter=paid" : "";
      const res = await fetch(`${moduleConfig.apiBase}/funil${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFunilData(await res.json());
    } catch (err) {
      console.error("Fetch funil error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const [planejDays, setPlanejDays] = useState(0);

  const fetchPlanej = useCallback(async (days: number = 0) => {
    setLoading(true);
    try {
      const params = days > 0 ? `?days=${days}` : "";
      const res = await fetch(`${moduleConfig.apiBase}/planejamento${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPlanejData(await res.json());
    } catch (err) {
      console.error("Fetch planej error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchOrc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/orcamento`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOrcData(await res.json());
    } catch (err) {
      console.error("Fetch orc error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchPerformance = useCallback(async (days: number = 90) => {
    setLoading(true);
    try {
      const params = days > 0 ? `?days=${days}` : "?days=-1";
      const res = await fetch(`${moduleConfig.apiBase}/performance${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPerfData(await res.json());
    } catch (err) {
      console.error("Fetch performance error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchBaseline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/performance/baseline`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBaselineData(await res.json());
    } catch (err) {
      console.error("Fetch baseline error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchDiagVendas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/diagnostico-vendas`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiagVendasData(await res.json());
    } catch (err) {
      console.error("Fetch diag vendas error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/forecast`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setForecastData(await res.json());
    } catch (err) {
      console.error("Fetch forecast error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchLeadtime = useCallback(async (days: number = 90) => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/leadtime?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeadtimeData(await res.json());
    } catch (err) {
      console.error("Fetch leadtime error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchAvaliacoes = useCallback(async (days: number = 30) => {
    setLoading(true);
    try {
      const res = await fetch(`${moduleConfig.apiBase}/avaliacoes?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAvaliacoesData(await res.json());
    } catch (err) {
      console.error("Fetch avaliacoes error:", err);
    } finally {
      setLoading(false);
    }
  }, [moduleConfig.apiBase]);

  const fetchLosts = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/losts?date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLostsData(await res.json());
    } catch (err) {
      console.error("Fetch losts error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBudgetSave = useCallback(async (value: number) => {
    const now = new Date();
    const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    try {
      await fetch(`${moduleConfig.apiBase}/orcamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, orcamentoTotal: value }),
      });
      fetchOrc();
    } catch (err) {
      console.error("Save budget error:", err);
    }
  }, [fetchOrc, moduleConfig.apiBase]);

  // Re-fetch when mediaFilter changes — impacts all data views
  useEffect(() => {
    if (!hydrated) return;
    // Clear cached campanhas data since filter changed
    setCampData(null);
    if (mainView === "campanhas") {
      fetchCamp(mediaFilter);
    } else if (mainView === "diagnostico-mkt") {
      fetchCamp(mediaFilter);
    }
  }, [mediaFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated) return;
    if (mainView === "acompanhamento" && !acompData[activeTab]) {
      fetchAcomp(activeTab, "all");
    } else if (mainView === "alinhamento" && !alinhData) {
      fetchAlinh();
    } else if (mainView === "ociosidade" && !ocioData) {
      fetchOcio();
    } else if (mainView === "balanceamento") {
      if (!balancData) fetchBalanc();
      if (!ocioData) fetchOcio();
    } else if (mainView === "campanhas" && !campData) {
      fetchCamp(mediaFilter);
    } else if (mainView === "diagnostico-mkt" && !campData) {
      fetchCamp(mediaFilter);
    } else if (mainView === "presales" && !presalesData) {
      fetchPresales();
    } else if (mainView === "resultados" && !funilData) {
      fetchFunil("all");
    } else if (mainView === "planejamento" && !planejData) {
      fetchPlanej(planejDays);
    } else if (mainView === "orcamento" && !orcData) {
      fetchOrc();
    } else if ((mainView === "perf-prevendas" || mainView === "perf-vendas") && !perfData) {
      fetchPerformance(perfDays);
    } else if (mainView === "baseline" && !baselineData) {
      fetchBaseline();
    } else if (mainView === "diagnostico-vendas" && !diagVendasData) {
      fetchDiagVendas();
    } else if (mainView === "forecast" && !forecastData) {
      fetchForecast();
    } else if (mainView === "leadtime" && !leadtimeData) {
      fetchLeadtime(leadtimeDays);
    } else if (mainView === "avaliacoes" && !avaliacoesData) {
      fetchAvaliacoes(avaliacoesDays);
    } else if (mainView === "losts" && !lostsData) {
      fetchLosts(lostsDate);
    }
  }, [activeTab, mainView, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Module change handler — clear caches and persist selection
  const handleModuleChange = (modId: string) => {
    setActiveModule(modId);
    localStorage.setItem("activeModule", modId);
    clearAllCaches();
  };

  const clearAllCaches = () => {
    setAcompData({});
    setAlinhData(null);
    setMisalignedDeals(null);
    setCampData(null);
    setBalancData(null);
    setOcioData(null);
    setPresalesData(null);
    setFunilData(null);
    setPlanejData(null);
    setOrcData(null);
    setPerfData(null);
    setBaselineData(null);
    setDiagVendasData(null);
    setForecastData(null);
    setLeadtimeData(null);
    setAvaliacoesData(null);
    setLostsData(null);
  };

  const fetchCurrentView = async () => {
    if (mainView === "acompanhamento") await fetchAcomp(activeTab, "all");
    else if (mainView === "alinhamento") await fetchAlinh();
    else if (mainView === "ociosidade") await fetchOcio();
    else if (mainView === "balanceamento") { await fetchBalanc(); await fetchOcio(); }
    else if (mainView === "campanhas") await fetchCamp(mediaFilter);
    else if (mainView === "diagnostico-mkt") await fetchCamp(mediaFilter);
    else if (mainView === "presales") await fetchPresales();
    else if (mainView === "resultados") await fetchFunil("all");
    else if (mainView === "planejamento") await fetchPlanej(planejDays);
    else if (mainView === "orcamento") await fetchOrc();
    else if (mainView === "perf-prevendas" || mainView === "perf-vendas") await fetchPerformance(perfDays);
    else if (mainView === "baseline") await fetchBaseline();
    else if (mainView === "diagnostico-vendas") await fetchDiagVendas();
    else if (mainView === "forecast") await fetchForecast();
    else if (mainView === "leadtime") await fetchLeadtime(leadtimeDays);
    else if (mainView === "avaliacoes") await fetchAvaliacoes(avaliacoesDays);
    else if (mainView === "losts") await fetchLosts(lostsDate);
  };

  const handleRefresh = async () => {
    setLoading(true);
    setSyncWarning(null);
    setSyncElapsed(0);
    // Start elapsed timer
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    const startTime = Date.now();
    syncTimerRef.current = setInterval(() => {
      setSyncElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    try {
      const syncRes = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ functions: moduleConfig.syncFunctions }),
      });
      const syncData = await syncRes.json().catch(() => null);
      if (syncData?.results) {
        const failed = (syncData.results as Array<{ function: string; status: string; error?: string }>)
          .filter((r) => r.status === "error");
        if (failed.length > 0) {
          const details = failed.map((f) => `${f.function}: ${f.error || "?"}`).join(" | ");
          setSyncWarning(`Sync parcial: ${details}`);
        }
      }
      // Clear all caches so every tab re-fetches fresh data on visit
      clearAllCaches();
      // Re-fetch the current view immediately
      await fetchCurrentView();
      const now = new Date();
      setLastUpdated(now);
      localStorage.setItem("lastUpdated", now.toISOString());
    } catch (err) {
      console.error("Refresh error:", err);
      setSyncWarning("Erro ao atualizar: a conexão foi interrompida. Os dados podem estar incompletos.");
    } finally {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
      setSyncElapsed(null);
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", letterSpacing: "0.02em" }}>
      <Header mainView={mainView} setMainView={setMainView} onRefresh={handleRefresh} loading={loading} syncElapsed={syncElapsed ?? undefined} lastUpdated={lastUpdated} user={user} onLogout={handleLogout} userRole={userRole} activeModule={activeModule} onModuleChange={handleModuleChange} />
      {syncWarning && (
        <div
          style={{
            margin: "0 20px",
            padding: "10px 16px",
            backgroundColor: T.vermelho50 || "#fef2f2",
            border: `1px solid ${T.destructive}44`,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            maxWidth: "2200px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <span style={{ fontSize: "13px", color: T.destructive, fontWeight: 500 }}>
            {syncWarning}
          </span>
          <button
            onClick={() => setSyncWarning(null)}
            style={{
              background: "none",
              border: "none",
              color: T.destructive,
              cursor: "pointer",
              fontSize: "16px",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ padding: "16px 20px", maxWidth: "2200px", margin: "0 auto" }}>
        {mainView === "acompanhamento" && (
          <AcompanhamentoView
            data={acompData[activeTab] || null}
            activeTab={activeTab}
            setActiveTab={(tab: TabKey) => setActiveTab(tab)}
            loading={loading}
            lastUpdated={lastUpdated}
            moduleId={activeModule}
          />
        )}
        {mainView === "alinhamento" && <AlinhamentoView data={alinhData} misalignedDeals={misalignedDeals} loading={loading} moduleConfig={moduleConfig} lastUpdated={lastUpdated} />}
        {mainView === "ociosidade" && <OciosidadeView data={ocioData} loading={loading} lastUpdated={lastUpdated} />}
        {mainView === "balanceamento" && <BalanceamentoView data={balancData} ocioData={ocioData} loading={loading} lastUpdated={lastUpdated} />}
        {mainView === "campanhas" && <CampanhasView data={campData} loading={loading} mediaFilter={mediaFilter} setMediaFilter={setMediaFilter} lastUpdated={lastUpdated} moduleId={activeModule} />}
        {mainView === "presales" && <PresalesView data={presalesData} loading={loading} moduleConfig={moduleConfig} lastUpdated={lastUpdated} />}
        {mainView === "resultados" && <ResultadosView data={funilData} loading={loading} lastUpdated={lastUpdated} moduleId={activeModule} />}
        {mainView === "diagnostico-mkt" && <DiagnosticoMktView data={campData} loading={loading} mediaFilter={mediaFilter} setMediaFilter={setMediaFilter} moduleConfig={moduleConfig} lastUpdated={lastUpdated} />}
        {mainView === "planejamento" && <PlanejamentoView data={planejData} loading={loading} daysBack={planejDays} onDaysChange={(d) => { setPlanejDays(d); setPlanejData(null); fetchPlanej(d); }} moduleConfig={moduleConfig} lastUpdated={lastUpdated} />}
        {mainView === "orcamento" && <OrcamentoView data={orcData} loading={loading} onBudgetSave={handleBudgetSave} lastUpdated={lastUpdated} moduleId={activeModule} />}
        {mainView === "perf-prevendas" && <PerformancePreVendasView data={perfData} loading={loading} daysBack={perfDays} onDaysChange={(d) => { setPerfDays(d); setPerfData(null); fetchPerformance(d); }} moduleConfig={moduleConfig} lastUpdated={lastUpdated} />}
        {mainView === "perf-vendas" && <PerformanceVendasView data={perfData} loading={loading} daysBack={perfDays} onDaysChange={(d) => { setPerfDays(d); setPerfData(null); fetchPerformance(d); }} moduleConfig={moduleConfig} lastUpdated={lastUpdated} />}
        {mainView === "baseline" && <BaselineView data={baselineData} loading={loading} lastUpdated={lastUpdated} />}
        {mainView === "diagnostico-vendas" && <DiagnosticoVendasView data={diagVendasData} loading={loading} moduleConfig={moduleConfig} lastUpdated={lastUpdated} />}
        {mainView === "forecast" && <ForecastView data={forecastData} loading={loading} lastUpdated={lastUpdated} />}
        {mainView === "leadtime" && <LeadtimeView data={leadtimeData} loading={loading} daysBack={leadtimeDays} onDaysChange={(d) => { setLeadtimeDays(d); setLeadtimeData(null); fetchLeadtime(d); }} lastUpdated={lastUpdated} />}
        {mainView === "avaliacoes" && <AvaliacoesView data={avaliacoesData} loading={loading} daysBack={avaliacoesDays} onDaysChange={(d) => { setAvaliacoesDays(d); setAvaliacoesData(null); fetchAvaliacoes(d); }} lastUpdated={lastUpdated} />}
        {mainView === "otimizacao" && <OtimizacaoView />}
        {mainView === "explorador" && <ExploradorView />}
        {mainView === "losts" && (
          <LostsView
            data={lostsData}
            loading={loading}
            lastUpdated={lastUpdated}
            lostsDate={lostsDate}
            onDateChange={(d) => { setLostsDate(d); setLostsData(null); fetchLosts(d); }}
          />
        )}
        {mainView === "backlog" && <BacklogView />}
        {mainView === "admin" && <AdminView userRole={userRole} />}
        {mainView === "squad-atividades" && <SquadAtividadesView pipelineSlug={moduleConfig.id} dateFrom="" dateTo="" />}
        {mainView === "venda" && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <p style={{ fontSize: "16px" }}>Aba Venda — em construção</p>
          </div>
        )}
      </div>
    </div>
  );
}
