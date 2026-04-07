"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash2, Send } from "lucide-react";
import { T } from "@/lib/constants";
import type { BacklogTask, BacklogComment } from "@/lib/types";

interface UserOption {
  id: string;
  full_name: string;
}

interface TaskModalProps {
  task: BacklogTask | null; // null = creating new
  users: UserOption[];
  onClose: () => void;
  onSave: (data: Partial<BacklogTask>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function TaskModal({ task, users, onClose, onSave, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [type, setType] = useState<"feature" | "bug">(task?.type || "feature");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || "");
  const [definitionOfDone, setDefinitionOfDone] = useState(task?.definition_of_done || "");
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<BacklogComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!task) return;
    try {
      const res = await fetch(`/api/backlog/comments?task_id=${task.id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {}
  }, [task]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(task ? { id: task.id } : {}),
        title: title.trim(),
        description,
        type,
        assigned_to: assignedTo || null,
        definition_of_done: definitionOfDone,
        due_date: dueDate || null,
      });
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    await onDelete(task.id);
    onClose();
  };

  const handleSendComment = async () => {
    if (!task || !newComment.trim()) return;
    setSendingComment(true);
    try {
      const res = await fetch("/api/backlog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, content: newComment.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } catch {} finally {
      setSendingComment(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: T.mutedFg,
    display: "block",
    marginBottom: "4px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: `1px solid ${T.border}`,
    fontSize: "13px",
    color: T.fg,
    outline: "none",
    fontFamily: T.font,
    boxSizing: "border-box",
  };

  return (
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: T.bg,
          borderRadius: "16px",
          width: "min(580px, 95vw)",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: T.fg, margin: 0 }}>
            {task ? "Editar Task" : "Nova Task"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg, padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Título da task" />
          </div>

          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Descreva a task..."
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as "feature" | "bug")} style={inputStyle}>
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Responsável</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={inputStyle}>
                <option value="">Nenhum</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Definição de Pronto</label>
            <textarea
              value={definitionOfDone}
              onChange={(e) => setDefinitionOfDone(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="O que precisa estar pronto..."
            />
          </div>

          <div>
            <label style={labelStyle}>Data Esperada</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>

          {/* Comments (only for existing tasks) */}
          {task && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "16px" }}>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>Comentários ({comments.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflow: "auto", marginBottom: "8px" }}>
                {comments.map((c) => (
                  <div key={c.id} style={{ backgroundColor: T.cinza50, borderRadius: "8px", padding: "8px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: T.fg }}>{c.author_name}</span>
                      <span style={{ fontSize: "10px", color: T.mutedFg }}>
                        {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: T.cardFg, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{c.content}</div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div style={{ fontSize: "12px", color: T.mutedFg, textAlign: "center", padding: "12px" }}>
                    Nenhum comentário
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Adicionar comentário..."
                />
                <button
                  onClick={handleSendComment}
                  disabled={sendingComment || !newComment.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: T.azul600,
                    color: "#FFF",
                    fontSize: "12px",
                    cursor: "pointer",
                    opacity: sendingComment || !newComment.trim() ? 0.5 : 1,
                  }}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderTop: `1px solid ${T.border}` }}>
          <div>
            {task && onDelete && (
              confirmDelete ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: T.destructive }}>Confirmar exclusão?</span>
                  <button
                    onClick={handleDelete}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: T.destructive,
                      color: "#FFF",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${T.border}`,
                      backgroundColor: "transparent",
                      color: T.mutedFg,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${T.vermelho100}`,
                    backgroundColor: "transparent",
                    color: T.destructive,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={12} /> Excluir
                </button>
              )
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: `1px solid ${T.border}`,
                backgroundColor: "transparent",
                color: T.mutedFg,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: T.azul600,
                color: "#FFF",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                opacity: saving || !title.trim() ? 0.5 : 1,
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
