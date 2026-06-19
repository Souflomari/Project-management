"use client";

// Shared primitive kit. One source of truth for buttons, inputs, cards, etc.
// so divergent inline styles stop being expressible across views.

import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

import { CaretDownIcon, CheckIcon, CloseIcon, MinusIcon, SpinnerIcon } from "./icons";
import { C, ELEV, num, PHASE_COLORS, R, SH, SP, SPRING, SURFACE, TX, Z } from "@/lib/tokens";
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

// ───────────────────────────────────────── Spinner

/** Indeterminate activity ring. Spins via framer-motion (the motion engine), so
 *  it honours reduced-motion by simply not animating the rotation. `currentColor`
 *  so it inherits the button/control ink. */
export function Spinner({ size = 16, style }: { size?: number; style?: CSSProperties }) {
  const reduce = prefersReducedMotion();
  return (
    <motion.span
      aria-hidden
      style={{ display: "inline-flex", lineHeight: 0, ...style }}
      animate={reduce ? undefined : { rotate: 360 }}
      transition={reduce ? undefined : { repeat: Infinity, ease: "linear", duration: 0.7 }}
    >
      <SpinnerIcon size={size} />
    </motion.span>
  );
}

// ───────────────────────────────────────── Button

type ButtonVariant = "primary" | "secondary" | "tonal" | "outlined" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  fullWidth = false,
  children,
  style,
  disabled,
  ...props
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
  /** Show a spinner, set aria-busy, and block clicks. Width is preserved (the
   *  label stays in flow at opacity 0) so the button doesn't jump on toggle. */
  loading?: boolean;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes: Record<string, CSSProperties> = {
    sm: { fontSize: 12, padding: "6px 12px" },
    md: { fontSize: 14, padding: "8px 14px" },
  };
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: C.solid, color: C.surface },
    secondary: { background: C.surface, color: C.ink700, border: `1px solid ${C.lineStrong}` },
    tonal: { background: C.subtle, color: C.ink900 },
    outlined: { background: "transparent", color: C.ink700, border: `1px solid ${C.lineStrong}` },
    ghost: { background: "transparent", color: C.ink500 },
    danger: { background: C.danger, color: C.surface },
  };
  const isDisabled = disabled || loading;
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        position: "relative",
        display: fullWidth ? "flex" : "inline-flex",
        width: fullWidth ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: "inherit",
        fontWeight: 600,
        border: "1px solid transparent",
        borderRadius: R.sm,
        cursor: isDisabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
        ...sizes[size],
        ...variants[variant],
        ...(isDisabled && !loading ? { background: C.subtle, color: C.ink300, borderColor: C.line } : null),
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size={size === "sm" ? 14 : 16} />
        </span>
      ) : null}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, visibility: loading ? "hidden" : undefined }}>
        {icon}
        {children}
      </span>
    </button>
  );
}

export function IconButton({
  size = 30,
  tone = "default",
  loading = false,
  children,
  style,
  disabled,
  ...props
}: {
  size?: number;
  tone?: "default" | "danger";
  /** Swap the glyph for a spinner, set aria-busy and block clicks. */
  loading?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const isDisabled = disabled || loading;
  return (
    <button
      className={`btn icon-btn${tone === "danger" ? " icon-danger" : ""}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${C.line}`,
        background: C.surface,
        borderRadius: R.sm,
        cursor: isDisabled ? "not-allowed" : "pointer",
        color: tone === "danger" ? C.danger : C.ink500,
        padding: 0,
        flexShrink: 0,
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
        ...(isDisabled && !loading ? { background: C.subtle, color: C.ink300, borderColor: C.line } : null),
        ...style,
      }}
      {...props}
    >
      {loading ? <Spinner size={Math.round(size * 0.5)} /> : children}
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
  indeterminate = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  tone?: "ink" | "brand";
  size?: number;
  /** Tri-state "some selected" (MinusIcon). Reads as filled (selected-ish) and
   *  announces `aria-checked="mixed"`. */
  indeterminate?: boolean;
  disabled?: boolean;
}) {
  const fill = tone === "brand" ? C.brand : C.solid;
  const on = checked || indeterminate;
  return (
    <button
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className="btn"
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(); }}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: R.xs,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        color: C.surface,
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)",
        ...(disabled
          ? on
            ? { background: C.ink300, border: `1px solid ${C.ink300}` }
            : { background: C.subtle, border: `1.5px solid ${C.line}` }
          : on
            ? { background: fill, border: `1px solid ${fill}` }
            : { background: C.surface, border: `1.5px solid ${C.lineStrong}` }),
      }}
    >
      <span aria-hidden style={{ position: "absolute", inset: -8 }} />
      {indeterminate ? <MinusIcon size={Math.round(size * 0.66)} /> : checked ? <CheckIcon size={Math.round(size * 0.66)} /> : null}
    </button>
  );
}

