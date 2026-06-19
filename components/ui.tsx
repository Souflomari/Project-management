"use client";

// Shared primitive kit. One source of truth for buttons, inputs, cards, etc.
// so divergent inline styles stop being expressible across views.

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { motion } from "motion/react";

import { CaretDownIcon, CheckIcon, CloseIcon } from "./icons";
import { C, ELEV, num, PHASE_COLORS, R, SH, SP, SURFACE, TX } from "@/lib/tokens";
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
    primary: { background: C.solid, color: C.surface },
    secondary: { background: C.surface, color: C.ink700, border: `1px solid ${C.lineStrong}` },
    tonal: { background: C.subtle, color: C.ink900 },
    outlined: { background: "transparent", color: C.ink700, border: `1px solid ${C.lineStrong}` },
    ghost: { background: "transparent", color: C.ink500 },
    danger: { background: C.danger, color: C.surface },
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
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
        ...sizes[size],
        ...variants[variant],
        ...(props.disabled ? { background: C.subtle, color: C.ink300, borderColor: C.line } : null),
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
        cursor: props.disabled ? "not-allowed" : "pointer",
        color: tone === "danger" ? C.danger : C.ink500,
        padding: 0,
        flexShrink: 0,
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
        ...(props.disabled ? { background: C.subtle, color: C.ink300, borderColor: C.line } : null),
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
        color: C.surface,
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)",
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
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value);
    if (i < 0) return;
    onChange(options[(i + dir + options.length) % options.length].value);
  };
  return (
    <div role="radiogroup" style={{ display: "inline-flex", gap: 2, background: C.subtle, borderRadius: R.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            }}
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
  elevation = 0,
  radius = R.lg,
  style,
}: {
  children: ReactNode;
  padding?: number | string;
  /** Tonal lift via the M3 ELEV ramp (tone-first, whisper of shadow). 0 = flat
   *  white card resting on the canvas; raise the hero, not every tile. */
  elevation?: 0 | 1 | 2 | 3;
  radius?: number;
  style?: CSSProperties;
}) {
  // On the unified white field, cards read by a hairline border + a soft resting
  // shadow (depth comes from light, not tone). `elevation` deepens the shadow for
  // hero/overlay surfaces. Cards lift on hover with a spring (framer-motion) so
  // the surface feels physical and responsive.
  const lift = elevation > 0 ? ELEV[elevation] : { background: C.surface, boxShadow: SH.sm };
  const border = elevation > 0 ? `1px solid ${C.lineStrong}` : `1px solid ${C.line}`;
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: SH.lg }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      style={{ background: C.surface, border, borderRadius: radius, padding, ...lift, ...style }}
    >
      {children}
    </motion.div>
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

/** Illustrated empty state: a tonal disc framing a line icon, then title / hint
 *  / optional action. Falls back to a neutral inbox glyph when no icon is given,
 *  so existing title/hint-only call sites still render with the new warmth. */
export function EmptyState({
  title,
  hint,
  icon,
  action,
  compact,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  const disc = compact ? 40 : 52;
  return (
    <div style={{ textAlign: "center", padding: compact ? `${SP[6]}px ${SP[5]}px` : `${SP[8]}px ${SP[5]}px`, color: C.ink500 }}>
      <div
        aria-hidden
        style={{
          width: disc,
          height: disc,
          borderRadius: "50%",
          background: SURFACE.containerHigh,
          border: `1px solid ${C.line}`,
          color: C.ink400,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: SP[4],
        }}
      >
        {icon ?? <EmptyGlyph size={compact ? 20 : 24} />}
      </div>
      <div style={{ ...TX.bodyStrong, color: C.ink700 }}>{title}</div>
      {hint ? <div style={{ ...TX.caption, color: C.ink400, marginTop: SP[2], maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>{hint}</div> : null}
      {action ? <div style={{ marginTop: SP[5], display: "flex", justifyContent: "center" }}>{action}</div> : null}
    </div>
  );
}

/** Neutral default glyph for EmptyState (an empty tray) — line style to match
 *  the icon set, currentColor so it inherits the tonal disc's muted ink. */
function EmptyGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13l2.2-7.2A2 2 0 0 1 8.1 4.4h7.8a2 2 0 0 1 1.9 1.4L20 13" />
      <path d="M4 13h4l1.2 2.2h5.6L16 13h4v5.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.2Z" />
    </svg>
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
      style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.34)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", animation: closing ? "fadeOut var(--dur-fast) var(--ease-accel) forwards" : "fadeIn var(--dur-base) var(--ease-out)", padding: 20 }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: "100%", background: C.surface, borderRadius: R.lg, boxShadow: SH.lg, padding: 24, color: C.ink900, animation: closing ? "popOut var(--dur-fast) var(--ease-accel) forwards" : "popIn var(--dur-base) var(--ease-out)", outline: "none" }}
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
        color: C.surface,
        background: color,
        flexShrink: 0,
        ...(title ? { cursor: "default" } : null),
        ...(ring ? { border: `2px solid ${C.surface}` } : null),
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
      {/* `.anim-bar` grows the fill from 0 to `--fill` on mount (reduced-motion
          neutralises the keyframe, so it simply appears at full width). The inline
          width matches `--fill` so the resting state is correct without JS. */}
      <div
        className="anim-bar"
        style={{ height: "100%", width: `${clamped}%`, ["--fill" as string]: `${clamped}%`, background: color, borderRadius: R.pill }}
      />
    </div>
  );
}

