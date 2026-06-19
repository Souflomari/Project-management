import type { CSSProperties } from "react";

import type { Status } from "./types";

/** Geist for everything — one cohesive, premium grotesk. Hierarchy comes from
 *  size + weight, not a second face. Geist has first-class tabular numerals, so
 *  the display/number roles share the family. */
export const FONT_UI = "var(--font-geist-sans), system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_DISPLAY = FONT_UI;
export const FONT_NUM = FONT_UI;

// ───────────────────────────────────────────────── design tokens
//
// Warm neutral scale (per Linear's refresh: "inch toward a warmer gray that
// still feels crisp, but less saturated"). Chrome (the green) is used sparingly
// — reserved for the brand mark and positive semantics, not for every control.
// Primary actions are near-black, so the UI reads neutral and timeless.

export const C = {
  ink900: "#1C1917", // primary text — darkened for content contrast
  ink800: "#2E2A27", // strong body (evened L* step from 900)
  ink700: "#44403C", // body
  ink600: "#574F4A", // tertiary text (bridges the 700→500 gap)
  ink500: "#78716C", // secondary (receded) — AA floor for body text ≈ 4.7:1
  ink400: "#6F6862", // muted label / eyebrow — 5.48:1 on white (was #857E78 ≈ 4.0:1, just under AA). Small 11–12px labels need ≥4.5:1; there is no lighter-than-ink500 grey that clears AA, so this tier sits at full legibility.
  ink300: "#BDB8B2", // disabled text/control
  line: "#EAE8E4", // hairline — visible on the unified white field without reading as noise
  lineStrong: "#DAD7D1", // hover / modal border / visible divider
  surface: "#FFFFFF",
  canvas: "#FFFFFF", // unified white app background — depth now comes from borders + soft shadow, not tone
  subtle: "#F4F3F1", // inset / track / rail — a clean near-neutral well on white
  hover: "#EFF6F1", // faint green wash for hover affordances (brand-tinted)
  hoverBorder: "#C9E2D2", // green-tinted border on hover / lift
  hoverStrong: "#E4F1E8", // stronger green hover (pressed / emphasised affordance)
  // near-black action surface (Vercel/Geist-style primary)
  solid: "#1C1917",
  solidHover: "#000000",
  // green — brand mark + positive semantics only (one governed hue)
  brand: "#15803D",
  brandHover: "#166534",
  brand50: "#EDF4EE",
  brandText: "#136B35", // text on brand50 (AA)
  brandDot: "#1E8E48", // small-element green — tonal sibling of brand, not neon
  inversePrimary: "#6FCF8E", // green legible on the dark (inverse) toast surface
  ink350: "#A8A29E", // named warm grey between ink400/ink300 (gantt secondary, rings)
  danger: "#B5392E", // single danger hue
  surfaceHigh: "#FFFFFF", // raised overlays — white, lifted by shadow (not tone)
  surfaceLow: "#F4F3F1", // tracks / insets, a step below cards
} as const;

/** Assignee/avatar palette — minimalism: a calm set of LOW-CHROMA dark neutrals
 *  (slate / stone / muted-teal / plum-grey) rather than saturated hues, so avatar
 *  stacks read as quiet, not as a rainbow. Every swatch stays dark enough that
 *  white initials clear WCAG AA (≥4.5:1); members are distinguished mainly by
 *  their initials, colour is only a subtle secondary cue. */
export const AVATAR_PALETTE = [
  "#4F5A63", "#5A5750", "#46555A", "#5E5560", "#4C5466",
  "#5B5347", "#4F5E68", "#565160", "#4D564F", "#605C64",
] as const;

// ── M3 tonal surface roles ──────────────────────────────────────────────────
// Material 3 models elevation as *tone*, not just shadow: higher containers sit
// on progressively deeper tints of the neutral. Mapped onto our warm scale so a
// component asks for a role ("a container, one step up") instead of a raw hex —
// and a future dark theme only has to remap these six values.
// Unified white field: raised surfaces (base/lowest/low) are white and read as
// lifted via border + shadow; the higher steps are clean neutral wells used for
// insets / tracks / pressed states.
export const SURFACE = {
  base: "#FFFFFF", // app canvas (unified white)
  containerLowest: "#FFFFFF", // raised cards & dialogs
  containerLow: "#FFFFFF", // raised overlays (lifted by shadow)
  container: "#F4F3F1", // default filled container / track / inset
  containerHigh: "#ECEBE8", // deeper inset, rails, hover wells
  containerHighest: "#E4E3DF", // deepest inset / pressed track
} as const;

