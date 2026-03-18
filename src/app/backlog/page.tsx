"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitCommit } from "lucide-react";
import { T } from "@/lib/constants";
import type { BacklogTask, ContributorStats } from "@/lib/types";
import { KanbanBoard } from "@/components/backlog/kanban-board";
import { TaskModal } from "@/components/backlog/task-modal";

interface UserOption {
  id: string;
  full_name: string;
}

export default function BacklogPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTask, setModalTask] = useState<BacklogTask | null | "new">(null);
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [contribLoading, setContribLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/backlog/tasks");
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks || []);

      // Extract unique users from tasks for the assignment dropdown
      const userMap = new Map<string, string>();
      for (const t of data.tasks || []) {
        if (t.assigned_to && t.assigned_name) userMap.set(t.assigned_to, t.assigned_name);
        if (t.created_by && t.created_by_name) userMap.set(t.created_by, t.created_by_name);
      }
      setUsers(Array.from(userMap.entries()).map(([id, full_name]) => ({ id, full_name })));
    } catch {} finally {
      setLoading(false);
    }
  }, [router]);

  const fetchContributions = useCallback(async () => {
    try {
      const res = await fetch("/api/backlog/contributions");
      if (!res.ok) return;
      const data = await res.json();
      setContributors(data.contributors || []);
    } catch {} finally {
      setContribLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchContributions();
  }, [fetchTasks, fetchContributions]);

  const handleMoveTask = async (taskId: string, newStatus: string, newPosition: number) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as BacklogTask["status"], position: newPosition } : t))
    );

    try {
      const res = await fetch("/api/backlog/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus, position: newPosition }),
      });
      if (!res.ok) fetchTasks();
    } catch {
      fetchTasks();
    }
  };

  const handleSaveTask = async (data: Partial<BacklogTask>) => {
    const isNew = !data.id;
    const res = await fetch("/api/backlog/tasks", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar");
    }
    fetchTasks();
  };

  const handleDeleteTask = async (id: string) => {
    const res = await fetch("/api/backlog/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error("Erro ao excluir");
    fetchTasks();
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
      <div style={{ fontFamily: T.font, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: T.mutedFg }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: T.bg,
          borderBottom: `1px solid ${T.border}`,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <button
          onClick={() => router.push("/")}
          style={{ ...btnStyle, borderRadius: "9999px", padding: "8px" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: 0 }}>Backlog</h1>
          <span style={{ fontSize: "12px", color: T.mutedFg }}>Kanban + Contribuições GitHub</span>
        </div>
      </header>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Kanban Board */}
        <KanbanBoard
          tasks={tasks}
          onMoveTask={handleMoveTask}
          onClickTask={(task) => setModalTask(task)}
          onNewTask={() => setModalTask("new")}
        />

        {/* GitHub Contributions */}
        <div style={{ marginTop: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <GitCommit size={18} color={T.fg} />
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: T.fg, margin: 0 }}>Contribuições GitHub</h2>
          </div>
          <div
            style={{
              backgroundColor: T.bg,
              borderRadius: "12px",
              border: `1px solid ${T.border}`,
              boxShadow: T.elevSm,
              overflow: "hidden",
            }}
          >
            {contribLoading ? (
              <div style={{ padding: "32px", textAlign: "center", color: T.mutedFg, fontSize: "13px" }}>
                Carregando contribuições...
              </div>
            ) : contributors.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: T.mutedFg, fontSize: "13px" }}>
                Nenhuma contribuição encontrada. Verifique se o GITHUB_TOKEN está configurado.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Usuário</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Commits</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Linhas Adicionadas</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Linhas Removidas</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Último Commit</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Atividade (12 sem)</th>
                  </tr>
                </thead>
                <tbody>
                  {contributors.map((c) => (
                    <tr key={c.github_login}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>
                        <div>{c.name}</div>
                        <div style={{ fontSize: "11px", color: T.mutedFg }}>@{c.github_login}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.totalCommits}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: T.verde600, fontVariantNumeric: "tabular-nums" }}>
                        +{c.totalAdded.toLocaleString("pt-BR")}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", color: T.destructive, fontVariantNumeric: "tabular-nums" }}>
                        -{c.totalDeleted.toLocaleString("pt-BR")}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", color: T.mutedFg, fontSize: "12px" }}>
                        {c.lastCommitDate
                          ? new Date(c.lastCommitDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <Sparkline weeks={c.weeks} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {modalTask !== null && (
        <TaskModal
          task={modalTask === "new" ? null : modalTask}
          users={users}
          onClose={() => setModalTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: "11px",
  fontWeight: 600,
  color: "#6B6E84",
  textTransform: "uppercase",
  textAlign: "left",
  borderBottom: "1px solid #E6E7EA",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: "#080E32",
  borderBottom: "1px solid #F3F3F5",
};

function Sparkline({ weeks }: { weeks: Array<{ commits: number }> }) {
  if (!weeks.length) return null;
  const maxCommits = Math.max(...weeks.map((w) => w.commits), 1);
  const barWidth = 6;
  const gap = 2;
  const height = 24;
  const totalWidth = weeks.length * (barWidth + gap) - gap;

  return (
    <svg width={totalWidth} height={height} style={{ display: "inline-block", verticalAlign: "middle" }}>
      {weeks.map((w, i) => {
        const barHeight = Math.max((w.commits / maxCommits) * height, w.commits > 0 ? 2 : 0);
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1}
            fill={w.commits > 0 ? "#0055FF" : "#E6E7EA"}
          />
        );
      })}
    </svg>
  );
}
