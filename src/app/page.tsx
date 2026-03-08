"use client";

import { useState, useCallback, useEffect } from "react";
import { T } from "@/lib/constants";
import type { TabKey, AcompanhamentoData, AlinhamentoData, CampanhasData, RegrasMqlData, OciosidadeData, PresalesData } from "@/lib/types";
import { Header } from "@/components/dashboard/header";
import { AcompanhamentoView } from "@/components/dashboard/acompanhamento-view";
import { AlinhamentoView } from "@/components/dashboard/alinhamento-view";
import { BalanceamentoView } from "@/components/dashboard/balanceamento-view";
import { CampanhasView } from "@/components/dashboard/campanhas-view";
import { OciosidadeView } from "@/components/dashboard/ociosidade-view";
import { PresalesView } from "@/components/dashboard/presales-view";

export default function Dashboard() {
  const [mainView, setMainView] = useState("acompanhamento");
  const [activeTab, setActiveTab] = useState<TabKey>("mql");
  const [loading, setLoading] = useState(false);
  const [acompData, setAcompData] = useState<Record<string, AcompanhamentoData>>({});
  const [alinhData, setAlinhData] = useState<AlinhamentoData | null>(null);
  const [campData, setCampData] = useState<CampanhasData | null>(null);
  const [balancData, setBalancData] = useState<RegrasMqlData | null>(null);
  const [ocioData, setOcioData] = useState<OciosidadeData | null>(null);
  const [presalesData, setPresalesData] = useState<PresalesData | null>(null);

  const fetchAcomp = useCallback(async (tab: TabKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAcompData((prev) => ({ ...prev, [tab]: data }));
    } catch (err) {
      console.error("Fetch acomp error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlinh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/alinhamento");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAlinhData(await res.json());
    } catch (err) {
      console.error("Fetch alinh error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCamp = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/campanhas");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCampData(await res.json());
    } catch (err) {
      console.error("Fetch camp error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOcio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/ociosidade");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOcioData(await res.json());
    } catch (err) {
      console.error("Fetch ocio error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBalanc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/regras-mql");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBalancData(await res.json());
    } catch (err) {
      console.error("Fetch balanc error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPresales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/presales");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPresalesData(await res.json());
    } catch (err) {
      console.error("Fetch presales error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainView === "acompanhamento" && !acompData[activeTab]) {
      fetchAcomp(activeTab);
    } else if (mainView === "alinhamento" && !alinhData) {
      fetchAlinh();
    } else if (mainView === "ociosidade" && !ocioData) {
      fetchOcio();
    } else if (mainView === "balanceamento") {
      if (!balancData) fetchBalanc();
      if (!ocioData) fetchOcio();
    } else if (mainView === "campanhas" && !campData) {
      fetchCamp();
    } else if (mainView === "presales" && !presalesData) {
      fetchPresales();
    }
  }, [activeTab, mainView]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (mainView === "acompanhamento") fetchAcomp(activeTab);
    else if (mainView === "alinhamento") fetchAlinh();
    else if (mainView === "ociosidade") fetchOcio();
    else if (mainView === "balanceamento") fetchBalanc();
    else if (mainView === "campanhas") fetchCamp();
    else if (mainView === "presales") fetchPresales();
  };

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", letterSpacing: "0.02em" }}>
      <Header mainView={mainView} setMainView={setMainView} onRefresh={handleRefresh} loading={loading} />
      <div style={{ padding: "16px 20px", maxWidth: "2200px", margin: "0 auto" }}>
        {mainView === "acompanhamento" && (
          <AcompanhamentoView
            data={acompData[activeTab] || null}
            activeTab={activeTab}
            setActiveTab={(tab: TabKey) => setActiveTab(tab)}
            loading={loading}
          />
        )}
        {mainView === "alinhamento" && <AlinhamentoView data={alinhData} loading={loading} />}
        {mainView === "ociosidade" && <OciosidadeView data={ocioData} loading={loading} />}
        {mainView === "balanceamento" && <BalanceamentoView data={balancData} ocioData={ocioData} loading={loading} />}
        {mainView === "campanhas" && <CampanhasView data={campData} loading={loading} />}
        {mainView === "presales" && <PresalesView data={presalesData} loading={loading} />}
      </div>
    </div>
  );
}