// ── M3 state-layer opacities ─────────────────────────────────────────────────
// Interaction is a translucent overlay of an "on" colour at a fixed opacity per
// state (M3's state-layer model), so feedback is uniform across every control
// regardless of the surface beneath it.
export const STATE = { hover: 0.06, focus: 0.1, press: 0.1, drag: 0.16 } as const;

// Shape scale (M3-aligned, kept tighter for the Linear/Vercel feel). `xxl` (28)
// is the expressive tier for sheets / FAB / hero containers.
export const R = { none: 0, xxs: 4, xs: 6, sm: 8, md: 10, lg: 14, xl: 18, xxl: 28, pill: 999 } as const;

/** 4px-based spacing scale. Use instead of ad-hoc inline magic numbers. */
export const SP = { 0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24, 8: 32, 9: 40, 10: 48, 11: 64 } as const;

// Monotonic two-layer elevation: every tier pairs a tight contact shadow (low y,
// low blur) with a soft key shadow (higher y, large blur, negative spread), one
// constant top-light direction. The resting `sm` is now actually visible so cards
// read as raised on the white field instead of painted-on. `overlay` is the
// deepest tier reserved for modal / drawer / command-palette / toast — nothing
// in-canvas (incl. hover) should reach it, so the elevation hierarchy stays legible.
export const SH = {
  xs: "0 1px 1px rgba(28,25,23,.04), 0 1px 2px -1px rgba(28,25,23,.05)",
  sm: "0 1px 2px rgba(28,25,23,.05), 0 2px 6px -1px rgba(28,25,23,.06)",
  md: "0 2px 4px -1px rgba(28,25,23,.06), 0 8px 20px -4px rgba(28,25,23,.10)",
  lg: "0 4px 8px -2px rgba(28,25,23,.07), 0 16px 36px -8px rgba(28,25,23,.14)",
  overlay: "0 8px 16px -6px rgba(28,25,23,.10), 0 28px 60px -16px rgba(28,25,23,.22)",
  drawer: "-16px 0 48px -24px rgba(28,25,23,.22), -1px 0 1px rgba(28,25,23,.05)",
  // brand-green focus ring with a white gap — solid green clears the WCAG 2.4.11
  // ≥3:1 indicator-contrast bar (the prior .20-alpha wash was ~1.3:1, invisible).
  focus: "0 0 0 2px #FFFFFF, 0 0 0 4px #15803D",
} as const;

// ── M3 colour roles ──────────────────────────────────────────────────────────
// Semantic role layer over the raw `C` palette. Components speak roles
// ("primary", "onSurfaceVariant", "outline") so the visual language is governed
// and a future theme is a remap, not a rewrite. Action-primary is near-black
// (the Vercel/Geist identity); the one governed green is the positive accent;
// `tertiary` is a muted slate-teal drawn from AVATAR_PALETTE — info-only, never a
// second brand and never a success signal (that stays green).
export const ROLE = {
  primary: C.solid, // #1C1917 — near-black action
  onPrimary: "#FFFFFF",
  primaryContainer: SURFACE.containerHighest, // tonal "filled" well for quiet actions
  onPrimaryContainer: C.ink900,
  secondary: C.brand, // #15803D — positive / brand
  onSecondary: "#FFFFFF",
  secondaryContainer: C.brand50,
  onSecondaryContainer: C.brandText,
  tertiary: "#2F6E7A", // governed muted teal (info / neutral accent only)
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#E2EEF0",
  onTertiaryContainer: "#1E4D55",
  error: C.danger,
  onError: "#FFFFFF",
  errorContainer: "#FAEEEB",
  onErrorContainer: "#7A2820",
  surface: SURFACE.base,
  onSurface: C.ink900,
  onSurfaceVariant: C.ink500, // AA secondary text
  outline: C.lineStrong, // stronger divider / control border
  outlineVariant: C.line, // hairline
  inverseSurface: C.ink900,
  inverseOnSurface: C.subtle,
  inversePrimary: C.inversePrimary,
} as const;

// ── Motion tokens ────────────────────────────────────────────────────────────
// M3 easing + Linear snappiness. One source for every transition/animation so
// timing is consistent (was a copy-pasted cubic-bezier across 4 files).
export const EASE = {
  standard: "cubic-bezier(.2,0,0,1)", // most UI changes
  decel: "cubic-bezier(0,0,0,1)", // elements entering
  accel: "cubic-bezier(.3,0,1,1)", // elements leaving
  emphasized: "cubic-bezier(.05,.7,.1,1)", // expressive enter
  out: "cubic-bezier(.2,.7,.2,1)", // the existing pop curve — keep
} as const;
export const DUR = { fast: "120ms", base: "180ms", slow: "260ms", slower: "400ms" } as const;

