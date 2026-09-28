import { C } from "@/lib/tokens";

// Planning (Gantt) geometry, colour roles, zoom levels and optional columns.

export const PROJ_ROW_H = 48;

export const SUB_ROW_H = 30;

export const HEADER_H = 48; // two-tier sticky header — airy two-row rhythm

export const MIN_LEFT_W = 240;

export const MAX_LEFT_W = 560;

// Unified colour system: GREEN (C.brand) is the SINGLE accent — brand + progress
// + active/healthy. Everything else is warm neutral (tracks, structure). Assignee
// identity is carried by the left-cell avatar, so bars stay mono: a light neutral
// track with a green progress fill. No per-person rainbow, no near-black fill.
export const BAR_TRACK = "var(--data-track)"; // unfilled remainder / resting track (soft data track, C2)

export const PROGRESS = "var(--data-fill)"; // soft data-viz green fill (C2 — repeated bars use the tinted-down green, not full accent)

export const DONE_FILL = C.ink300; // "done" recedes to a receded neutral (+ check + hatch)

// Critical-path treatment: criticality is STRUCTURAL, carried by ONE restrained
// ink hairline ring — never by a black fill or a saturated colour. The fill stays
// green/neutral per the rules above (green = active); the ring marks "on the
// critical path" without competing with the green-means-progress language or the
// red-means-late semantics.
export const CP_RING = C.ink900;

export type Zoom = "fit" | "trimestre" | "mois" | "semaine" | "jour";

export type ColKey = "debut" | "fin" | "duree" | "marge" | "avancement";

export const ZOOM_PX: Record<Exclude<Zoom, "fit">, number> = {
  trimestre: 2.6,
  mois: 6,
  semaine: 13,
  jour: 34,
};

export const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "debut", label: "Début" },
  { key: "fin", label: "Fin" },
  { key: "duree", label: "Durée" },
  { key: "marge", label: "Marge" },
  { key: "avancement", label: "Avanc." },
];