let sparkSeq = 0;

/** Compact trend line. Scales to its container width; non-scaling stroke.
 *  `gradient` swaps the flat-opacity area for a vertical <linearGradient> fade;
 *  `endLabel` prints the last value beside the endpoint dot (non-colour-only
 *  legibility — the figure is always readable without relying on hue). */
export function Sparkline({
  values,
  height = 30,
  color = C.brand,
  fill = true,
  gradient = false,
  endLabel,
}: {
  values: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  gradient?: boolean;
  endLabel?: string;
}) {
  // Stable id per instance (SSR-safe: assigned once at module scope counter).
  const gidRef = useRef<string | null>(null);
  if (!gidRef.current) gidRef.current = `spark-grad-${sparkSeq++}`;
  const gid = gidRef.current;

  if (values.length < 2) return null;
  const W = 100;
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  // Honest y-domain. A naive [min,max] domain magnifies a 1% wobble into a
  // full-height swing. Anchor the floor at 0 for all-positive series (the
  // common case here), so the line's slope reflects real magnitude. If the
  // span is still vanishingly small relative to the peak, pad it so the trace
  // reads as the near-flat line it actually is — not zoomed noise.
  const peak = Math.max(Math.abs(dataMin), Math.abs(dataMax)) || 1;
  let lo = dataMin >= 0 ? 0 : dataMin;
  let hi = dataMax;
  if (hi - lo < peak * 0.08) {
    const pad = (peak * 0.08 - (hi - lo)) / 2;
    lo -= pad;
    hi += pad;
  }
  const range = hi - lo || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => height - 3 - ((v - lo) / range) * (height - 6);
  const line = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `0,${height} ${line} ${W},${height}`;
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);
  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        {gradient ? (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
        ) : null}
        {fill ? <polygon points={area} fill={gradient ? `url(#${gid})` : color} opacity={gradient ? 1 : 0.08} /> : null}
        <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r={2.4} fill={color} stroke={C.surface} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      {endLabel ? (
        <span
          style={{
            position: "absolute",
            right: 0,
            top: `${(lastY / height) * 100}%`,
            transform: "translateY(-50%)",
            marginTop: -1,
            ...num(13),
            fontSize: 12,
            color,
            background: C.surface,
            padding: "0 2px",
            borderRadius: R.xxs,
            pointerEvents: "none",
          }}
        >
          {endLabel}
        </span>
      ) : null}
    </div>
  );
}

// ───────────────────────────────────────── Gauge (radial health arc)

/** Radial health gauge — a 270° arc on a tonal track with a coloured progress
 *  sweep and a tabular figure at its centre. Tone + value carry the reading; the
 *  hue (governed green→amber→terracotta ramp via the caller) is reinforcement,
 *  never the only signal. Reduced-motion-safe (CSS transition only; honoured by
 *  the global prefers-reduced-motion rule, and the value can be pre-counted). */
export function Gauge({
  value,
  max = 100,
  size = 132,
  thickness = 11,
  color = C.brand,
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: ReactNode;
  sublabel?: ReactNode;
}) {
  const pct = Math.min(1, Math.max(0, value / max));
  // Animate the sweep in from 0 on mount: render at 0, then flip to the real
  // value on the next frame so the CSS transition fills the arc in. Reduced
  // motion short-circuits to the final value (no transition runs).
  const [mounted, setMounted] = useState(prefersReducedMotion());
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const drawn = mounted ? pct : 0;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const SWEEP = 270; // degrees of visible arc
  const GAP = (360 - SWEEP) / 2; // bottom gap, centred
  const circ = 2 * Math.PI * r;
  const arcLen = (SWEEP / 360) * circ;
  const dash = `${arcLen} ${circ}`;
  // rotate so the gap sits at the bottom: start at 90° + GAP
  const rot = 90 + GAP;
  // Quarter ticks across the sweep (0 / 25 / 50 / 75 / 100%) so the arc reads as
  // a measured value, not a decorative ring. Drawn in the SVG's local frame so
  // they ride the same rotation as the track and sit just inside the arc.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const a = ((t * SWEEP) / 360) * 2 * Math.PI; // sweep starts at local 0° after rotation
    const inner = r - thickness / 2 - 2.5;
    const outer = r + thickness / 2 + 2.5;
    return {
      x1: cx + Math.cos(a) * inner,
      y1: cy + Math.sin(a) * inner,
      x2: cx + Math.cos(a) * outer,
      y2: cy + Math.sin(a) * outer,
      major: t === 0 || t === 1,
    };
  });
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", transform: `rotate(${rot}deg)` }}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={SURFACE.containerHighest}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={dash}
        />
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.major ? C.lineStrong : C.line}
            strokeWidth={t.major ? 1.25 : 1}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${arcLen * drawn} ${circ}`}
          style={{ transition: "stroke-dasharray var(--dur-slow) var(--ease-decel), stroke var(--dur-fast) var(--ease-standard)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {label}
        {sublabel}
      </div>
    </div>
  );
}
