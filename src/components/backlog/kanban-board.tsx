"use client";

import { useState } from "react";
import { Plus, Filter } from "lucide-react";
import { T } from "@/lib/constants";
import type { BacklogTask } from "@/lib/types";
import { TaskCard } from "./task-card";

const COLUMNS = [
  { key: "backlog", label: "Backlog", color: T.cinza600 },
  { key: "planejado", label: "Planejado", color: T.cinza400 },
  { key: "fazendo", label: "Fazendo", color: T.azul600 },
  { key: "review", label: "Review", color: T.laranja500 },
  { key: "done", label: "Done", color: T.verde600 },
] as const;

interface UserOption {
  id: string;
  full_name: string;
}

interface KanbanBoardProps {
  tasks: BacklogTask[];
  users: UserOption[];
  onMoveTask: (taskId: string, newStatus: string, newPosition: number) => void;
  onUpdateTask: (fields: Partial<BacklogTask>) => void;
  onDeleteTask: (id: string) => void;
  onNewTask: () => void;
  currentUserId: string;
}

function sortTasks(tasks: BacklogTask[]): BacklogTask[] {
  return [...tasks].sort((a, b) => {
    // 1. Priority ascending (0 = most urgent)
    if (a.priority !== b.priority) return a.priority - b.priority;
    // 2. Due date ascending (soonest first, null last)
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    // 3. Position
    return a.position - b.position;
  });
}

export function KanbanBoard({ tasks, users, onMoveTask, onUpdateTask, onDeleteTask, onNewTask, currentUserId }: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string>("");

  const filteredTasks = filterUser
    ? tasks.filter((t) => t.assigned_to === filterUser)
    : tasks;

  const tasksByStatus = (status: string) =>
    sortTasks(filteredTasks.filter((t) => t.status === status));

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    const columnTasks = tasksByStatus(targetStatus);
    const maxPos = columnTasks.length > 0 ? Math.max(...columnTasks.map((t) => t.position)) : 0;
    onMoveTask(taskId, targetStatus, maxPos + 1000);
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Filter size={14} color={T.mutedFg} />
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          style={{
            padding: "5px 10px",
            borderRadius: "6px",
            border: `1px solid ${T.border}`,
            fontSize: "12px",
            color: T.fg,
            backgroundColor: T.bg,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="">Todos os responsáveis</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
        {filterUser && (
          <button
            onClick={() => setFilterUser("")}
            style={{ padding: "4px 8px", borderRadius: "6px", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.mutedFg, fontSize: "11px", cursor: "pointer" }}
          >
            Limpar
          </button>
        )}
      </div>

      {/* Board */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
          minHeight: "400px",
        }}
      >
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus(col.key);
          const isDragOver = dragOverColumn === col.key;

          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
              onDragEnter={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverColumn(null);
                }
              }}
              onDrop={(e) => handleDrop(e, col.key)}
              style={{
                backgroundColor: T.cinza50,
                borderRadius: "12px",
                padding: "12px",
                border: isDragOver ? `2px dashed ${T.azul600}` : `2px solid transparent`,
                transition: "border-color 0.15s",
              }}
            >
              {/* Column header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: col.color }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>{col.label}</span>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: T.mutedFg, backgroundColor: T.bg, borderRadius: "9999px", padding: "1px 8px", border: `1px solid ${T.border}` }}>
                    {colTasks.length}
                  </span>
                </div>
                {col.key === "backlog" && (
                  <button
                    onClick={onNewTask}
                    style={{ display: "flex", alignItems: "center", gap: "2px", padding: "3px 8px", borderRadius: "6px", border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.mutedFg, fontSize: "11px", cursor: "pointer" }}
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    expanded={expandedTaskId === task.id}
                    onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                    users={users}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
