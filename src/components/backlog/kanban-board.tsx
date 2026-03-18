"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { T } from "@/lib/constants";
import type { BacklogTask } from "@/lib/types";
import { TaskCard } from "./task-card";

const COLUMNS = [
  { key: "backlog", label: "Backlog", color: T.cinza600 },
  { key: "fazendo", label: "Fazendo", color: T.azul600 },
  { key: "review", label: "Review", color: T.laranja500 },
  { key: "done", label: "Done", color: T.verde600 },
] as const;

interface KanbanBoardProps {
  tasks: BacklogTask[];
  onMoveTask: (taskId: string, newStatus: string, newPosition: number) => void;
  onClickTask: (task: BacklogTask) => void;
  onNewTask: () => void;
}

export function KanbanBoard({ tasks, onMoveTask, onClickTask, onNewTask }: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const tasksByStatus = (status: string) =>
    tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Position: append at the end of the target column
    const columnTasks = tasksByStatus(targetStatus);
    const maxPos = columnTasks.length > 0 ? Math.max(...columnTasks.map((t) => t.position)) : 0;
    const newPosition = maxPos + 1000;

    onMoveTask(taskId, targetStatus, newPosition);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
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
              // Only clear if leaving the column element itself
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
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: col.color,
                  }}
                />
                <span style={{ fontSize: "13px", fontWeight: 600, color: T.fg }}>
                  {col.label}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: T.mutedFg,
                    backgroundColor: T.bg,
                    borderRadius: "9999px",
                    padding: "1px 8px",
                    border: `1px solid ${T.border}`,
                  }}
                >
                  {colTasks.length}
                </span>
              </div>
              {col.key === "backlog" && (
                <button
                  onClick={onNewTask}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: `1px solid ${T.border}`,
                    backgroundColor: T.bg,
                    color: T.mutedFg,
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={12} />
                </button>
              )}
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => onClickTask(task)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
