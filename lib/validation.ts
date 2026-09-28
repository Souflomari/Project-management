// Input validation shared by the server actions, both repositories and the
// client store. Anything that reaches a repository — typed in a form, sent by a
// view, or POSTed to a server action by anyone — goes through these schemas, so
// demo mode and Supabase mode enforce the same rules. Messages are French and
// user-facing: the store shows them as toasts.
//
// Limits mirror the CHECK constraints in supabase/schema.sql.

import { z } from "zod";

import type { NewProjectInput, ProjectPatch, SubtaskPatch, TeamMemberPatch } from "./data/repository";
import { REFERENCE_DATE, toDate, toISO } from "./format";
import {
  PHASES,
  STATUSES,
  type NewSubtaskInput,
  type NewTeamMemberInput,
  type Status,
  type Subtask,
  type TeamMember,
} from "./types";

// ---------------------------------------------------------------- errors

/** An error whose message is meant for the user (French, safe to display). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** Input rejected by a schema or a cross-field / referential rule. */
export class ValidationError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const MEMBER_IN_USE_MESSAGE =
  "Ce membre est responsable de projets ou assigné à des tâches. Réassignez ses projets et tâches avant de le supprimer.";
export const DEADLINE_BEFORE_START_MESSAGE = "L’échéance doit être postérieure ou égale à la date de début.";

// ---------------------------------------------------------------- limits

export const LIMITS = {
  projectName: 200,
  client: 200,
  discipline: 120,
  subtaskName: 200,
  memberName: 80,
  role: 80,
  initials: 4,
  comment: 5000,
  plannedDaysMax: 1000,
  budgetMax: 10_000_000, // k€
  costPerDayMax: 100_000, // €/day
} as const;

// ---------------------------------------------------------------- primitives

const requiredText = (max: number, required: string, tooLong: string) =>
  z.string({ error: required }).trim().min(1, required).max(max, tooLong);

const optionalText = (max: number, tooLong: string) => z.string().trim().max(max, tooLong);

/** True for a real calendar date written yyyy-mm-dd (rejects 2026-02-30). */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const isoDate = (label: string) =>
  z
    .string({ error: `${label} : date requise.` })
    .min(1, `${label} : date requise.`)
    .refine(isIsoDate, `${label} : date invalide (format AAAA-MM-JJ).`);

const memberRef = z.int({ error: "Membre inconnu." }).min(0, "Membre inconnu.");
const subtaskRef = z.int({ error: "Tâche inconnue." }).min(1, "Tâche inconnue.");

export const idSchema = z.int({ error: "Identifiant invalide." }).min(0, "Identifiant invalide.");
export const phaseIndexSchema = z
  .int({ error: "Phase inconnue." })
  .min(0, "Phase inconnue.")
  .max(PHASES.length - 1, "Phase inconnue.");
export const statusSchema = z.enum(STATUSES, { error: "Statut inconnu." });
export const commentTextSchema = requiredText(
  LIMITS.comment,
  "Le commentaire est vide.",
  `Le commentaire ne doit pas dépasser ${LIMITS.comment} caractères.`,
);

const budget = z
  .number({ error: "Les honoraires doivent être un nombre (k€)." })
  .int("Les honoraires doivent être un nombre entier (k€).")
  .min(0, "Les honoraires ne peuvent pas être négatifs.")
  .max(LIMITS.budgetMax, "Honoraires trop élevés.");

const plannedDays = z
  .number({ error: "La durée doit être un nombre de jours." })
  .int("La durée doit être un nombre entier de jours.")
  .min(1, "La durée doit être d’au moins 1 jour.")
  .max(LIMITS.plannedDaysMax, `La durée ne peut pas dépasser ${LIMITS.plannedDaysMax} jours.`);

