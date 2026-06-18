// Shared design tokens (fonts + status colours) ported from the "Design Setec"
// theme. Most layout colours are kept inline in components to match the source
// pixel-for-pixel; this module centralises the few values used across views.

import type { Status } from "./types";

/** UI font (everything except numeric displays). */
export const FONT_UI = "'Montserrat', sans-serif";
/** Numeric / display font used for KPIs, percentages, dates. */
export const FONT_NUM = "'Oswald', sans-serif";

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

/** Drawer (single "Design Setec" theme) colour palette. */
export const DRAWER = {
  ac: "#17823D",
  ink: "#233038",
  paper: "#FFFFFF",
  panel: "#F1F3EF",
  line: "#E2E6E0",
  sub: "#6F6F6F",
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
