"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, RefreshCw, BarChart3, Users, Clock, Scale, Megaphone, Timer, ShoppingCart, Activity, LogOut, TrendingUp, Target, Wallet, ChevronDown } from "lucide-react";
import { T } from "@/lib/constants";
import { pillBtnStyle, pillBtnPrimaryStyle, viewBtnStyle } from "./ui";

const META_ADS_VIEWS = ["campanhas", "diagnostico-mkt", "orcamento", "planejamento"] as const;
const VENDAS_VIEWS = ["perf-vendas", "baseline"] as const;

const SeazoneIcon = () => (
  <svg width="28" height="29" viewBox="0 0 48 49" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M46.2131 15.1755L37.6794 10.1673C37.6977 10.0485 37.7528 9.9388 37.7528 9.81999V2.2665C37.7528 1.01444 36.7342 0 35.4771 0H30.9257C29.6686 0 28.6501 1.01444 28.6501 2.2665V4.90314L25.5531 3.09816C24.296 2.34876 22.6397 2.4767 21.4744 3.33578L21.4147 3.35863L1.78243 14.7003C0.144493 15.6736-0.539125 17.9355 0.479423 19.6308C1.53468 21.3901 3.86081 21.8654 5.49416 20.892L6.6687 20.2157C5.27852 22.9255 4.41138 25.9871 4.41138 29.3275C4.41138 34.6099 6.44848 39.8146 10.2107 43.5662C11.688 45.0422 13.4086 46.276 15.2942 47.1853C16.7441 47.8845 18.2765 48.4694 19.8685 48.7618C21.979 49.1457 24.1629 48.9492 26.2964 48.9537C28.5996 48.9537 30.9074 48.9583 33.2106 48.9629C35.2982 48.9674 37.3857 48.9766 39.4962 48.9811C40.0239 48.9811 40.5423 48.8441 41.0103 48.6064C41.6113 48.3003 41.9692 47.9667 42.3638 47.4412C42.8134 46.8472 43.1254 46.1297 43.1254 45.3621V21.582C44.6899 22.1441 46.5894 21.6552 47.5207 20.1015C48.5393 18.4062 47.8557 16.1443 46.2131 15.171M36.3947 29.7022C36.3947 36.9312 31.4809 42.8077 24.0712 42.8077C16.6615 42.8077 11.2155 36.5565 11.2155 29.3275C11.2155 22.0984 16.6615 16.0757 24.0712 16.0757C31.4809 16.0757 36.3947 21.6506 36.3947 28.802V29.7067V29.7022Z"
      fill="#FC6058"
    />
  </svg>
);

interface HeaderProps {
  mainView: string;
  setMainView: (v: string) => void;
  onRefresh: () => void;
  loading: boolean;
  lastUpdated?: Date | null;
  user?: { email: string; name: string };
  onLogout?: () => void;
}