// ───────────────────────────────────────── Input / Select

export function Input({
  size = "md",
  invalid = false,
  leading,
  trailing,
  style,
  ...props
}: {
  size?: "sm" | "md";
  /** Paint the error border + set aria-invalid. Pair with Field's `error`. */
  invalid?: boolean;
  /** Adornment slots rendered inside the field frame (icon, unit, button). */
  leading?: ReactNode;
  trailing?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "size">) {
  const s = size === "sm" ? { height: 30, fontSize: 14 } : { height: 36, fontSize: 14 };
  const padL = leading ? 32 : 12;
  const padR = trailing ? 32 : 12;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", width: "100%" }}>
      {leading ? <span style={{ position: "absolute", left: 10, display: "flex", color: C.ink500, pointerEvents: "none" }}>{leading}</span> : null}
      <input
        className="ui-field"
        aria-invalid={invalid || undefined}
        style={{
          ...s,
          padding: `0 ${padR}px 0 ${padL}px`,
          width: "100%",
          border: `1px solid ${invalid ? C.danger : C.line}`,
          borderRadius: R.sm,
          background: C.surface,
          color: C.ink900,
          outline: "none",
          fontFamily: "inherit",
          ...(props.disabled ? { background: C.subtle, color: C.ink300, cursor: "not-allowed" } : null),
          ...style,
        }}
        {...props}
      />
      {trailing ? <span style={{ position: "absolute", right: 10, display: "flex", color: C.ink500 }}>{trailing}</span> : null}
    </span>
  );
}

export function Select({
  size = "md",
  invalid = false,
  leading,
  children,
  style,
  ...props
}: {
  size?: "sm" | "md";
  invalid?: boolean;
  leading?: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">) {
  const s = size === "sm" ? { height: 30, fontSize: 14 } : { height: 36, fontSize: 14 };
  return (
    <span style={{ position: "relative", display: "inline-flex", width: style?.width ?? "auto" }}>
      {leading ? <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", color: C.ink500, pointerEvents: "none" }}>{leading}</span> : null}
      <select
        className="ui-field"
        aria-invalid={invalid || undefined}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          ...s,
          padding: `0 30px 0 ${leading ? 32 : 12}px`,
          width: "100%",
          border: `1px solid ${invalid ? C.danger : C.line}`,
          borderRadius: R.sm,
          background: C.surface,
          color: C.ink900,
          outline: "none",
          fontFamily: "inherit",
          cursor: props.disabled ? "not-allowed" : "pointer",
          ...(props.disabled ? { background: C.subtle, color: C.ink300 } : null),
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: props.disabled ? C.ink300 : C.ink500, display: "flex" }}>
        <CaretDownIcon size={14} />
      </span>
    </span>
  );
}

// ───────────────────────────────────────── Textarea

export function Textarea({
  invalid = false,
  rows = 4,
  style,
  ...props
}: {
  invalid?: boolean;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="ui-field"
      rows={rows}
      aria-invalid={invalid || undefined}
      style={{
        padding: "8px 12px",
        width: "100%",
        minHeight: 80,
        fontSize: 14,
        lineHeight: 1.5,
        border: `1px solid ${invalid ? C.danger : C.line}`,
        borderRadius: R.sm,
        background: C.surface,
        color: C.ink900,
        outline: "none",
        fontFamily: "inherit",
        resize: "vertical",
        ...(props.disabled ? { background: C.subtle, color: C.ink300, cursor: "not-allowed", resize: "none" } : null),
        ...style,
      }}
      {...props}
    />
  );
}

// ───────────────────────────────────────── Field (label + control + error)

