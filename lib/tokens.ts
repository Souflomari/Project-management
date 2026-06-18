import type { CSSProperties } from "react";

import type { Status } from "./types";

/** Primary UI font + numeric font — Inter (SOTA, Linear/Vercel-class). */
export const FONT_UI = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_NUM = FONT_UI;

// ───────────────────────────────────────────────── design tokens

/** Cool, timeless neutral ramp + one accent. No green-cast greys, no navy slab. */
export const C = {
  ink900: "#0E1217", // titles
  ink800: "#1C222B", // strong body
  ink700: "#3A424D", // body
  ink500: "#5C6571", // secondary
  ink400: "#8B95A1", // muted / placeholder
  line: "#ECEEF1", // resting hairline
  lineStrong: "#DDE1E6", // hover / modal border
  surface: "#FFFFFF",
  canvas: "#F7F8FA",
  subtle: "#F1F3F5", // track / segment / inset / rail
  brand: "#1A7F37",
  brandHover: "#156A2E",
  brand50: "#E7F3EB", // accent tint (selection / active)
  brandText: "#0E5A28", // text on tint
  brandDot: "#1FA34A",
} as const;

export const R = { xs: 6, sm: 8, md: 10, lg: 14, pill: 999 } as const;

export const SH = {
  sm: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
  md: "0 2px 4px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.08)",
  lg: "0 8px 16px rgba(16,24,40,.10), 0 24px 48px -12px rgba(16,24,40,.24)",
  drawer: "-16px 0 40px -16px rgba(16,24,40,.20)",
  focus: "0 0 0 3px rgba(26,127,55,.20)",
} as const;

/** Type scale by role. Body sits at 450 weight (Inter), headings at 600. */
export const TX: Record<
  "display" | "h1" | "h2" | "bodyLg" | "body" | "bodyStrong" | "caption" | "micro" | "overline",
  CSSProperties
> = {
  display: { fontSize: 28, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.2 },
  h1: { fontSize: 20, fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.3 },
  h2: { fontSize: 16, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.35 },
  bodyLg: { fontSize: 15, fontWeight: 450, lineHeight: 1.5 },
  body: { fontSize: 14, fontWeight: 450, lineHeight: 1.5 },
  bodyStrong: { fontSize: 14, fontWeight: 550, lineHeight: 1.5 },
  caption: { fontSize: 13, fontWeight: 450, lineHeight: 1.45 },
  micro: { fontSize: 12, fontWeight: 550, lineHeight: 1.4 },
  // sentence-case label (no uppercase, no heavy tracking) — replaces old overline
  overline: { fontSize: 12, fontWeight: 550, letterSpacing: "0", lineHeight: 1.35 },
};

/** Tabular numeric display (Inter), tight tracking for large figures. */
export function num(size: number): CSSProperties {
  return { fontFamily: FONT_NUM, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em", fontSize: size };
}

export interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

/** Tuned status palette (one lightness/chroma family per state). */
export const STATUS_META: Record<Status, StatusMeta> = {
  "à jour": { label: "À jour", color: "#1A7F37", bg: "#E7F3EB" },
  "à risque": { label: "À risque", color: "#B4690E", bg: "#FBEFDA" },
  "en retard": { label: "En retard", color: "#C5362C", bg: "#FBE9E7" },
  terminé: { label: "Terminé", color: "#5C6571", bg: "#F1F3F5" },
};

export function ringColor(status: Status): string {
  switch (status) {
    case "en retard": return "#C5362C";
    case "à risque": return "#B4690E";
    case "terminé": return "#9AA3AD";
    default: return "#1A7F37";
  }
}

export function dueColor(days: number, delivered: boolean): string {
  if (delivered) return "#8B95A1";
  if (days < 0) return "#C5362C";
  if (days <= 6) return "#1A7F37";
  return "#5C6571";
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

/** Accent per study phase (ESQ → RÉC) — cool, single-family ramp. */
export const PHASE_COLORS = ["#94A3B8", "#64908F", "#4C8AA3", "#3B7179", "#1A7F37", "#2C5A6B", "#7A6F63"];

/** Workload colour — calm green → amber → terracotta as load rises. */
export function chargeColor(pct: number): string {
  if (pct > 110) return "#B4532E";
  if (pct > 100) return "#C2683E";
  if (pct >= 85) return "#B4690E";
  return "#1A7F37";
}

/** Heatmap cell colour by load %. */
export function heatColor(pct: number): string {
  if (pct <= 0) return "#F1F3F5";
  if (pct < 50) return "#D7EADC";
  if (pct < 85) return "#86C39A";
  if (pct <= 100) return "#2F9B54";
  if (pct <= 110) return "#C2683E";
  return "#B4532E";
}
