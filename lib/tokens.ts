import type { CSSProperties } from "react";

import type { Status } from "./types";

/** Body / UI text — Inter. Headings & figures — Inter Tight (Linear uses
 *  "Inter Display" for headings to add expression; Inter Tight is its public twin). */
export const FONT_UI = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, -apple-system, sans-serif";
export const FONT_NUM = FONT_DISPLAY;

// ───────────────────────────────────────────────── design tokens
//
// Warm neutral scale (per Linear's refresh: "inch toward a warmer gray that
// still feels crisp, but less saturated"). Chrome (the green) is used sparingly
// — reserved for the brand mark and positive semantics, not for every control.
// Primary actions are near-black, so the UI reads neutral and timeless.

export const C = {
  ink900: "#1C1917", // primary text — darkened for content contrast
  ink800: "#292524", // strong body
  ink700: "#44403C", // body
  ink500: "#78716C", // secondary (receded)
  ink400: "#A8A29E", // muted / placeholder
  line: "#EEECE9", // soft warm hairline (low contrast — structure, not noise)
  lineStrong: "#E3E0DB", // hover / modal border
  surface: "#FFFFFF",
  canvas: "#FAFAF9", // warm off-white app background
  subtle: "#F5F4F2", // inset / track / hover / rail
  // near-black action surface (Vercel/Geist-style primary)
  solid: "#1C1917",
  solidHover: "#000000",
  // green — brand mark + positive semantics only
  brand: "#15803D",
  brandHover: "#166534",
  brand50: "#EDF4EE",
  brandText: "#15803D",
  brandDot: "#16A34A",
} as const;

export const R = { xs: 6, sm: 8, md: 10, lg: 14, xl: 18, pill: 999 } as const;

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
  "à jour": { label: "À jour", color: "#15803D", bg: "#EDF4EE" },
  "à risque": { label: "À risque", color: "#B45309", bg: "#FAF1E4" },
  "en retard": { label: "En retard", color: "#B5392E", bg: "#FAEEEB" },
  terminé: { label: "Terminé", color: "#78716C", bg: "#F5F4F2" },
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

/** Workload colour — calm green → amber → terracotta as load rises. */
export function chargeColor(pct: number): string {
  if (pct > 110) return "#B5532E";
  if (pct > 100) return "#C2683E";
  if (pct >= 85) return "#B45309";
  return "#15803D";
}

/** Heatmap cell colour by load %. */
export function heatColor(pct: number): string {
  if (pct <= 0) return "#F5F4F2";
  if (pct < 50) return "#DCEBE0";
  if (pct < 85) return "#8FC4A1";
  if (pct <= 100) return "#2E9153";
  if (pct <= 110) return "#C2683E";
  return "#B5532E";
}
