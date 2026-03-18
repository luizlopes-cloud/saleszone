"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bug, Sparkles, Calendar, User, Trash2, Send, X } from "lucide-react";
import { T } from "@/lib/constants";
import type { BacklogTask, BacklogComment } from "@/lib/types";

interface UserOption {
  id: string;
  full_name: string;
}

interface TaskCardProps {
  task: BacklogTask;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (fields: Partial<BacklogTask>) => void;
  onDelete: (id: string) => void;
  users: UserOption[];
}

function DueBadge({ due_date }: { due_date: string | null }) {
  if (!due_date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(due_date + "T12:00:00");
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const isOverdue = daysUntilDue < 0;
  const isUrgent = daysUntilDue >= 0 && daysUntilDue < 3;

  let dueBg: string = T.cinza50;
  let dueFg: string = T.mutedFg;
  if (isOverdue) { dueBg = T.vermelho50; dueFg = T.destructive; }
  else if (isUrgent) { dueBg = "#FEF3C7"; dueFg = "#D97706"; }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 500, padding: "2px 6px", borderRadius: "4px", backgroundColor: dueBg, color: dueFg }}>
      <Calendar size={9} />
      {dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
    </span>
  );
}

export function TaskCard({ task, expanded, onToggleExpand, onUpdate, onDelete, users }: TaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Inline editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editDod, setEditDod] = useState(task.definition_of_done);

  // Comments
  const [comments, setComments] = useState<BacklogComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local state when task prop changes
  useEffect(() => {
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditDod(task.definition_of_done);
  }, [task.title, task.description, task.definition_of_done]);

  const fetchComments = useCallback(async () => {
    if (!expanded) return;
    try {
      const res = await fetch(`/api/backlog/comments?task_id=${task.id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {}
  }, [task.id, expanded]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Close expanded on click outside
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onToggleExpand();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded, onToggleExpand]);

  const saveField = (field: string, value: string | null) => {
    setEditingField(null);
    onUpdate({ id: task.id, [field]: value });
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
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

  const labelStyle: React.CSSProperties = { fontSize: "10px", fontWeight: 600, color: T.mutedFg, textTransform: "uppercase", marginBottom: "3px" };
  const clickableTextStyle: React.CSSProperties = { fontSize: "13px", color: T.fg, cursor: "pointer", borderRadius: "4px", padding: "2px 4px", margin: "-2px -4px", lineHeight: 1.4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: "6px", border: `1px solid ${T.azul600}`, fontSize: "13px", color: T.fg, outline: "none", fontFamily: T.font, boxSizing: "border-box" };

  // --- COMPACT VIEW ---
  if (!expanded) {
    return (
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.setData("taskId", task.id); e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
        onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        onClick={onToggleExpand}
        style={{
          backgroundColor: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: "8px",
          padding: "12px",
          cursor: "pointer",
          transition: "box-shadow 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 8px", borderRadius: "9999px", fontSize: "10px", fontWeight: 600, backgroundColor: task.type === "bug" ? T.vermelho50 : T.azul50, color: task.type === "bug" ? T.destructive : T.azul600 }}>
            {task.type === "bug" ? <Bug size={10} /> : <Sparkles size={10} />}
            {task.type === "bug" ? "Bug" : "Feature"}
          </span>
        </div>
        <div style={{ fontSize: "13px", fontWeight: 500, color: T.fg, marginBottom: "8px", lineHeight: 1.3 }}>
          {task.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", color: T.mutedFg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
            <User size={10} />
            {task.assigned_name || "Sem responsável"}
          </span>
          <DueBadge due_date={task.due_date} />
        </div>
      </div>
    );
  }

  // --- EXPANDED VIEW (inline edit) ---
  return (
    <div
      ref={cardRef}
      style={{
        backgroundColor: T.bg,
        border: `2px solid ${T.azul600}`,
        borderRadius: "10px",
        padding: "16px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      }}
    >
      {/* Header: type selector + close */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <select
          value={task.type}
          onChange={(e) => onUpdate({ id: task.id, type: e.target.value as "feature" | "bug" })}
          style={{
            padding: "3px 8px",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            backgroundColor: task.type === "bug" ? T.vermelho50 : T.azul50,
            color: task.type === "bug" ? T.destructive : T.azul600,
            outline: "none",
            appearance: "auto",
          }}
        >
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
        </select>
        <button onClick={onToggleExpand} style={{ background: "none", border: "none", cursor: "pointer", color: T.mutedFg, padding: "2px" }}>
          <X size={14} />
        </button>
      </div>

      {/* Title */}
      <div style={{ marginBottom: "12px" }}>
        {editingField === "title" ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => { if (editTitle.trim()) saveField("title", editTitle.trim()); else setEditTitle(task.title); }}
            onKeyDown={(e) => { if (e.key === "Enter" && editTitle.trim()) saveField("title", editTitle.trim()); if (e.key === "Escape") { setEditTitle(task.title); setEditingField(null); } }}
            autoFocus
            style={{ ...inputStyle, fontWeight: 600, fontSize: "14px" }}
          />
        ) : (
          <div
            onClick={() => setEditingField("title")}
            style={{ ...clickableTextStyle, fontWeight: 600, fontSize: "14px" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.cinza50; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {task.title}
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ marginBottom: "12px" }}>
        <div style={labelStyle}>Descrição</div>
        {editingField === "description" ? (
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onBlur={() => saveField("description", editDescription)}
            onKeyDown={(e) => { if (e.key === "Escape") { setEditDescription(task.description); setEditingField(null); } }}
            autoFocus
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        ) : (
          <div
            onClick={() => setEditingField("description")}
            style={{ ...clickableTextStyle, color: task.description ? T.fg : T.cinza400, minHeight: "20px", whiteSpace: "pre-wrap" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.cinza50; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {task.description || "Clique para adicionar..."}
          </div>
        )}
      </div>

      {/* Responsável + Data */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
        <div>
          <div style={labelStyle}>Responsável</div>
          <select
            value={task.assigned_to || ""}
            onChange={(e) => onUpdate({ id: task.id, assigned_to: e.target.value || null })}
            style={{ width: "100%", padding: "5px 8px", borderRadius: "6px", border: `1px solid ${T.border}`, fontSize: "12px", color: T.fg, outline: "none", cursor: "pointer", backgroundColor: T.bg }}
          >
            <option value="">Nenhum</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Data Esperada</div>
          <input
            type="date"
            value={task.due_date || ""}
            onChange={(e) => onUpdate({ id: task.id, due_date: e.target.value || null })}
            style={{ width: "100%", padding: "5px 8px", borderRadius: "6px", border: `1px solid ${T.border}`, fontSize: "12px", color: T.fg, outline: "none", cursor: "pointer", backgroundColor: T.bg, boxSizing: "border-box" }}
          />
        </div>
      </div>

      {/* Definição de Pronto */}
      <div style={{ marginBottom: "12px" }}>
        <div style={labelStyle}>Definição de Pronto</div>
        {editingField === "definition_of_done" ? (
          <textarea
            value={editDod}
            onChange={(e) => setEditDod(e.target.value)}
            onBlur={() => saveField("definition_of_done", editDod)}
            onKeyDown={(e) => { if (e.key === "Escape") { setEditDod(task.definition_of_done); setEditingField(null); } }}
            autoFocus
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        ) : (
          <div
            onClick={() => setEditingField("definition_of_done")}
            style={{ ...clickableTextStyle, color: task.definition_of_done ? T.fg : T.cinza400, minHeight: "20px", whiteSpace: "pre-wrap" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.cinza50; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {task.definition_of_done || "Clique para adicionar..."}
          </div>
        )}
      </div>

      {/* Comments */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "10px", marginBottom: "10px" }}>
        <div style={{ ...labelStyle, marginBottom: "6px" }}>Comentários ({comments.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflow: "auto", marginBottom: "6px" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ backgroundColor: T.cinza50, borderRadius: "6px", padding: "6px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: T.fg }}>{c.author_name}</span>
                <span style={{ fontSize: "9px", color: T.mutedFg }}>
                  {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: T.cardFg, lineHeight: 1.3, whiteSpace: "pre-wrap" }}>{c.content}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
            style={{ flex: 1, padding: "5px 8px", borderRadius: "6px", border: `1px solid ${T.border}`, fontSize: "12px", color: T.fg, outline: "none" }}
            placeholder="Comentar..."
          />
          <button
            onClick={handleSendComment}
            disabled={sendingComment || !newComment.trim()}
            style={{ display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: "6px", border: "none", backgroundColor: T.azul600, color: "#FFF", cursor: "pointer", opacity: sendingComment || !newComment.trim() ? 0.5 : 1 }}
          >
            <Send size={11} />
          </button>
        </div>
      </div>

      {/* Delete */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "10px", display: "flex", justifyContent: "flex-end" }}>
        {confirmDelete ? (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: T.destructive }}>Confirmar?</span>
            <button onClick={() => onDelete(task.id)} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", backgroundColor: T.destructive, color: "#FFF", fontSize: "11px", cursor: "pointer" }}>Excluir</button>
            <button onClick={() => setConfirmDelete(false)} style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.mutedFg, fontSize: "11px", cursor: "pointer" }}>Não</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "6px", border: `1px solid ${T.vermelho100}`, backgroundColor: "transparent", color: T.destructive, fontSize: "11px", cursor: "pointer" }}>
            <Trash2 size={11} /> Excluir
          </button>
        )}
      </div>
    </div>
  );
}