const costPerDay = z
  .number({ error: "Le taux journalier doit être un nombre." })
  .int("Le taux journalier doit être un nombre entier (€).")
  .min(0, "Le taux journalier ne peut pas être négatif.")
  .max(LIMITS.costPerDayMax, "Taux journalier trop élevé.");

const color = z
  .string({ error: "Couleur invalide (format #RRGGBB)." })
  .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide (format #RRGGBB).");

const dependsOn = z
  .array(subtaskRef, { error: "Dépendances invalides." })
  .transform((ids) => [...new Set(ids)]);

// ---------------------------------------------------------------- schemas

const projectName = requiredText(
  LIMITS.projectName,
  "L’intitulé du projet est requis.",
  `L’intitulé du projet ne doit pas dépasser ${LIMITS.projectName} caractères.`,
);
const clientText = `Le maître d’ouvrage ne doit pas dépasser ${LIMITS.client} caractères.`;
const discipline = requiredText(
  LIMITS.discipline,
  "La discipline est requise.",
  `La discipline ne doit pas dépasser ${LIMITS.discipline} caractères.`,
);

export const newProjectSchema = z.object({
  name: projectName,
  client: optionalText(LIMITS.client, clientText).optional(),
  responsableId: memberRef,
  discipline: optionalText(LIMITS.discipline, `La discipline ne doit pas dépasser ${LIMITS.discipline} caractères.`).optional(),
  budget: budget.optional(),
  phaseIndex: phaseIndexSchema.optional(),
  start: isoDate("Début").optional(),
  deadline: isoDate("Échéance").optional(),
});

export const projectPatchSchema = z.object({
  name: projectName.optional(),
  client: requiredText(LIMITS.client, "Le maître d’ouvrage est requis.", clientText).optional(),
  discipline: discipline.optional(),
  budget: budget.optional(),
  start: isoDate("Début").optional(),
  deadline: isoDate("Échéance").optional(),
  responsableId: memberRef.optional(),
});

const subtaskName = requiredText(
  LIMITS.subtaskName,
  "Le nom de la tâche est requis.",
  `Le nom de la tâche ne doit pas dépasser ${LIMITS.subtaskName} caractères.`,
);

export const newSubtaskSchema = z.object({
  name: subtaskName,
  assigneeId: memberRef,
  start: isoDate("Début de la tâche"),
  plannedDays,
  dependsOn: dependsOn.optional(),
});

export const subtaskPatchSchema = z.object({
  name: subtaskName.optional(),
  assigneeId: memberRef.optional(),
  start: isoDate("Début de la tâche").optional(),
  plannedDays: plannedDays.optional(),
  done: z.boolean({ error: "État de la tâche invalide." }).optional(),
  dependsOn: dependsOn.optional(),
});

/** A whole task, id included — used to restore a deleted task exactly. */
export const subtaskRecordSchema = newSubtaskSchema.extend({
  id: subtaskRef,
  done: z.boolean({ error: "État de la tâche invalide." }),
  dependsOn,
});

const memberFields = {
  name: requiredText(LIMITS.memberName, "Le nom est requis.", `Le nom ne doit pas dépasser ${LIMITS.memberName} caractères.`),
  initials: requiredText(LIMITS.initials, "Les initiales sont requises.", `${LIMITS.initials} initiales maximum.`),
  color,
  role: optionalText(LIMITS.role, `Le rôle ne doit pas dépasser ${LIMITS.role} caractères.`),
  costPerDay,
};

export const newTeamMemberSchema = z.object({ ...memberFields, costPerDay: costPerDay.optional() });
export const teamMemberPatchSchema = z.object(memberFields).partial();
/** A whole member, id included — used to restore a deleted member exactly. */
export const teamMemberRecordSchema = z.object({ id: memberRef, ...memberFields });

// ---------------------------------------------------------------- parsing

/** Parse or throw a ValidationError carrying the first issue's French message. */
export function parseWith<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value, {
    // Fallback for issues a schema didn't word itself (e.g. a wrong type).
    error: (iss) => `Saisie invalide${iss.path?.length ? ` (${iss.path.join(".")})` : ""}.`,
  });
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Saisie invalide.");
  return r.data;
}

