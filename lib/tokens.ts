import type { CSSProperties } from "react";

import type { Status } from "./types";

/** Body / UI text — Inter. Headings & figures — Inter Tight (Linear uses
 *  "Inter Display" for headings to add expression; Inter Tight is its public twin). */
export const FONT_UI = "var(--font-ui), system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_DISPLAY = "var(--font-display), var(--font-ui), system-ui, -apple-system, sans-serif";
export const FONT_NUM = FONT_DISPLAY;

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
  ink400: "#9B948F", // muted text floor / placeholder (evened ramp)
  ink300: "#BDB8B2", // disabled text/control
  line: "#EEECE9", // soft warm hairline (low contrast — structure, not noise)
  lineStrong: "#E3E0DB", // hover / modal border
  surface: "#FFFFFF",
  canvas: "#FAFAF9", // warm off-white app background
  subtle: "#F5F4F2", // inset / track / hover / rail
  // near-black action surface (Vercel/Geist-style primary)
  solid: "#1C1917",
  solidHover: "#000000",
  // green — brand mark + positive semantics only (one governed hue)
  brand: "#15803D",
  brandHover: "#166534",
  brand50: "#EDF4EE",
  brandText: "#136B35", // text on brand50 (AA)
  brandDot: "#1E8E48", // small-element green — tonal sibling of brand, not neon
  danger: "#B5392E", // single danger hue
} as const;

/** Curated assignee/avatar palette — one governed set used by the modal,
 *  sample data, and repository so colours never diverge. */
export const AVATAR_PALETTE = [
  "#15803D", "#2C7A8C", "#4C8AA3", "#B45309", "#B5392E",
  "#3B7179", "#8A6F5C", "#2F4A63", "#6A6F7A", "#6E6486",
] as const;

export const R = { xs: 6, sm: 8, md: 10, lg: 14, xl: 18, pill: 999 } as const;

/** 4px-based spacing scale. Use instead of ad-hoc inline magic numbers. */
export const SP = { 0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24, 8: 32, 9: 40, 10: 48, 11: 64 } as const;

// Soft, low-contrast elevation. Surfaces mostly rest borderless-or-bordered with
// no shadow; shadow appears on lift / overlays only.
export const SH = {
  sm: "0 1px 2px rgba(28,25,23,.04)",
  md: "0 4px 16px -4px rgba(28,25,23,.10), 0 2px 4px -2px rgba(28,25,23,.06)",
  lg: "0 16px 48px -12px rgba(28,25,23,.18), 0 4px 12px -4px rgba(28,25,23,.08)",
  drawer: "-12px 0 40px -16px rgba(28,25,23,.18)",
  focus: "0 0 0 3px rgba(28,25,23,.10)",
} as const;

/** Type scale by role. Headings use Inter Tight (tight tracking, real weight);
 *  body recedes at 14/440. Hierarchy by size + weight + colour, not boxes. */
export const TX: Record<
  "display" | "h1" | "h2" | "bodyLg" | "body" | "bodyStrong" | "caption" | "micro" | "overline",
  CSSProperties
> = {
  display: { fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 600, letterSpacing: "-.022em", lineHeight: 1.12 },
  h1: { fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.22 },
  h2: { fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, letterSpacing: "-.012em", lineHeight: 1.35 },
  bodyLg: { fontSize: 15, fontWeight: 440, lineHeight: 1.55 },
  body: { fontSize: 14, fontWeight: 440, lineHeight: 1.55 },
  bodyStrong: { fontSize: 14, fontWeight: 540, lineHeight: 1.5 },
  caption: { fontSize: 13, fontWeight: 440, lineHeight: 1.5 },
  micro: { fontSize: 12, fontWeight: 500, lineHeight: 1.4 },
  // quiet sentence-case label (no uppercase, no heavy tracking)
  overline: { fontSize: 12, fontWeight: 520, letterSpacing: "0", lineHeight: 1.35 },
};

/** Tabular numeric display (Inter Tight), tight tracking for large figures. */
export function num(size: number): CSSProperties {
  return { fontFamily: FONT_NUM, fontWeight: 580, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em", fontSize: size };
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

/** Accent per study phase (ESQ → RÉC) — muted, single-family ramp. */
export const PHASE_COLORS = ["#9C9488", "#6E8E84", "#5C81A0", "#4E7B82", "#3F8E5E", "#6C7286", "#8C7A66"];

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

/** Workload colour — calm green → amber → terracotta as load rises. */
export function chargeColor(pct: number): string {
  switch (loadTier(pct)) {
    case "crit": return "#B5532E";
    case "over": return "#C2683E";
    case "high": return "#B45309";
    default: return "#15803D";
  }
}

/** Heatmap cell colour by load % — strictly darkening sage → terracotta ramp. */
export function heatColor(pct: number): string {
  if (pct <= 0) return "#F2F1EF";
  if (pct < 50) return "#E4ECE6";
  if (pct < 85) return "#C2D8C7";
  if (pct <= 100) return "#9FC0A6"; // full but within capacity
  if (pct <= 110) return "#D2895F"; // slightly over (clearly darker + warmer)
  return "#B5532E"; // well over — matches chargeColor "crit"
}