export function Header({ mainView, setMainView, onRefresh, loading, lastUpdated, user, onLogout }: HeaderProps) {
  const [metaDropdownOpen, setMetaDropdownOpen] = useState(false);
  const metaDropdownRef = useRef<HTMLDivElement>(null);
  const isMetaAdsView = (META_ADS_VIEWS as readonly string[]).includes(mainView);

  const [vendasDropdownOpen, setVendasDropdownOpen] = useState(false);
  const vendasDropdownRef = useRef<HTMLDivElement>(null);
  const isVendasView = (VENDAS_VIEWS as readonly string[]).includes(mainView);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (metaDropdownRef.current && !metaDropdownRef.current.contains(e.target as Node)) {
        setMetaDropdownOpen(false);
      }
      if (vendasDropdownRef.current && !vendasDropdownRef.current.contains(e.target as Node)) {
        setVendasDropdownOpen(false);
      }
    }
    if (metaDropdownOpen || vendasDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [metaDropdownOpen, vendasDropdownOpen]);

  return (
    <header
      style={{
        backgroundColor: T.bg,
        borderBottom: `1px solid ${T.border}`,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <SeazoneIcon />
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: "17px", fontWeight: 500, color: T.fg, margin: 0 }}>Acompanhamento de Vendas</h4>
        <span style={{ fontSize: "11px", fontWeight: 400, color: T.mutedFg }}>Squads Manual · Pipeline SZI</span>
      </div>
      <div
        style={{
          display: "flex",
          gap: "2px",
          backgroundColor: T.cinza50,
          borderRadius: "9999px",
          padding: "3px",
          border: `1px solid ${T.border}`,
        }}
      >
        <button
          onClick={() => setMainView("resultados")}
          style={{
            ...viewBtnStyle,
            backgroundColor: mainView === "resultados" ? T.fg : "transparent",
            color: mainView === "resultados" ? "#FFF" : T.cinza600,
          }}
        >
          <TrendingUp size={12} /> Resultados
        </button>
        <div ref={metaDropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMetaDropdownOpen((v) => !v)}
            style={{
              ...viewBtnStyle,
              backgroundColor: isMetaAdsView ? T.fg : "transparent",
              color: isMetaAdsView ? "#FFF" : T.cinza600,
              gap: "4px",
            }}
          >
            <Megaphone size={12} /> Meta Ads <ChevronDown size={10} style={{ transition: "transform 0.2s", transform: metaDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
          {metaDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                backgroundColor: "#FFF",
                border: `1px solid ${T.border}`,
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 50,
                minWidth: "180px",
                padding: "4px",
              }}
            >
              {([
                { key: "campanhas", label: "Campanhas", icon: <Megaphone size={13} /> },
                { key: "diagnostico-mkt", label: "Diagnóstico Mkt", icon: <Activity size={13} /> },
                { key: "orcamento", label: "Orçamento", icon: <Wallet size={13} /> },
                { key: "planejamento", label: "Planejamento", icon: <Target size={13} /> },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setMainView(item.key); setMetaDropdownOpen(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    borderRadius: "6px",
                    backgroundColor: mainView === item.key ? T.azul50 : "transparent",
                    color: mainView === item.key ? T.fg : T.cinza600,
                    fontWeight: mainView === item.key ? 600 : 400,
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (mainView !== item.key) (e.currentTarget.style.backgroundColor = T.cinza50); }}
                  onMouseLeave={(e) => { if (mainView !== item.key) (e.currentTarget.style.backgroundColor = "transparent"); }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setMainView("alinhamento")}
          style={{
            ...viewBtnStyle,
            backgroundColor: mainView === "alinhamento" ? T.fg : "transparent",
            color: mainView === "alinhamento" ? "#FFF" : T.cinza600,
          }}
        >
          <Users size={12} /> Alinhamento Squad
        </button>
        <button
          onClick={() => setMainView("acompanhamento")}
          style={{
            ...viewBtnStyle,
            backgroundColor: mainView === "acompanhamento" ? T.fg : "transparent",
            color: mainView === "acompanhamento" ? "#FFF" : T.cinza600,
          }}
        >
          <BarChart3 size={12} /> Acompanhamento
        </button>
        <button
          onClick={() => setMainView("presales")}
          style={{
            ...viewBtnStyle,
            backgroundColor: mainView === "presales" ? T.fg : "transparent",
            color: mainView === "presales" ? "#FFF" : T.cinza600,
          }}
        >
          <Timer size={12} /> Pré-Venda
        </button>
        <button
          onClick={() => setMainView("ociosidade")}
          style={{
            ...viewBtnStyle,
            backgroundColor: mainView === "ociosidade" ? T.fg : "transparent",
            color: mainView === "ociosidade" ? "#FFF" : T.cinza600,
          }}
        >
          <Clock size={12} /> Ociosidade
        </button>
        <button
          onClick={() => setMainView("balanceamento")}
          style={{
            ...viewBtnStyle,
            backgroundColor: mainView === "balanceamento" ? T.fg : "transparent",
            color: mainView === "balanceamento" ? "#FFF" : T.cinza600,
          }}
        >
          <Scale size={12} /> Balanceamento
        </button>
        <button
          onClick={() => setMainView("perf-prevendas")}
          style={{
            ...viewBtnStyle,
            backgroundColor: mainView === "perf-prevendas" ? T.fg : "transparent",
            color: mainView === "perf-prevendas" ? "#FFF" : T.cinza600,
          }}
        >
          <BarChart3 size={12} /> Perf. Pré-Vendas
        </button>
        <div ref={vendasDropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setVendasDropdownOpen((v) => !v)}
            style={{
              ...viewBtnStyle,
              backgroundColor: isVendasView ? T.fg : "transparent",
              color: isVendasView ? "#FFF" : T.cinza600,
              gap: "4px",
            }}
          >
            <ShoppingCart size={12} /> Perf. Vendas <ChevronDown size={10} style={{ transition: "transform 0.2s", transform: vendasDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
          {vendasDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                backgroundColor: "#FFF",
                border: `1px solid ${T.border}`,
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 50,
                minWidth: "180px",
                padding: "4px",
              }}
            >
              {([
                { key: "perf-vendas", label: "Perf. Vendas", icon: <ShoppingCart size={13} /> },
                { key: "baseline", label: "Base-Line", icon: <BarChart3 size={13} /> },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setMainView(item.key); setVendasDropdownOpen(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    borderRadius: "6px",
                    backgroundColor: mainView === item.key ? T.azul50 : "transparent",
                    color: mainView === item.key ? T.fg : T.cinza600,
                    fontWeight: mainView === item.key ? 600 : 400,
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (mainView !== item.key) (e.currentTarget.style.backgroundColor = T.cinza50); }}
                  onMouseLeave={(e) => { if (mainView !== item.key) (e.currentTarget.style.backgroundColor = "transparent"); }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button style={pillBtnStyle()}>
        <Calendar size={13} /> 4 semanas
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button onClick={onRefresh} disabled={loading} style={pillBtnPrimaryStyle()}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> {loading ? "Atualizando..." : "Atualizar"}
        </button>
        {lastUpdated && (
          <span style={{ fontSize: "11px", color: T.mutedFg, whiteSpace: "nowrap" }}>
            Última atualização: {lastUpdated.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "4px", flexShrink: 0 }}>
          <span style={{ fontSize: "12px", color: T.mutedFg, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.name || user.email}
          </span>
          <button
            onClick={onLogout}
            title="Sair"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              borderRadius: "9999px",
              border: `1px solid ${T.border}`,
              backgroundColor: "transparent",
              color: T.mutedFg,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <LogOut size={12} /> Sair
          </button>
        </div>
      )}
    </header>
  );
}
