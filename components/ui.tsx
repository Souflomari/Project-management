"use client";

// Shared primitive kit. One source of truth for buttons, inputs, cards, etc.
// so divergent inline styles stop being expressible across views.

import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";

import { CaretDownIcon, CloseIcon } from "./icons";
import { C, R, SH, TX } from "@/lib/tokens";

/** Make a clickable row keyboard-operable (WCAG 2.1.1). Spread onto the row;
 *  add `className="row-hover row-focus"`. */
export function rowProps(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

// ───────────────────────────────────────── Button

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  style,
  ...props
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes: Record<string, CSSProperties> = {
    sm: { fontSize: 12, padding: "6px 12px" },
    md: { fontSize: 13, padding: "8px 14px" },
  };
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: C.solid, color: "#fff" },
    secondary: { background: C.surface, color: C.ink700, border: `1px solid ${C.lineStrong}` },
    ghost: { background: "transparent", color: C.ink500 },
  };
  return (
    <button
      className={`btn btn-${variant}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: "inherit",
        fontWeight: 600,
        border: "1px solid transparent",
        borderRadius: R.sm,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background .12s, border-color .12s",
        ...sizes[size],
        ...variants[variant],
        ...(props.disabled ? { opacity: 0.45, pointerEvents: "none" } : null),
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  size = 30,
  tone = "default",
  children,
  style,
  ...props
}: {
  size?: number;
  tone?: "default" | "danger";
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`btn icon-btn${tone === "danger" ? " icon-danger" : ""}`}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${C.line}`,
        background: C.surface,
        borderRadius: R.sm,
        cursor: "pointer",
        color: tone === "danger" ? "#C5362C" : C.ink500,
        padding: 0,
        flexShrink: 0,
        transition: "background .12s, border-color .12s, color .12s",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

// ───────────────────────────────────────── Input / Select

export function Input({
  size = "md",
  style,
  ...props
}: { size?: "sm" | "md" } & Omit<InputHTMLAttributes<HTMLInputElement>, "size">) {
  const s = size === "sm" ? { height: 30, fontSize: 13 } : { height: 36, fontSize: 14 };
  return (
    <input
      className="ui-field"
      style={{
        ...s,
        padding: "0 12px",
        width: "100%",
        border: `1px solid ${C.line}`,
        borderRadius: R.sm,
        background: C.surface,
        color: C.ink900,
        outline: "none",
        fontFamily: "inherit",
        ...style,
      }}
      {...props}
    />
  );
}

export function Select({
  size = "md",
  children,
  style,
  ...props
}: { size?: "sm" | "md" } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">) {
  const s = size === "sm" ? { height: 30, fontSize: 13 } : { height: 36, fontSize: 14 };
  return (
    <span style={{ position: "relative", display: "inline-flex", width: style?.width ?? "auto" }}>
      <select
        className="ui-field"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          ...s,
          padding: "0 30px 0 12px",
          width: "100%",
          border: `1px solid ${C.line}`,
          borderRadius: R.sm,
          background: C.surface,
          color: C.ink900,
          outline: "none",
          fontFamily: "inherit",
          cursor: "pointer",
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: C.ink500, display: "flex" }}>
        <CaretDownIcon size={14} />
      </span>
    </span>
  );
}

// ───────────────────────────────────────── SegmentedControl

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 2, background: C.subtle, borderRadius: R.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="btn"
            style={{
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: R.sm,
              background: active ? C.surface : "transparent",
              color: active ? C.ink900 : C.ink500,
              boxShadow: active ? SH.sm : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────── Card

export function Card({
  children,
  padding = "18px 20px",
  style,
}: {
  children: ReactNode;
  padding?: number | string;
  style?: CSSProperties;
}) {
  // Surfaces rest with a soft border and no shadow (structure, not noise).
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, padding, ...style }}>
      {children}
    </div>
  );
}

// ───────────────────────────────────────── Toolbar (per-view control strip)

export function Toolbar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap", ...style }}>
      {children}
    </div>
  );
}

// ───────────────────────────────────────── EmptyState

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 16px", color: C.ink500 }}>
      <div style={{ ...TX.bodyStrong, color: C.ink700 }}>{title}</div>
      {hint ? <div style={{ ...TX.caption, color: C.ink400, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

// ───────────────────────────────────────── Modal

export function Modal({
  title,
  subtitle,
  width = 480,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.34)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .16s ease", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: "100%", background: C.surface, borderRadius: R.md, boxShadow: SH.lg, padding: 24, color: C.ink900, animation: "popIn .2s cubic-bezier(.2,.7,.2,1)" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: subtitle ? 4 : 16 }}>
          <h2 style={{ ...TX.h2, margin: 0 }}>{title}</h2>
          <IconButton size={28} onClick={onClose} aria-label="Fermer">
            <CloseIcon size={15} />
          </IconButton>
        </div>
        {subtitle ? <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 16px" }}>{subtitle}</p> : null}
        {children}
        {footer ? <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

// ───────────────────────────────────────── Avatar / Pill / Badge / ProgressBar

export function Avatar({
  initials,
  color,
  size = 30,
  fontSize,
  ring,
  title,
}: {
  initials: string;
  color: string;
  size?: number;
  fontSize?: number;
  ring?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize ?? Math.round(size * 0.36),
        fontWeight: 700,
        color: "#fff",
        background: color,
        flexShrink: 0,
        ...(title ? { cursor: "default" } : null),
        ...(ring ? { border: "2px solid #fff" } : null),
      }}
    >
      {initials}
    </div>
  );
}

export function PhaseBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".03em",
        fontVariantNumeric: "tabular-nums",
        color: C.ink500,
        border: `1px solid ${C.line}`,
        padding: "2px 6px",
        borderRadius: R.sm,
      }}
    >
      {label}
    </span>
  );
}

export function StatusPill({
  color,
  bg,
  label,
  filled,
}: {
  color: string;
  bg?: string;
  label: string;
  filled?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color,
        ...(filled && bg ? { background: bg, padding: "2px 8px", borderRadius: R.pill } : null),
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

export function ProgressBar({
  pct,
  color,
  track = C.subtle,
  height = 7,
}: {
  pct: number;
  color: string;
  track?: string;
  height?: number;
}) {
  return (
    <div style={{ flex: 1, height, background: track, borderRadius: R.sm, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: `${R.sm}px 0 0 ${R.sm}px` }} />
    </div>
  );
}
