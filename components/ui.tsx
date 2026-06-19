"use client";

// Shared primitive kit. One source of truth for buttons, inputs, cards, etc.
// so divergent inline styles stop being expressible across views.

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";

import { CaretDownIcon, CheckIcon, CloseIcon } from "./icons";
import { C, num, PHASE_COLORS, R, SH, TX } from "@/lib/tokens";
import { PHASES, PHASES_FULL } from "@/lib/types";

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

/** True when the user has asked the OS to minimise motion. JS-driven animation
 *  (count-up, exit choreography) must short-circuit on this; CSS is handled by
 *  the global prefers-reduced-motion rule. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Manage a brief "closing" phase so an overlay can animate out before it
 *  unmounts. Returns the flag + a wrapped close that plays the exit then calls
 *  the real `onClose` (immediately under reduced motion). */
export function useExitClose(onClose: () => void, ms = 160) {
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (prefersReducedMotion()) return onClose();
    setClosing(true);
    window.setTimeout(onClose, ms);
  }, [onClose, ms]);
  return { closing, requestClose };
}

/** Trap Tab focus within `ref`, focus the first control on mount, restore focus
 *  on unmount, and close on Escape. Shared by Modal and the project Drawer. */
export function useFocusTrap(ref: { current: HTMLElement | null }, onClose: () => void) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const sel = "button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])";
    (node?.querySelector<HTMLElement>("[autofocus]," + sel) ?? node)?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !node) return;
      const f = Array.from(node.querySelectorAll<HTMLElement>(sel)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [ref, onClose]);
}

// ───────────────────────────────────────── Button

type ButtonVariant = "primary" | "secondary" | "tonal" | "outlined" | "ghost" | "danger";

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
    tonal: { background: C.subtle, color: C.ink900 },
    outlined: { background: "transparent", color: C.ink700, border: `1px solid ${C.lineStrong}` },
    ghost: { background: "transparent", color: C.ink500 },
    danger: { background: C.danger, color: "#fff" },
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
        color: tone === "danger" ? C.danger : C.ink500,
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

/** Unified checkbox (was hand-rolled in the table and the drawer). `.btn` gives
 *  it a focus-visible ring; the inset overlay expands the hit area past the 24px
 *  minimum without changing the visual size. */
export function Checkbox({
  checked,
  onChange,
  label,
  tone = "ink",
  size = 18,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  tone?: "ink" | "brand";
  size?: number;
}) {
  const fill = tone === "brand" ? C.brand : C.solid;
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className="btn"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: R.xs,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
        padding: 0,
        color: "#fff",
        ...(checked
          ? { background: fill, border: `1px solid ${fill}` }
          : { background: C.surface, border: `1.5px solid ${C.lineStrong}` }),
      }}
    >
      <span aria-hidden style={{ position: "absolute", inset: -8 }} />
      {checked ? <CheckIcon size={Math.round(size * 0.66)} /> : null}
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

// ───────────────────────────────────────── SectionHeader (editorial framing)

/** design.google-style section introduction: an uppercase eyebrow over a
 *  prominent heading, optional count, description and trailing action. */
export function SectionHeader({
  eyebrow,
  title,
  count,
  description,
  action,
  style,
}: {
  eyebrow?: string;
  title: string;
  count?: number;
  description?: string;
  action?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, margin: "0 0 16px", ...style }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div style={{ ...TX.eyebrow, color: C.ink400, marginBottom: 6 }}>{eyebrow}</div> : null}
        <h2 style={{ ...TX.sectionHd, margin: 0, color: C.ink900, display: "flex", alignItems: "baseline", gap: 10 }}>
          {title}
          {count != null ? <span style={{ ...num(15), color: C.ink400 }}>{count}</span> : null}
        </h2>
        {description ? <p style={{ ...TX.caption, color: C.ink500, margin: "6px 0 0", maxWidth: 560 }}>{description}</p> : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
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
  const ref = useRef<HTMLDivElement>(null);
  const { closing, requestClose } = useExitClose(onClose);
  useFocusTrap(ref, requestClose);

  return (
    <div
      onClick={requestClose}
      style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.34)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", animation: closing ? "fadeOut .16s ease forwards" : "fadeIn var(--dur-base) var(--ease-out)", padding: 20 }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: "100%", background: C.surface, borderRadius: R.lg, boxShadow: SH.lg, padding: 24, color: C.ink900, animation: closing ? "popOut .16s ease forwards" : "popIn var(--dur-base) var(--ease-out)", outline: "none" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: subtitle ? 4 : 16 }}>
          <h2 id="modal-title" style={{ ...TX.h2, margin: 0 }}>{title}</h2>
          <IconButton size={28} onClick={requestClose} aria-label="Fermer">
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
        fontWeight: 600,
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

/** Editorial metadata chip — uppercase, tracked, small (design.google idiom).
 *  `tone`: outline (hairline), soft (tinted), or plain. Optional leading dot. */
export function Chip({
  label,
  color = C.ink600,
  tone = "outline",
  dot = false,
  title,
}: {
  label: string;
  color?: string;
  tone?: "outline" | "soft" | "plain";
  dot?: boolean;
  title?: string;
}) {
  const toneStyle: CSSProperties =
    tone === "soft" ? { background: `${color}14` } : tone === "outline" ? { border: `1px solid ${C.line}` } : {};
  return (
    <span
      title={title}
      style={{
        ...TX.eyebrow,
        fontSize: 10.5,
        letterSpacing: ".05em",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: R.xs,
        whiteSpace: "nowrap",
        color,
        ...toneStyle,
      }}
    >
      {dot ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} /> : null}
      {label}
    </span>
  );
}

export function PhaseBadge({ label }: { label: string }) {
  const i = PHASES.indexOf(label as (typeof PHASES)[number]);
  const full = i >= 0 ? PHASES_FULL[i] : undefined;
  const color = i >= 0 ? PHASE_COLORS[i] : C.ink500;
  return <Chip label={label} color={color} tone="soft" title={full ? `${label} · ${full}` : label} />;
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
        ...(filled && bg ? { background: bg, padding: "3px 9px", borderRadius: R.pill } : null),
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
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
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ flex: 1, height, background: track, borderRadius: R.pill, overflow: "hidden" }}
    >
      <div style={{ height: "100%", width: `${clamped}%`, background: color, borderRadius: R.pill, transition: "width .3s ease" }} />
    </div>
  );
}

/** Compact trend line. Scales to its container width; non-scaling stroke. */
export function Sparkline({ values, height = 30, color = C.brand, fill = true }: { values: number[]; height?: number; color?: string; fill?: boolean }) {
  if (values.length < 2) return null;
  const W = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => height - 3 - ((v - min) / range) * (height - 6);
  const line = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `0,${height} ${line} ${W},${height}`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      {fill ? <polygon points={area} fill={color} opacity={0.08} /> : null}
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.4} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
