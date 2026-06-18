// Shared design tokens (fonts + status colours) ported from the "Design Setec"
// theme. Most layout colours are kept inline in components to match the source
// pixel-for-pixel; this module centralises the few values used across views.

import type { CSSProperties } from "react";

import type { Status } from "./types";

/** UI font (everything except numeric displays). */
export const FONT_UI = "'Montserrat', sans-serif";
/** Numeric / display font used for KPIs, percentages, dates (>= 14px only). */
export const FONT_NUM = "'Oswald', sans-serif";

// ───────────────────────────────────────────────── design tokens

/** One palette. Neutrals (the spine), a single brand green, the nav rail. */
export const C = {
  ink900: "#1A2329", // primary text
  ink700: "#45525B", // secondary text
  ink500: "#6B7780", // muted
  ink400: "#97A1A8", // faint
  line: "#E6EAE6", // hairline border / divider
  lineStrong: "#D4DAD3", // stronger border (hover, modal)
  surface: "#FFFFFF",
  canvas: "#F4F6F2", // app background
  subtle: "#EEF1EC", // inset / track / segmented bg
  brand: "#17823D",
  brandHover: "#126731",
  brand50: "#E6F1E9",
  brandDot: "#2E9E3F", // the single "live" green
  navy: "#1D4459", // nav rail
  navyMuted: "#8FB0B2",
  navyActive: "rgba(255,255,255,.12)",
} as const;

export const R = { sm: 4, md: 8, pill: 999 } as const;

export const SH = {
  sm: "0 1px 2px rgba(20,30,25,.06)",
  md: "0 4px 12px rgba(20,30,25,.10)",
  lg: "0 16px 40px -12px rgba(20,30,25,.28)",
  drawer: "-8px 0 32px -12px rgba(20,30,25,.18)",
  focus: "0 0 0 3px rgba(23,130,61,.18)",
} as const;

/** Type scale by role (Montserrat). Numbers use `num()`. */
export const TX: Record<
  "h1" | "h2" | "body" | "bodyStrong" | "caption" | "micro" | "overline",
  CSSProperties
> = {
  h1: { fontSize: 20, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.2 },
  h2: { fontSize: 16, fontWeight: 700, letterSpacing: "-.005em", lineHeight: 1.25 },
  body: { fontSize: 14, fontWeight: 500, lineHeight: 1.45 },
  bodyStrong: { fontSize: 14, fontWeight: 600, lineHeight: 1.45 },
  caption: { fontSize: 12, fontWeight: 500, lineHeight: 1.4 },
  micro: { fontSize: 11, fontWeight: 600, lineHeight: 1.35 },
  overline: { fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" },
};

/** Oswald numeric display (>= 14px). */
export function num(size: number): CSSProperties {
  return { fontFamily: FONT_NUM, fontWeight: 600, letterSpacing: ".01em", lineHeight: 1, fontVariantNumeric: "tabular-nums", fontSize: size };
}

export interface StatusMeta {
  label: string;
  /** Foreground / accent colour. */
  color: string;
  /** Soft background used for calendar chips. */
  bg: string;
}

export const STATUS_META: Record<Status, StatusMeta> = {
  "à jour": { label: "À jour", color: "#17823D", bg: "#E6F1E9" },
  "à risque": { label: "À risque", color: "#E1832F", bg: "#FBEEDD" },
  "en retard": { label: "En retard", color: "#A42421", bg: "#F7E4E3" },
  terminé: { label: "Terminé", color: "#6F6F6F", bg: "#EDEFEC" },
};

/** Colour used for progress bars, gantt fills and donut rings. */
export function ringColor(status: Status): string {
  switch (status) {
    case "en retard":
      return "#A42421";
    case "à risque":
      return "#E1832F";
    case "terminé":
      return "#9AA39B";
    default:
      return "#17823D";
  }
}

/** Colour for a "next deliverable" due label given days-to-due + delivered. */
export function dueColor(days: number, delivered: boolean): string {
  if (delivered) return "#9AA39B";
  if (days < 0) return "#A42421";
  if (days <= 6) return "#17823D";
  return "#6F6F6F";
}

/** Drawer palette — aliases onto the unified tokens. */
export const DRAWER = {
  ac: C.brand,
  ink: C.ink900,
  paper: C.surface,
  panel: C.subtle,
  line: C.line,
  sub: C.ink500,
} as const;

/** Accent per study phase (ESQ → RÉC), used by Kanban headers + calendar chips. */
export const PHASE_COLORS = [
  "#9AA39B", // ESQ
  "#7FA0A3", // APS
  "#4C8AA3", // APD
  "#3B7179", // PRO
  "#17823D", // DCE
  "#1D4459", // EXE
  "#6A6557", // RÉC
];

/**
 * Workload colour. Softer than the status red — overallocation should read as a
 * management signal (muted terracotta), not a system error.
 */
export function chargeColor(pct: number): string {
  if (pct > 110) return "#B4532E"; // deep terracotta
  if (pct > 100) return "#C2683E"; // terracotta
  if (pct >= 85) return "#E1832F"; // amber
  return "#17823D"; // green
}

/** Heatmap cell colour by load %, used by the team weekly heatmap. */
export function heatColor(pct: number): string {
  if (pct <= 0) return "#EEF1EC";
  if (pct < 50) return "#CDE4D3";
  if (pct < 85) return "#7FB98C";
  if (pct <= 100) return "#3F9B54";
  if (pct <= 110) return "#E1832F";
  return "#C2683E";
}