/** Form-field wrapper: associates a visible label and an error/help line with
 *  the control via a generated id, so call sites stop hand-wiring htmlFor/id and
 *  aria-describedby. Pass the id down to your control as a render prop. */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  style,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Receives `{ id, invalid }` to spread onto the control. */
  children: (a: { id: string; invalid: boolean }) => ReactNode;
  style?: CSSProperties;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  const invalid = !!error;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <label htmlFor={id} style={{ ...TX.micro, color: C.ink700, fontWeight: 600 }}>
        {label}
        {required ? <span aria-hidden style={{ color: C.danger, marginLeft: 3 }}>*</span> : null}
      </label>
      {children({ id, invalid })}
      {error ? (
        <span id={descId} role="alert" style={{ ...TX.nano, color: C.danger }}>{error}</span>
      ) : hint ? (
        <span id={descId} style={{ ...TX.nano, color: C.ink500 }}>{hint}</span>
      ) : null}
    </div>
  );
}

// ───────────────────────────────────────── SegmentedControl

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value);
    if (i < 0) return;
    onChange(options[(i + dir + options.length) % options.length].value);
  };
  return (
    <div role="radiogroup" aria-disabled={disabled || undefined} style={{ display: "inline-flex", gap: 2, background: C.subtle, borderRadius: R.sm, padding: 3, opacity: disabled ? 0.5 : 1 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            }}
            className="btn"
            style={{
              border: "none",
              cursor: disabled ? "not-allowed" : "pointer",
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
  interactive = false,
  style,
  onClick,
  className,
  id,
}: {
  children: ReactNode;
  padding?: number | string;
  /** Tonal lift via the M3 ELEV ramp (tone-first, whisper of shadow). 0 = flat
   *  white card resting on the canvas; raise the hero, not every tile. */
  elevation?: 0 | 1 | 2 | 3;
  radius?: number;
  /** Opt-in hover-lift. Off by default so static (non-clickable) cards don't
   *  signal a false affordance. Set when the whole card is a link/button. */
  interactive?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;
  id?: string;
}) {
  // DATA-INK: a static card at rest reads by a single hairline on the white
  // field — no resting shadow (depth is reserved for genuine lift). `elevation`
  // opts a tile into the tonal-shadow ramp for the hero / raised surfaces; raise
  // those, not every tile. Interactive cards stay flat at rest (no false
  // affordance) and lift on hover with a spring (framer-motion, SPRING.snappy)
  // from flat to SH.md + a stronger hairline — not the overlay tier, reserved
  // for modal/drawer.
  const lift = elevation > 0 ? ELEV[elevation] : { background: C.surface, boxShadow: "none" };
  const border = elevation > 0 ? `1px solid ${C.lineStrong}` : `1px solid ${C.line}`;
  return (
    <motion.div
      whileHover={interactive ? { y: -2, boxShadow: SH.md, borderColor: C.lineStrong } : undefined}
      transition={SPRING.snappy}
      onClick={onClick}
      className={className}
      id={id}
      style={{ background: C.surface, border, borderRadius: radius, padding, cursor: interactive ? "pointer" : undefined, ...lift, ...style }}
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
          {count != null ? <span style={{ ...num(14), color: C.ink400 }}>{count}</span> : null}
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
        style={{ width, maxWidth: "100%", background: C.surface, borderRadius: R.lg, boxShadow: SH.overlay, padding: 24, color: C.ink900, animation: closing ? "popOut var(--dur-fast) var(--ease-accel) forwards" : "popIn var(--dur-base) var(--ease-out)", outline: "none" }}
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
      role="img"
      aria-label={title ?? initials}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize ?? Math.max(12, Math.round(size * 0.36)),
        fontWeight: 600,
        color: C.surface,
        background: color,
        flexShrink: 0,
        ...(title ? { cursor: "default" } : null),
        ...(ring ? { border: `2px solid ${C.surface}` } : null),
      }}
    >
      <span aria-hidden>{initials}</span>
    </div>
  );
}

/** Editorial metadata chip — uppercase, tracked, small (design.google idiom).
 *  Calm by default: the LABEL is neutral ink on a quiet chip; `color` is spent
 *  only as a thin accent (the optional leading dot / the selected outline), never
 *  as a saturated fill. `tone`: outline (hairline), soft (faint neutral well), or
 *  plain. Optional leading dot carries the hue. */