/** Spring presets for framer-motion (the house physics). One source so every
 *  layout/hover/gesture animation shares feel instead of inline-tuned springs. */
export const SPRING = {
  snappy: { type: "spring", stiffness: 380, damping: 30 },
  gentle: { type: "spring", stiffness: 220, damping: 26 },
  bouncy: { type: "spring", stiffness: 500, damping: 28 },
} as const;

/** Stacking order — one governed ladder so overlays never collide ad-hoc. */
export const Z = { base: 0, sticky: 30, drawer: 60, modal: 70, palette: 80, toast: 90 } as const;

/** Comfortable reading measure for running text (comments, descriptions). */
export const MEASURE = "66ch";

// ── Elevation (tone-first) ───────────────────────────────────────────────────
// M3 expresses elevation primarily as surface TONE; we add a whisper of shadow
// only to confirm a lift. Border-first identity preserved.
export const ELEV: Record<0 | 1 | 2 | 3, CSSProperties> = {
  0: { background: "#FFFFFF", boxShadow: "none" },
  1: { background: "#FFFFFF", boxShadow: SH.sm },
  2: { background: "#FFFFFF", boxShadow: SH.md },
  3: { background: "#FFFFFF", boxShadow: SH.lg },
};

/** Type scale by role. Headings use Inter Tight (tight tracking, real weight);
 *  body recedes at 14/440. Hierarchy is carried by SIZE first, then weight and
 *  colour — an editorial range from 11px eyebrow up to a 40px display. */
export const TX: Record<
  | "displayLg" | "display" | "h1" | "h2" | "sectionHd"
  | "bodyLg" | "body" | "bodyStrong" | "caption" | "micro" | "nano"
  | "overline" | "eyebrow",
  CSSProperties
