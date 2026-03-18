"use client";

import { T } from "@/lib/constants";
import type { MediaFilter } from "@/lib/types";
import type { CSSProperties, ReactNode } from "react";

export function Pill({ label, value, color, bg }: { label: string; value: number | string; color?: string; bg?: string }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "9999px",
        padding: "5px 14px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase" }}>{label}</span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: bg ? "#FFF" : color || "#080E32",
          fontVariantNumeric: "tabular-nums",
          ...(bg ? { backgroundColor: bg, padding: "2px 8px", borderRadius: "6px" } : {}),
        }}
      >
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </span>
    </div>
  );
}

export function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          fontWeight: 500,
          color: "#6B6E84",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: color || "#080E32",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

export function Tag({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: "9999px",
        fontSize: "10px",
        fontWeight: 500,
        backgroundColor: `${color}12`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function TH({
  children,
  w,
  right,
  extraStyle,
  ...rest
}: {
  children?: ReactNode;
  w?: number;
  right?: boolean;
  extraStyle?: CSSProperties;
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      style={{
        textAlign: right ? "right" : "left",
        padding: "8px 6px",
        fontSize: "9px",
        fontWeight: 500,
        color: "#6B6E84",
        borderBottom: "1px solid #E6E7EA",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        backgroundColor: "#F3F3F5",
        fontVariantNumeric: right ? "tabular-nums" : undefined,
        ...(w ? { minWidth: w, width: w } : {}),
        ...extraStyle,
      }}
    >
      {children}
    </th>
  );
}

// Shared cell styles
export const cellStyle: CSSProperties = {
  padding: "7px 6px",
  borderBottom: "1px solid #E6E7EA",
  fontSize: "12px",
  fontWeight: 400,
  color: "#141A3C",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  transition: "background 0.1s",
};

export const cellRightStyle: CSSProperties = { ...cellStyle, textAlign: "right" };

export const tdStyle: CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid #E6E7EA",
  fontSize: "13px",
  fontWeight: 400,
  color: "#141A3C",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  transition: "background 0.1s",
};

export const thBaseStyle: CSSProperties = {
  padding: "8px 10px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  backgroundColor: "#F3F3F5",
};

export const hdrBaseStyle: CSSProperties = {
  padding: "4px 6px",
  fontSize: "9px",
  fontWeight: 500,
  color: "rgba(255,255,255,0.7)",
  letterSpacing: "0.04em",
};

export function pillBtnStyle(): CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: "9999px",
    border: "1px solid #E6E7EA",
    backgroundColor: "#FFF",
    color: "#525670",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "5px",
  };
}

export function pillBtnPrimaryStyle(): CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: "9999px",
    border: "none",
    backgroundColor: T.primary,
    color: "#FFF",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "5px",
  };
}

export function MediaFilterToggle({ value, onChange }: { value: MediaFilter; onChange: (f: MediaFilter) => void }) {
  return (
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
        onClick={() => onChange("paid")}
        style={{
          padding: "4px 12px",
          borderRadius: "9999px",
          border: "none",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: "5px",
          transition: "all 0.15s",
          letterSpacing: "0.02em",
          backgroundColor: value === "paid" ? T.azul600 : "transparent",
          color: value === "paid" ? "#FFF" : T.cinza600,
        }}
      >
        Mídia Paga
      </button>
      <button
        onClick={() => onChange("all")}
        style={{
          padding: "4px 12px",
          borderRadius: "9999px",
          border: "none",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: "5px",
          transition: "all 0.15s",
          letterSpacing: "0.02em",
          backgroundColor: value === "all" ? T.azul600 : "transparent",
          color: value === "all" ? "#FFF" : T.cinza600,
        }}
      >
        Todos
      </button>
    </div>
  );
}

export function DataSourceFooter({ lastUpdated }: { lastUpdated?: Date | null }) {
  if (!lastUpdated) return null;
  const dateStr = lastUpdated.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "12px 0 0",
        marginTop: "16px",
        borderTop: `1px solid ${T.border}`,
        fontSize: "11px",
        color: T.mutedFg,
      }}
    >
      <span>Pipedrive</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>{dateStr} {timeStr}</span>
    </div>
  );
}

export const viewBtnStyle: CSSProperties = {
  padding: "5px 14px",
  borderRadius: "9999px",
  border: "none",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  gap: "5px",
  transition: "all 0.15s",
  letterSpacing: "0.02em",
};