export function Chip({
  label,
  color = C.ink600,
  tone = "outline",
  dot = false,
  title,
  selected,
  onClick,
}: {
  label: string;
  color?: string;
  tone?: "outline" | "soft" | "plain";
  dot?: boolean;
  title?: string;
  /** When provided, the Chip becomes a toggle button (role + aria-pressed). */
  selected?: boolean;
  onClick?: () => void;
}) {
  const toneStyle: CSSProperties =
    tone === "soft" ? { background: C.subtle } : tone === "outline" ? { border: `1px solid ${C.line}` } : {};
  const base: CSSProperties = {
    ...TX.eyebrow,
    fontSize: 12,
    letterSpacing: ".05em",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 8px",
    borderRadius: R.xs,
    whiteSpace: "nowrap",
    color: C.ink600,
    ...toneStyle,
  };
  // Hue lives in the dot only — a thin accent, so the label stays neutral ink.
  // Uses the shared Dot atom so the 6px circle is identical to StatusPill/legends.
  const dotNode = dot ? <Dot color={color} /> : null;
  if (onClick) {
    return (
      <button
        type="button"
        className="btn"
        title={title}
        aria-pressed={!!selected}
        onClick={onClick}
        style={{
          ...base,
          cursor: "pointer",
          fontFamily: "inherit",
          border: `1px solid ${selected ? color : C.line}`,
          background: selected ? `${color}14` : tone === "soft" ? C.subtle : "transparent",
          color: selected ? C.ink900 : C.ink600,
        }}
      >
        {dotNode}
        {label}
      </button>
    );
  }
  return (
    <span title={title} style={base}>
      {dotNode}
      {label}
    </span>
  );
}

// ───────────────────────────────────────── ToggleButton (selectable control)

/** Selectable button used for filters / pickers / status setters (was hand-rolled
 *  ≥4× with divergent active treatments). `selected` drives aria-pressed and a
 *  tonal fill; `tone` recolours the selected state. */
export function ToggleButton({
  selected = false,
  tone = "ink",
  size = "md",
  icon,
  children,
  style,
  onClick,
  ...props
}: {
  selected?: boolean;
  tone?: "ink" | "brand" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">) {
  const accent = tone === "brand" ? C.brand : tone === "danger" ? C.danger : C.ink900;
  const sizes = size === "sm" ? { fontSize: 12, padding: "5px 10px" } : { fontSize: 14, padding: "7px 12px" };
  return (
    <button
      type="button"
      className="btn"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: "inherit",
        fontWeight: 600,
        borderRadius: R.sm,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
        ...sizes,
        ...(selected
          ? { background: `${accent}14`, border: `1px solid ${accent}`, color: accent }
          : { background: C.surface, border: `1px solid ${C.line}`, color: C.ink600 }),
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function PhaseBadge({ label }: { label: string }) {
  // The LETTER code (ESQ/APS/…) carries phase identity, in neutral ink on a quiet
  // grey chip. The mono-slate ramp colour appears only as the thin accent dot —
  // reinforcing sequence (light→dark) without a saturated fill.
  const i = PHASES.indexOf(label as (typeof PHASES)[number]);
  const full = i >= 0 ? PHASES_FULL[i] : undefined;
  const color = i >= 0 ? PHASE_COLORS[i] : C.ink400;
  return <Chip label={label} color={color} tone="soft" dot title={full ? `${label} · ${full}` : label} />;
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
  // Calm: the coloured DOT carries the semantic reading; the label stays in
  // neutral ink so the badge reads as a quiet tag, not a saturated coloured
  // word. `filled` adds a quiet tinted well (the pale STATUS_META bg) — not a
  // loud slab — and the label darkens for legible AA contrast on it.
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: filled && bg ? C.ink700 : C.ink600,
        ...(filled && bg ? { background: bg, padding: "3px 9px", borderRadius: R.pill } : null),
      }}
    >
      <Dot color={color} />
      {label}
    </span>
  );
}

