// Domain model for the Setec project-portfolio tool.
// This layer is intentionally free of any UI / formatting concern so that the
// sample data source can be swapped for Supabase later without touching it.

/** Study phases of an engineering project (RÉC = Réception, terminal phase). */
export const PHASES = ["ESQ", "APS", "APD", "PRO", "DCE", "EXE", "RÉC"] as const;
export type Phase = (typeof PHASES)[number];

/** Long label for each phase, index-aligned with PHASES. */
export const PHASES_FULL = [
  "Esquisse",
  "Avant-projet sommaire",
  "Avant-projet définitif",
  "Projet",
  "Dossier de consultation",
  "Exécution",
  "Réception",
] as const;

/** The phase whose index marks completion (RÉC). */
export const FINAL_PHASE_INDEX = PHASES.length - 1;

export const STATUSES = ["à jour", "à risque", "en retard", "terminé"] as const;
export type Status = (typeof STATUSES)[number];

export interface TeamMember {
  /** Stable id (array index in sample data; becomes a FK with Supabase). */
  id: number;
  /** Display name, e.g. "C. Mercier". */
  name: string;
  /** Two-letter avatar initials. */
  initials: string;
  /** Brand colour used for the member's avatar / charts. */
  color: string;
  role: string;
}

export interface Deliverable {
  label: string;
  done: boolean;
}

export interface Comment {
  author: string;
  initials: string;
  color: string;
  text: string;
  /** Human-friendly relative time, e.g. "il y a 2 j". */
  when: string;
}

export interface Project {
  id: number;
  /** Project name. */
  name: string;
  /** Client — maître d'ouvrage. */
  client: string;
  discipline: string;
  /** Responsible person — references TeamMember.id. */
  responsableId: number;
  /** Index into PHASES (0..6). */
  phaseIndex: number;
  /** Completion percentage, 0..100. */
  progress: number;
  status: Status;
  /** Fees — honoraires — stored in thousands of euros (k€). */
  budget: number;
  /** ISO start date (yyyy-mm-dd). */
  start: string;
  /** ISO final deadline (yyyy-mm-dd). */
  deadline: string;
  /** Next deliverable and its due date. */
  rendu: { label: string; date: string };
  /** Whether the next deliverable has been delivered. */
  renduDone: boolean;
  /** Team members on the project — references TeamMember.id. */
  memberIds: number[];
  /** Deliverable checklist for the project. */
  checklist: Deliverable[];
  comments: Comment[];
}