export const parseId = (v: unknown): number => parseWith(idSchema, v);
export const parsePhaseIndex = (v: unknown): number => parseWith(phaseIndexSchema, v);
export const parseStatus = (v: unknown): Status => parseWith(statusSchema, v);
export const parseCommentText = (v: unknown): string => parseWith(commentTextSchema, v);

/** A fully-specified new project: every optional input resolved to its default. */
export type ResolvedNewProject = Required<NewProjectInput>;

/** Default deadline for a new project: one year after its start. */
export function defaultDeadline(start: string): string {
  const d = toDate(start);
  d.setFullYear(d.getFullYear() + 1);
  return toISO(d);
}

export function parseNewProject(input: unknown): ResolvedNewProject {
  const v = parseWith(newProjectSchema, input);
  const start = v.start ?? REFERENCE_DATE;
  const deadline = v.deadline ?? defaultDeadline(start);
  if (deadline < start) throw new ValidationError(DEADLINE_BEFORE_START_MESSAGE);
  return {
    name: v.name,
    client: v.client || "À définir",
    responsableId: v.responsableId,
    discipline: v.discipline || "À définir",
    budget: v.budget ?? 0,
    phaseIndex: v.phaseIndex ?? 0,
    start,
    deadline,
  };
}

/** Parse a project patch. Pass the current dates to check the merged
 *  start/deadline order (only when the patch touches either of them). */
export function parseProjectPatch(patch: unknown, current?: { start: string; deadline: string }): ProjectPatch {
  const v = parseWith(projectPatchSchema, patch);
  if (v.start !== undefined || v.deadline !== undefined) {
    const start = v.start ?? current?.start;
    const deadline = v.deadline ?? current?.deadline;
    if (start && deadline && deadline < start) throw new ValidationError(DEADLINE_BEFORE_START_MESSAGE);
  }
  return v;
}

/** Dependencies must be tasks of the same project, and never the task itself. */
export function checkDependsOn(deps: readonly number[], siblingIds: Iterable<number>, selfId?: number): void {
  if (selfId !== undefined && deps.includes(selfId)) {
    throw new ValidationError("Une tâche ne peut pas dépendre d’elle-même.");
  }
  const ids = new Set(siblingIds);
  if (deps.some((d) => !ids.has(d))) {
    throw new ValidationError("Dépendance invalide : la tâche prédécesseur n’existe pas dans ce projet.");
  }
}

export function parseNewSubtask(input: unknown, siblingIds: Iterable<number>): Required<NewSubtaskInput> {
  const v = parseWith(newSubtaskSchema, input);
  const deps = v.dependsOn ?? [];
  checkDependsOn(deps, siblingIds);
  return { ...v, dependsOn: deps };
}

export function parseSubtaskPatch(patch: unknown, siblingIds: Iterable<number>, selfId: number): SubtaskPatch {
  const v = parseWith(subtaskPatchSchema, patch);
  if (v.dependsOn) checkDependsOn(v.dependsOn, siblingIds, selfId);
  return v;
}

/** Parse a task to restore; `siblingIds` are the project's other tasks. */
export function parseSubtaskRecord(input: unknown, siblingIds: Iterable<number>): Subtask {
  const v = parseWith(subtaskRecordSchema, input);
  checkDependsOn(v.dependsOn, siblingIds, v.id);
  return v;
}

export const parseNewTeamMember = (input: unknown): NewTeamMemberInput => parseWith(newTeamMemberSchema, input);
export const parseTeamMemberPatch = (patch: unknown): TeamMemberPatch => parseWith(teamMemberPatchSchema, patch);
export const parseTeamMemberRecord = (input: unknown): TeamMember => parseWith(teamMemberRecordSchema, input);