export function ProgressBar({
  pct,
  color = C.brand,
  track = C.subtle,
  height = 7,
  label,
}: {
  pct: number;
  /** Fill colour. Defaults to the brand green — the app's ONE accent, and the
   *  single governed meaning of a progress meter ("how far along / how healthy").
   *  Override only with a SEMANTIC colour (e.g. C.danger when behind schedule);
   *  never a decorative neutral. */
  color?: string;
  track?: string;
  height?: number;
  /** Descriptive context for AT (e.g. "Avancement du projet"). The percentage
   *  is appended automatically. */
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ? `${label} : ${Math.round(clamped)} %` : undefined}
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
  color = C.ink500,
  fill = true,
  gradient = false,
  endLabel,
  ariaLabel,
}: {
  values: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  gradient?: boolean;
  endLabel?: string;
  /** Descriptive label for AT — the trend is otherwise invisible to non-sighted
   *  users. Defaults to first→last summary. */
  ariaLabel?: string;
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
  const autoLabel = ariaLabel ?? `Tendance : de ${values[0]} à ${values[values.length - 1]}`;
  return (
    <div style={{ position: "relative" }} role="img" aria-label={autoLabel}>
      <svg aria-hidden width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
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
            ...num(14),
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

/** Radial health gauge — a 270° arc on a tonal track with a single-hue progress
 *  sweep and a tabular figure at its centre. The figure + arc length carry the
 *  reading; the sweep defaults to neutral ink (calm) and only takes a SEMANTIC
 *  hue when the caller passes one (e.g. the dashboard's health colour) — hue is
 *  reinforcement, never the only signal, and never decorative. Reduced-motion-safe
 *  (CSS transition only; honoured by the global prefers-reduced-motion rule). */
export function Gauge({
  value,
  max = 100,
  size = 132,
  thickness = 11,
  color = C.ink700,
  label,
  sublabel,
  ariaLabel,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: ReactNode;
  sublabel?: ReactNode;
  /** Descriptive label for AT. The visible count animates (wrong transient
   *  value), so the centre stack is aria-hidden and this carries the reading. */
  ariaLabel?: string;
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
  const autoLabel = ariaLabel ?? `${Math.round(pct * 100)} %`;
  return (
    <div role="img" aria-label={autoLabel} style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", transform: `rotate(${rot}deg)` }}>
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
      <div aria-hidden style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {label}
        {sublabel}
      </div>
    </div>
  );
}

// ───────────────────────────────────────── Dot

/** Small status/legend dot. The atom behind StatusPill/Chip dots — use directly
 *  for legends so the 6px circle is consistent everywhere. */
export function Dot({ color, size = 6, style }: { color: string; size?: number; style?: CSSProperties }) {
  return <span aria-hidden style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, ...style }} />;
}

// ───────────────────────────────────────── Badge / Count

/** Numeric/short badge. `tone` recolours; `dot` shows a leading status dot. Used
 *  for counts (nav, tabs), small status tags. */
export function Badge({
  children,
  tone = "neutral",
  dot = false,
  style,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "danger" | "warn" | "info";
  dot?: boolean;
  style?: CSSProperties;
}) {
  // Quiet by default: neutral is the resting tone. Colour is reserved for meaning
  // — danger (the one alert) keeps its red; warn keeps a single amber. `brand` is
  // the one positive identity accent; `info` rides the neutral well (no second
  // decorative hue — its ink simply darkens for emphasis).
  const tones: Record<string, { fg: string; bg: string }> = {
    neutral: { fg: C.ink600, bg: C.subtle },
    brand: { fg: C.brandText, bg: C.brand50 },
    danger: { fg: "#7A2820", bg: "#FAEEEB" },
    warn: { fg: "#9A4708", bg: "#FAF1E4" },
    info: { fg: C.ink700, bg: C.subtle },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        minWidth: 18,
        height: 18,
        padding: "0 6px",
        borderRadius: R.pill,
        ...num(12),
        fontWeight: 600,
        justifyContent: "center",
        color: t.fg,
        background: t.bg,
        ...style,
      }}
    >
      {dot ? <Dot color={t.fg} size={5} /> : null}
      {children}
    </span>
  );
}

// ───────────────────────────────────────── Kbd

/** Keyboard-shortcut hint key. Renders a single key cap; pass a string like
 *  "⌘K" or compose multiple <Kbd> for chords. */
export function Kbd({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: R.xs,
        border: `1px solid ${C.line}`,
        borderBottomWidth: 2,
        background: C.surface,
        color: C.ink600,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </kbd>
  );
}