> = {
  displayLg: { fontFamily: FONT_DISPLAY, fontSize: 44, fontWeight: 600, letterSpacing: "-.027em", lineHeight: 1.05 },
  display: { fontFamily: FONT_DISPLAY, fontSize: 35, fontWeight: 600, letterSpacing: "-.024em", lineHeight: 1.1 },
  h1: { fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, letterSpacing: "-.022em", lineHeight: 1.18 },
  sectionHd: { fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 600, letterSpacing: "-.018em", lineHeight: 1.2 },
  h2: { fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.28 },
  bodyLg: { fontSize: 16, fontWeight: 450, lineHeight: 1.55 },
  body: { fontSize: 15, fontWeight: 450, lineHeight: 1.55 },
  bodyStrong: { fontSize: 15, fontWeight: 560, lineHeight: 1.5 },
  caption: { fontSize: 14, fontWeight: 450, lineHeight: 1.5 },
  micro: { fontSize: 12.5, fontWeight: 500, lineHeight: 1.42 },
  nano: { fontSize: 11.5, fontWeight: 500, lineHeight: 1.35 },
  // quiet sentence-case label (no uppercase, no heavy tracking)
  overline: { fontSize: 12.5, fontWeight: 560, letterSpacing: "0", lineHeight: 1.35 },
  // category/metadata label — uppercase, tracked (use sparingly, ≤2-word tags)
  eyebrow: { fontSize: 11.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", lineHeight: 1.3 },
};

/** Tabular numeric display (Geist). Geist's figures are even and well-spaced;
 *  a slight negative tracking tightens large readouts without cramping. */
export function num(size: number): CSSProperties {
  return { fontFamily: FONT_NUM, fontWeight: 560, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em", fontSize: size };
}

export interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

/** Muted, warm status palette — legible dots, not traffic-light slabs. */
export const STATUS_META: Record<Status, StatusMeta> = {
  "à jour": { label: "À jour", color: "#136B35", bg: "#EDF4EE" },
  "à risque": { label: "À risque", color: "#9A4708", bg: "#FAF1E4" },
  "en retard": { label: "En retard", color: "#B5392E", bg: "#FAEEEB" },
  terminé: { label: "Terminé", color: "#6B645F", bg: "#F5F4F2" },
};

export function ringColor(status: Status): string {
  switch (status) {
    case "en retard": return "#B5392E";
    case "à risque": return "#B45309";
    case "terminé": return "#A8A29E";
    default: return "#15803D";
  }
}

export function dueColor(days: number, delivered: boolean): string {
  if (delivered) return "#A8A29E";
  if (days < 0) return "#B5392E";
  if (days <= 6) return "#15803D";
  return "#78716C";
}

/** Drawer palette — aliases onto the unified tokens. `ac` = action (near-black),
 *  `done` = positive/complete (green). */
export const DRAWER = {
  ac: C.solid,
  done: C.brand,
  ink: C.ink900,
  paper: C.surface,
  panel: C.subtle,
  line: C.line,
  sub: C.ink500,
} as const;

/** Phase ramp (ESQ → RÉC) — minimalism: a single low-chroma slate progression,
 *  light→dark, so phases stay ordered and distinguishable WITHOUT a rainbow. The
 *  letter code (ESQ/APS/…) carries identity; colour only reinforces sequence. */
export const PHASE_COLORS = ["#B7BAC1", "#A4A8B2", "#9297A3", "#7F8593", "#6D7484", "#5C6376", "#4C5466"];

/** Load tier — single source of truth so the headline colour and the heatmap
 *  cell always agree. Breakpoints 85 / 100 / 110. */
export type LoadTier = "low" | "high" | "full" | "over" | "crit";
export function loadTier(pct: number): LoadTier {
  if (pct > 110) return "crit";
  if (pct > 100) return "over";
  if (pct >= 85) return "high";
  if (pct > 0) return "full";
  return "low";
}

/** Workload colour — minimalism: green while within capacity, ONE amber when
 *  high, ONE red when over (no three-way warm spread). */
export function chargeColor(pct: number): string {
  switch (loadTier(pct)) {
    case "crit":
    case "over": return C.danger; // over capacity → single danger red
    case "high": return "#B45309"; // single amber
    default: return C.brand; // within capacity → identity green
  }
}

/** Heatmap cell colour by load % — Von Restorff: keep within-capacity cells
 *  QUIET (a low-chroma neutral→soft-green intensity, so a healthy team reads as
 *  calm, not a green field) and let ONLY the genuine over-capacity weeks carry a
 *  muted clay alert that actually pops. The cell's % figure carries the precise
 *  load; colour is reinforcement for the exception, not decoration on every cell. */
export function heatColor(pct: number): string {
  if (pct <= 0) return "#F4F3F1"; // empty — neutral well
  if (pct < 50) return "#ECEDEA"; // light load — near-neutral
  if (pct < 85) return "#DDE5DC"; // moderate — faint green-grey
  if (pct <= 100) return "#C4D4C5"; // at capacity — the clearest (still soft) green
  return "#CC7E68"; // over capacity → ONE muted clay (matches chargeColor over/crit)
}

// ── CSS-variable bridge ──────────────────────────────────────────────────────
// The JS token objects above stay the single source of truth; this projects them
// onto CSS custom properties so stylesheets (which can't import TS) reference the
// *same* values, and a theme swap becomes "remap :root", not "edit every file".

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** A `:root { … }` block declaring every token as a custom property. Injected
 *  once in the root layout; safe to render server-side (values are static). */
export function tokenCssVars(): string {
  const decls: string[] = [];
  for (const [k, v] of Object.entries(C)) decls.push(`--c-${kebab(k)}:${v}`);
  for (const [k, v] of Object.entries(SURFACE)) decls.push(`--surface-${kebab(k)}:${v}`);
  for (const [k, v] of Object.entries(STATE)) decls.push(`--state-${k}:${v}`);
  for (const [k, v] of Object.entries(ROLE)) decls.push(`--role-${kebab(k)}:${v}`);
  for (const [k, v] of Object.entries(EASE)) decls.push(`--ease-${kebab(k)}:${v}`);
  for (const [k, v] of Object.entries(DUR)) decls.push(`--dur-${k}:${v}`);
  return `:root{${decls.join(";")}}`;
}

type Ref<T> = Record<keyof T, string>;
const refs = <T extends Record<string, unknown>>(o: T, prefix: string): Ref<T> =>
  Object.fromEntries(Object.keys(o).map((k) => [k, `var(--${prefix}-${kebab(k)})`])) as Ref<T>;

/** `var(--c-*)` references for opt-in themeable inline styles (mirrors `C`). */
export const CV = refs(C, "c");
/** `var(--surface-*)` references for the tonal surface roles (mirrors `SURFACE`). */
export const SV = refs(SURFACE, "surface");
/** `var(--role-*)` references for the M3 colour roles (mirrors `ROLE`). */
export const ROLEV = refs(ROLE, "role");
