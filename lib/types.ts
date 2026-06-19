// Domain model for the Setec project-portfolio tool.
// UI/formatting-free so the sample data source can be swapped for Supabase.

export const PHASES = ["ESQ", "APS", "APD", "PRO", "DCE", "EXE", "RÉC"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASES_FULL = [
  "Esquisse",
  "Avant-projet sommaire",
  "Avant-projet définitif",
  "Projet",
  "Dossier de consultation",
  "Exécution",
  "Réception",
] as const;

export const FINAL_PHASE_INDEX = PHASES.length - 1;

export const STATUSES = ["à jour", "à risque", "en retard", "terminé"] as const;
export type Status = (typeof STATUSES)[number];

export interface TeamMember {
  id: number;
  name: string;
  initials: string;
  color: string;
  role: string;
  /** Loaded daily rate — euros per working day (drives budget / earned value). */
  costPerDay: number;
}

/**
 * A task / sous-tâche within a project — the editable unit that drives the
 * planning, the calendar and the team workload.
 */
export interface Subtask {
  id: number;
  name: string;
  /** Assigned team member (TeamMember.id). */
  assigneeId: number;
  /** ISO start date (yyyy-mm-dd). */
  start: string;
  /** Planned effort in working days (end date is derived from this). */
  plannedDays: number;
  done: boolean;
  /** Predecessor task ids (same project) — Finish-to-Start dependencies. */
  dependsOn: number[];
}

export interface Comment {
  author: string;
  initials: string;
  color: string;
  text: string;
  when: string;
}

export interface Project {
  id: number;
  name: string;
  /** Client — maître d'ouvrage. */
  client: string;
  discipline: string;
  /** Project lead — references TeamMember.id. */
  responsableId: number;
  /** Index into PHASES (0..6). */
  phaseIndex: number;
  status: Status;
  /** Fees — honoraires — in thousands of euros (k€). */
  budget: number;
  /** ISO start date. */
  start: string;
  /** ISO final deadline. */
  deadline: string;
  /** Editable tasks. Progress & next deliverable are derived from these. */
  subtasks: Subtask[];
  comments: Comment[];
}

export interface NewSubtaskInput {
  name: string;
  assigneeId: number;
  start: string;
  plannedDays: number;
  dependsOn?: number[];
}

export interface NewTeamMemberInput {
  name: string;
  initials: string;
  color: string;
  role: string;
  /** Loaded daily rate — euros per working day. Defaults applied by the repo. */
  costPerDay?: number;
}