// ───────────────────────────────────────── Switch (role=switch)

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  tone = "brand",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  tone?: "brand" | "ink";
}) {
  const accent = tone === "brand" ? C.brand : C.solid;
  const W = 36;
  const H = 20;
  const knob = 14;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="btn"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: W,
        height: H,
        flexShrink: 0,
        padding: 0,
        borderRadius: R.pill,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? accent : C.lineStrong,
        opacity: disabled ? 0.5 : 1,
        position: "relative",
        transition: "background var(--dur-base) var(--ease-standard)",
      }}
    >
      <motion.span
        aria-hidden
        animate={{ x: checked ? W - knob - 3 : 3 }}
        transition={SPRING.snappy}
        style={{
          position: "absolute",
          top: (H - knob) / 2,
          left: 0,
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: C.surface,
          boxShadow: SH.xs,
        }}
      />
    </button>
  );
}

// ───────────────────────────────────────── Tabs (roving-tabindex)

type TabItem = { value: string; label: ReactNode; count?: number };

/** Accessible tablist: roving tabindex, Arrow/Home/End keys, aria-controls wiring.
 *  Two looks: `underline` (editorial) and `pill` (segmented). Replaces the two
 *  hand-rolled tablists. Caller renders panels and reads `value`. */
export function Tabs({
  value,
  options,
  onChange,
  variant = "underline",
  idBase,
  style,
}: {
  value: string;
  options: TabItem[];
  onChange: (v: string) => void;
  variant?: "underline" | "pill";
  /** Stable base for the generated tab/panel ids (aria-controls). */
  idBase?: string;
  style?: CSSProperties;
}) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const next = (i + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(options.length - 1); }
  };
  const pill = variant === "pill";
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        gap: pill ? 2 : 4,
        ...(pill ? { background: C.subtle, borderRadius: R.sm, padding: 3 } : { borderBottom: `1px solid ${C.line}` }),
        ...style,
      }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`${base}-tab-${o.value}`}
            aria-selected={active}
            aria-controls={`${base}-panel-${o.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className="btn"
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              background: pill ? (active ? C.surface : "transparent") : "transparent",
              color: active ? C.ink900 : C.ink500,
              ...(pill
                ? { padding: "5px 12px", borderRadius: R.sm, boxShadow: active ? SH.sm : "none" }
                : { padding: "8px 4px", marginBottom: -1, borderBottom: `2px solid ${active ? C.ink900 : "transparent"}` }),
            }}
          >
            {o.label}
            {o.count != null ? <Badge tone={active ? "neutral" : "neutral"}>{o.count}</Badge> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Companion id helpers so panels match the Tabs aria wiring. */
export function tabPanelProps(idBase: string, value: string, active: string) {
  return {
    role: "tabpanel" as const,
    id: `${idBase}-panel-${value}`,
    "aria-labelledby": `${idBase}-tab-${value}`,
    hidden: value !== active,
  };
}

// ───────────────────────────────────────── Tooltip (portal, dark surface)

/** Accessible tooltip. Opens on hover AND keyboard focus, dismisses on Escape /
 *  blur / pointer-leave, renders into a portal on a dark C.ink900 surface (like
 *  the Toaster). Replaces native `title=` for help text. The trigger must be a
 *  single focusable element; `label` is wired via aria-describedby. */
export function Tooltip({
  label,
  children,
  placement = "top",
  delay = 250,
}: {
  label: ReactNode;
  children: ReactNode;
  placement?: "top" | "bottom";
  delay?: number;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const el = wrapRef.current?.firstElementChild ?? wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      x: r.left + r.width / 2,
      y: placement === "top" ? r.top - 8 : r.bottom + 8,
    });
  }, [placement]);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { place(); setOpen(true); }, delay);
  }, [place, delay]);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") hide(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hide]);

  return (
    <span
      ref={wrapRef}
      style={{ display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={() => { place(); setOpen(true); }}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {mounted && coords
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.span
                  role="tooltip"
                  id={id}
                  initial={{ opacity: 0, y: placement === "top" ? 4 : -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={SPRING.snappy}
                  style={{
                    position: "fixed",
                    left: coords.x,
                    top: coords.y,
                    transform: `translate(-50%, ${placement === "top" ? "-100%" : "0"})`,
                    zIndex: Z.toast + 1,
                    pointerEvents: "none",
                    maxWidth: 240,
                    background: C.ink900,
                    color: "#fff",
                    ...TX.nano,
                    fontWeight: 500,
                    padding: "5px 9px",
                    borderRadius: R.sm,
                    boxShadow: SH.overlay,
                    whiteSpace: "normal",
                  }}
                >
                  {label}
                </motion.span>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </span>
  );
}
