"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, UserPlus, Shield, Edit2, UserX, Trash2, BarChart3, Link2, Copy, Check, Github } from "lucide-react";
import { T } from "@/lib/constants";
import type { UserProfile, UserInvitation, UserRole } from "@/lib/types";

interface AdminViewProps {
  userRole: UserRole | null;
}

export function AdminView({ userRole }: AdminViewProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [analytics, setAnalytics] = useState<Array<{ email: string; full_name: string | null; total_accesses: number; last_access: string; first_access: string; accesses_last_7d: number; accesses_last_30d: number; avg_session_minutes: number | null; total_time_7d_minutes: number | null }>>([]);
  const [recentAccesses, setRecentAccesses] = useState<Array<{ email: string; full_name: string | null; accessed_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("operador");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("operador");
  const [editingGithubId, setEditingGithubId] = useState<string | null>(null);
  const [editGithub, setEditGithub] = useState("");
  const [inviteLinks, setInviteLinks] = useState<Array<{ id: string; token: string; role: string; created_by: string; max_uses: number; used_count: number; active: boolean; created_at: string; expires_at: string }>>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) return;
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const data = await res.json();
      setProfiles(data.profiles || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics || []);
        setRecentAccesses(data.recent || []);
      }
    } catch {}
  }, []);

  const fetchInviteLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invite-links");
      if (res.ok) {
        const data = await res.json();
        setInviteLinks(data.links || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchAnalytics(); fetchInviteLinks(); }, [fetchData, fetchAnalytics, fetchInviteLinks]);

  if (userRole !== "diretor") {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "16px" }}>Acesso restrito a diretores.</p>
      </div>
    );
  }

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch("/api/admin/invite-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "operador", max_uses: 0, expires_in_days: 7 }),
      });
      if (!res.ok) throw new Error("Erro ao gerar link");
      fetchInviteLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleDeactivateLink = async (id: string) => {
    try {
      await fetch("/api/admin/invite-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchInviteLinks();
    } catch {}
  };

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInvite = async () => {
    if (!formEmail || !formName) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formEmail, full_name: formName, role: formRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao convidar");
      setShowModal(false);
      setFormEmail("");
      setFormName("");
      setFormRole("operador");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (id: string, role: UserRole) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      setEditingId(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleUpdateGithub = async (id: string, github_username: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, github_username }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      setEditingGithubId(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleCancelInvite = async (id: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "invitation" }),
      });
      if (!res.ok) throw new Error("Erro ao cancelar convite");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatDuration = (minutes: number): string => {
    if (minutes < 1) return "<1min";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  const roleBadge = (role: UserRole) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 10px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: role === "diretor" ? T.azul50 : T.cinza50,
        color: role === "diretor" ? T.azul600 : T.cinza700,
      }}
    >
      {role === "diretor" && <Shield size={10} />}
      {role === "diretor" ? "Diretor" : "Operador"}
    </span>
  );

  const statusBadge = (status: string) => (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: status === "active" ? T.verde50 : T.vermelho50,
        color: status === "active" ? T.verde700 : T.destructive,
      }}
    >
      {status === "active" ? "Ativo" : "Inativo"}
    </span>
  );

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    fontSize: "11px",
    fontWeight: 600,
    color: T.mutedFg,
    textTransform: "uppercase",
    textAlign: "left",
    borderBottom: `1px solid ${T.border}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 16px",
    fontSize: "13px",
    color: T.fg,
    borderBottom: `1px solid ${T.cinza50}`,
  };

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "5px 10px",
    borderRadius: "6px",
    border: `1px solid ${T.border}`,
    backgroundColor: "transparent",
    color: T.mutedFg,
    fontSize: "12px",
    cursor: "pointer",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: T.mutedFg }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header with invite button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: 0 }}>Gerenciamento de Usuários</h1>
          <span style={{ fontSize: "12px", color: T.mutedFg }}>Controle de acesso por convite</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: T.azul600,
            color: "#FFF",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <Plus size={14} /> Convidar Usuário
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: T.vermelho50,
            border: `1px solid ${T.vermelho100}`,
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "13px",
            color: T.destructive,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.destructive }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Usuários Ativos */}
      <div
        style={{
          backgroundColor: T.bg,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          marginBottom: "20px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
          <UserPlus size={16} color={T.azul600} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, margin: 0 }}>
            Usuários ({profiles.length})
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Papel</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Desde</th>
              <th style={thStyle}>GitHub</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{p.full_name}</td>
                <td style={{ ...tdStyle, color: T.mutedFg }}>{p.email}</td>
                <td style={tdStyle}>
                  {editingId === p.id ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      onBlur={() => { handleUpdateRole(p.id, editRole); }}
                      autoFocus
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: `1px solid ${T.border}`,
                        fontSize: "12px",
                        outline: "none",
                      }}
                    >
                      <option value="operador">Operador</option>
                      <option value="diretor">Diretor</option>
                    </select>
                  ) : (
                    roleBadge(p.role)
                  )}
                </td>
                <td style={tdStyle}>{statusBadge(p.status)}</td>
                <td style={{ ...tdStyle, color: T.mutedFg, fontSize: "12px" }}>{formatDate(p.created_at)}</td>
                <td style={tdStyle}>
                  {editingGithubId === p.id ? (
                    <input
                      value={editGithub}
                      onChange={(e) => setEditGithub(e.target.value)}
                      onBlur={() => { handleUpdateGithub(p.id, editGithub); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { handleUpdateGithub(p.id, editGithub); } if (e.key === "Escape") { setEditingGithubId(null); } }}
                      autoFocus
                      placeholder="username"
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: `1px solid ${T.border}`,
                        fontSize: "12px",
                        outline: "none",
                        width: "120px",
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingGithubId(p.id); setEditGithub((p as UserProfile & { github_username?: string }).github_username || ""); }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        border: `1px solid ${T.border}`,
                        backgroundColor: "transparent",
                        color: (p as UserProfile & { github_username?: string }).github_username ? T.fg : T.mutedFg,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      <Github size={11} />
                      {(p as UserProfile & { github_username?: string }).github_username || "—"}
                    </button>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { setEditingId(p.id); setEditRole(p.role); }}
                      style={btnStyle}
                      title="Editar papel"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(p.id, p.status)}
                      style={{ ...btnStyle, color: p.status === "active" ? T.destructive : T.verde700, borderColor: p.status === "active" ? T.vermelho100 : T.verde50 }}
                      title={p.status === "active" ? "Desativar" : "Reativar"}
                    >
                      <UserX size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: T.mutedFg }}>
                  Nenhum usuário cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Convites Pendentes */}
      <div
        style={{
          backgroundColor: T.bg,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
          <Shield size={16} color={T.laranja500} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, margin: 0 }}>
            Convites Pendentes ({invitations.length})
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Papel</th>
              <th style={thStyle}>Convidado por</th>
              <th style={thStyle}>Expira em</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{inv.email}</td>
                <td style={tdStyle}>{roleBadge(inv.role)}</td>
                <td style={{ ...tdStyle, color: T.mutedFg }}>{inv.invited_by}</td>
                <td style={{ ...tdStyle, color: T.mutedFg, fontSize: "12px" }}>{formatDate(inv.expires_at)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <button
                    onClick={() => handleCancelInvite(inv.id)}
                    style={{ ...btnStyle, color: T.destructive, borderColor: T.vermelho100 }}
                    title="Cancelar convite"
                  >
                    <Trash2 size={12} /> Cancelar
                  </button>
                </td>
              </tr>
            ))}
            {invitations.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: T.mutedFg }}>
                  Nenhum convite pendente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Links de Convite */}
      <div
        style={{
          backgroundColor: T.bg,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          marginTop: "20px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
          <Link2 size={16} color={T.azul600} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, margin: 0 }}>
            Links de Convite
          </h2>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleGenerateLink}
            disabled={generatingLink}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "8px", border: "none",
              backgroundColor: generatingLink ? T.cinza300 : T.azul600,
              color: "#FFF", fontSize: "12px", fontWeight: 500, cursor: generatingLink ? "not-allowed" : "pointer",
            }}
          >
            <Plus size={12} /> {generatingLink ? "Gerando..." : "Gerar Link"}
          </button>
        </div>
        <div style={{ padding: "12px 16px", fontSize: "12px", color: T.mutedFg, borderBottom: `1px solid ${T.cinza50}` }}>
          Links válidos por 7 dias. Qualquer pessoa com email @seazone.com.br pode usar.
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Link</th>
              <th style={thStyle}>Papel</th>
              <th style={thStyle}>Criado por</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Usos</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Expira em</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {inviteLinks.map((link) => {
              const isExpired = new Date(link.expires_at) < new Date();
              const isActive = link.active && !isExpired;
              return (
                <tr key={link.id}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "11px", color: T.mutedFg }}>
                    ...{link.token.slice(-8)}
                  </td>
                  <td style={tdStyle}>{roleBadge(link.role as UserRole)}</td>
                  <td style={{ ...tdStyle, color: T.mutedFg, fontSize: "12px" }}>{link.created_by.split("@")[0]}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {link.used_count}{link.max_uses > 0 ? `/${link.max_uses}` : ""}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600,
                      backgroundColor: isActive ? T.verde50 : T.vermelho50,
                      color: isActive ? T.verde700 : T.destructive,
                    }}>
                      {isActive ? "Ativo" : isExpired ? "Expirado" : "Desativado"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: T.mutedFg, fontSize: "12px" }}>{formatDate(link.expires_at)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {isActive && (
                        <>
                          <button
                            onClick={() => copyLink(link.token, link.id)}
                            style={{ ...btnStyle, color: copiedId === link.id ? T.verde700 : T.azul600, borderColor: copiedId === link.id ? T.verde50 : T.azul50 }}
                            title="Copiar link"
                          >
                            {copiedId === link.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === link.id ? "Copiado" : "Copiar"}
                          </button>
                          <button
                            onClick={() => handleDeactivateLink(link.id)}
                            style={{ ...btnStyle, color: T.destructive, borderColor: T.vermelho100 }}
                            title="Desativar"
                          >
                            <X size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {inviteLinks.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: T.mutedFg }}>
                  Nenhum link gerado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Analytics de Acesso */}
      <div
        style={{
          backgroundColor: T.bg,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          marginTop: "20px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
          <BarChart3 size={16} color={T.teal600} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, margin: 0 }}>
            Analytics de Acesso
          </h2>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Usuário</th>
              <th style={thStyle}>Email</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Últimos 7d</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Últimos 30d</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Sessão Média</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Tempo 7d</th>
              <th style={thStyle}>Último Acesso</th>
              <th style={thStyle}>Primeiro Acesso</th>
            </tr>
          </thead>
          <tbody>
            {analytics.map((a) => (
              <tr key={a.email}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{a.full_name || "—"}</td>
                <td style={{ ...tdStyle, color: T.mutedFg }}>{a.email}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: a.accesses_last_7d > 0 ? T.azul600 : T.cinza300 }}>
                  {a.accesses_last_7d}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: a.accesses_last_30d > 0 ? T.teal600 : T.cinza300 }}>
                  {a.accesses_last_30d}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{a.total_accesses}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px", color: T.fg }}>
                  {a.avg_session_minutes != null ? formatDuration(a.avg_session_minutes) : "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px", fontWeight: 600, color: T.teal600 }}>
                  {a.total_time_7d_minutes != null ? formatDuration(a.total_time_7d_minutes) : "—"}
                </td>
                <td style={{ ...tdStyle, color: T.mutedFg, fontSize: "12px" }}>
                  {new Date(a.last_access).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às{" "}
                  {new Date(a.last_access).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ ...tdStyle, color: T.mutedFg, fontSize: "12px" }}>
                  {formatDate(a.first_access)}
                </td>
              </tr>
            ))}
            {analytics.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: T.mutedFg }}>
                  Nenhum acesso registrado ainda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Acessos Recentes */}
      {recentAccesses.length > 0 && (
        <div
          style={{
            backgroundColor: T.bg,
            borderRadius: "12px",
            border: `1px solid ${T.border}`,
            boxShadow: T.elevSm,
            marginTop: "20px",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={16} color={T.mutedFg} />
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, margin: 0 }}>
              Acessos Recentes
            </h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Usuário</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {recentAccesses.map((a, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{a.full_name || "—"}</td>
                  <td style={{ ...tdStyle, color: T.mutedFg }}>{a.email}</td>
                  <td style={{ ...tdStyle, color: T.mutedFg, fontSize: "12px" }}>
                    {new Date(a.accessed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às{" "}
                    {new Date(a.accessed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Convidar */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            style={{
              backgroundColor: T.bg,
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              padding: "28px",
              maxWidth: "440px",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 600, color: T.fg, margin: 0 }}>Convidar Usuário</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: T.mutedFg, display: "block", marginBottom: "4px" }}>Email</label>
                <input
                  type="email"
                  placeholder="nome@seazone.com.br"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${T.border}`,
                    fontSize: "14px",
                    color: T.fg,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: T.mutedFg, display: "block", marginBottom: "4px" }}>Nome completo</label>
                <input
                  type="text"
                  placeholder="Nome Sobrenome"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${T.border}`,
                    fontSize: "14px",
                    color: T.fg,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: T.mutedFg, display: "block", marginBottom: "4px" }}>Papel</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${T.border}`,
                    fontSize: "14px",
                    color: T.fg,
                    outline: "none",
                    backgroundColor: T.bg,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="operador">Operador</option>
                  <option value="diretor">Diretor</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: `1px solid ${T.border}`,
                  backgroundColor: "transparent",
                  color: T.mutedFg,
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleInvite}
                disabled={submitting || !formEmail || !formName}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: submitting ? T.cinza300 : T.azul600,
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Enviando..." : "Enviar Convite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
