"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { T } from "@/lib/constants";

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      // Salvar token em cookie para o middleware consumir após OAuth
      document.cookie = `invite_token=${token}; path=/; max-age=3600; SameSite=Lax`;
    }
  }, [token]);

  const handleLogin = async () => {
    if (!token) return;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "seazone.com.br" },
      },
    });
  };

  if (!token) {
    return (
      <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ backgroundColor: T.card, borderRadius: "16px", border: `1px solid ${T.border}`, padding: "48px 40px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 600, color: T.destructive }}>Link inválido</h1>
          <p style={{ fontSize: "14px", color: T.mutedFg, marginTop: "8px" }}>Este link de convite não é válido.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: T.card, borderRadius: "16px", border: `1px solid ${T.border}`, boxShadow: T.elevSm, padding: "48px 40px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: T.fg, margin: "0 0 8px 0" }}>
          Você foi convidado!
        </h1>
        <p style={{ fontSize: "14px", color: T.mutedFg, margin: "0 0 32px 0" }}>
          Acesse o Acompanhamento de Vendas com seu email @seazone.com.br
        </p>
        <button
          onClick={handleLogin}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
            width: "100%", padding: "12px 24px", backgroundColor: T.azul600, color: "#FFF",
            border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 500, cursor: "pointer",
          }}
        >
          Aceitar Convite
        </button>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return <Suspense><InviteContent /></Suspense>;
}
