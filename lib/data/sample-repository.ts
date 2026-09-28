// In-memory implementation of ProjectRepository backed by the sample data.
// State lives in module-level variables so a browser session sees its own edits.

import { z } from "zod";

import { STATUSES, FINAL_PHASE_INDEX } from "../types";
import type { Comment, Project, Subtask, TeamMember } from "../types";
import { REFERENCE_DATE } from "../format";
import {
  MEMBER_IN_USE_MESSAGE,
  UserFacingError,
  ValidationError,
  isIsoDate,
  LIMITS,
  parseCommentText,
  parseNewProject,
  parseNewSubtask,
  parseNewTeamMember,
  parsePhaseIndex,
  parseProjectPatch,
  parseStatus,
  parseSubtaskPatch,
  parseSubtaskRecord,
  parseTeamMemberPatch,
  parseTeamMemberRecord,
} from "../validation";
import { buildSampleProjects, buildSampleTeam } from "./sample-data";
import type { ProjectRepository } from "./repository";

/** Fallback daily rate (€) when a new member is created without one. */
const DEFAULT_COST_PER_DAY = 700;

interface NextIds {
  project: number;
  member: number;
  subtask: number;
}

interface SampleState {
  projects: Project[];
  team: TeamMember[];
  /** Next id to hand out per entity. Monotonic and persisted with the data, so
   *  a deleted id is never given to a new entity (undo restores the original). */
  nextIds: NextIds;
}

function deriveNextIds(projects: Project[], team: TeamMember[]): NextIds {
  return {
    project: Math.max(0, ...projects.map((p) => p.id)) + 1,
    member: Math.max(-1, ...team.map((m) => m.id)) + 1,
    subtask: Math.max(0, ...projects.flatMap((p) => p.subtasks.map((s) => s.id))) + 1,
  };
}

function seedState(): SampleState {
  const projects = buildSampleProjects();
  const team = buildSampleTeam();
  return { projects, team, nextIds: deriveNextIds(projects, team) };
}

let state: SampleState = seedState();

// ── Browser persistence ──────────────────────────────────────────────────────
// In sample mode there is no backend, so edits are kept in localStorage and the
// store re-hydrates from here on mount (see projects-context). The SERVER copy of
// this module has no `window`, so server reads still return the fresh seed for the
// first SSR paint; the client then overrides with the persisted state.
//
// The payload is versioned. On load it is validated entry by entry: an invalid
// project / task / member / comment is dropped on its own, an unreadable payload
// falls back to the seed, and nothing here ever throws. Bump STORAGE_VERSION and
// extend `restorePersisted` when the persisted shape changes.
const STORAGE_KEY = "setec.sample";
/** Older keys, read once, migrated to STORAGE_KEY, then removed. */
const LEGACY_STORAGE_KEYS = ["setec.sample.v1"];
export const STORAGE_VERSION = 2;

// Storage schemas are the domain rules, loosened where an older build could
// have saved a repairable value (fractional days, deadline before start).
const storedMember = z.object({
  id: z.int().min(0),
  name: z.string().trim().min(1).max(LIMITS.memberName),
  initials: z.string().trim().min(1).max(LIMITS.initials),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  role: z.string().max(LIMITS.role).catch(""),
  costPerDay: z.number().min(0).transform(Math.round).catch(DEFAULT_COST_PER_DAY),
});

const storedSubtask = z.object({
  id: z.int().min(1),
  name: z.string().trim().min(1).max(LIMITS.subtaskName),
  assigneeId: z.int().min(0),
  start: z.string().refine(isIsoDate),
  plannedDays: z.number().transform((n) => Math.min(LIMITS.plannedDaysMax, Math.max(1, Math.round(n)))),
  done: z.boolean().catch(false),
  dependsOn: z.array(z.int()).catch([]),
});

const storedComment = z.object({
  author: z.string(),
  initials: z.string(),
  color: z.string(),
  text: z.string().min(1),
  when: z.string().catch(""),
  at: z.string().refine(isIsoDate).optional().catch(undefined),
});

const storedProject = z.object({
  id: z.int().min(1),
  name: z.string().trim().min(1).max(LIMITS.projectName),
  client: z.string().max(LIMITS.client),
  discipline: z.string().max(LIMITS.discipline),
  responsableId: z.int().min(0),
  phaseIndex: z.int().min(0).max(FINAL_PHASE_INDEX),
  status: z.enum(STATUSES),
  budget: z.number().min(0).transform(Math.round),
  start: z.string().refine(isIsoDate),
  deadline: z.string().refine(isIsoDate),
  subtasks: z.array(z.unknown()).catch([]),
  comments: z.array(z.unknown()).catch([]),
});

const storedNextIds = z.object({ project: z.int(), member: z.int(), subtask: z.int() });

/** Keep the entries that parse; drop duplicates by id (first one wins). */
function keepValid<T extends { id: number }>(schema: z.ZodType<T>, raw: unknown[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success && !seen.has(r.data.id)) {
      seen.add(r.data.id);
      out.push(r.data);
    }
  }
  return out;
}

function restoreProject(raw: z.output<typeof storedProject>): Project {
  const subtasks = keepValid<Subtask>(storedSubtask, raw.subtasks);
  const ids = new Set(subtasks.map((s) => s.id));
  const comments: Comment[] = raw.comments.flatMap((c) => {
    const r = storedComment.safeParse(c);
    if (!r.success) return [];
    const { at, ...rest } = r.data;
    return [at ? { ...rest, at } : rest];
  });
  return {
    ...raw,
    deadline: raw.deadline < raw.start ? raw.start : raw.deadline,
    // Dangling / self dependencies would only confuse the CPM pass.
    subtasks: subtasks.map((s) => ({ ...s, dependsOn: [...new Set(s.dependsOn)].filter((d) => d !== s.id && ids.has(d)) })),
    comments,
  };
}

/**
 * Rebuild the sample state from a parsed localStorage payload (any version).
 * Returns null when the payload is unusable, so the caller keeps the seed.
 *   v1 — `{ projects, team }` (no version, no id counters)
 *   v2 — `{ version: 2, projects, team, nextIds }`
 */
export function restorePersisted(data: unknown): SampleState | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const version = d.version ?? 1;
  if (version !== 1 && version !== STORAGE_VERSION) return null;
  if (!Array.isArray(d.projects) && !Array.isArray(d.team)) return null;

  // A missing / non-array part falls back to the seed; an empty array is a
  // legitimate state and is kept.
  const team = Array.isArray(d.team) ? keepValid<TeamMember>(storedMember, d.team) : buildSampleTeam();
  const projects = Array.isArray(d.projects)
    ? keepValid(storedProject, d.projects).map(restoreProject)
    : buildSampleProjects();

  // Counters never go backwards: max(persisted, what the data implies).
  const derived = deriveNextIds(projects, team);
  const stored = storedNextIds.safeParse(d.nextIds);
  const nextIds: NextIds = stored.success
    ? {
        project: Math.max(derived.project, stored.data.project),
        member: Math.max(derived.member, stored.data.member),
        subtask: Math.max(derived.subtask, stored.data.subtask),
      }
    : derived;
  return { projects, team, nextIds };
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // access can throw when storage is disabled
  }
}

function persist(): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...state }));
  } catch {
    /* quota / privacy mode — degrade to in-memory only */
  }
}

function hydrate(): void {
  const ls = storage();
  if (!ls) return;
  try {
    let raw = ls.getItem(STORAGE_KEY);
    const legacyKey = raw == null ? LEGACY_STORAGE_KEYS.find((k) => ls.getItem(k) != null) : undefined;
    if (legacyKey) raw = ls.getItem(legacyKey);
    if (raw == null) return;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* corrupt JSON — keep the seed */
    }
    state = restorePersisted(parsed) ?? seedState();
    persist(); // rewrite in the current format (repairs / migrates)
    if (legacyKey) ls.removeItem(legacyKey);
  } catch {
    /* storage unavailable — keep the seed */
  }
}

// Load any persisted session as soon as the module is evaluated in the browser.
hydrate();

/** Reset the demo to its seed and clear the persisted browser copy. The settings
 *  page calls this then reloads, so a user can get back to a clean portfolio. */
export function clearSampleData(): void {
  state = seedState();
  const ls = storage();
  if (ls) {
    try {
      ls.removeItem(STORAGE_KEY);
      for (const k of LEGACY_STORAGE_KEYS) ls.removeItem(k);
    } catch { /* ignore */ }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

const clone = <T>(v: T): T => structuredClone(v);

function mustFind(id: number): Project {
  const p = state.projects.find((x) => x.id === id);
  if (!p) throw new UserFacingError("Projet introuvable.");
  return p;
}

function mustFindSubtask(p: Project, subtaskId: number): Subtask {
  const s = p.subtasks.find((x) => x.id === subtaskId);
  if (!s) throw new UserFacingError("Tâche introuvable.");
  return s;
}

function mustBeMember(id: number | undefined): void {
  if (id !== undefined && !state.team.some((m) => m.id === id)) throw new ValidationError("Membre inconnu.");
}

function replace(updated: Project): Project {
  state.projects = state.projects.map((p) => (p.id === updated.id ? updated : p));
  persist();
  return clone(updated);
}

function takeId(kind: keyof NextIds): number {
  const id = state.nextIds[kind];
  state.nextIds = { ...state.nextIds, [kind]: id + 1 };
  return id;
}

function listTeam(): TeamMember[] {
  return state.team.map(clone);
}

export const sampleRepository: ProjectRepository = {
  async listProjects() {
    return state.projects.map(clone);
  },

  async getProject(id) {
    const p = state.projects.find((x) => x.id === id);
    return p ? clone(p) : null;
  },

  async listTeam() {
    return listTeam();
  },

  async createProject(input) {
    const v = parseNewProject(input);
    mustBeMember(v.responsableId);
    const np: Project = {
      id: takeId("project"),
      name: v.name,
      client: v.client,
      discipline: v.discipline,
      responsableId: v.responsableId,
      phaseIndex: v.phaseIndex,
      status: "à jour",
      budget: v.budget,
      start: v.start,
      deadline: v.deadline,
      subtasks: [],
      comments: [],
    };
    state.projects = [np, ...state.projects];
    persist();
    return clone(np);
  },

  async updateProject(id, patch) {
    const p = mustFind(id);
    const clean = parseProjectPatch(patch, p);
    mustBeMember(clean.responsableId);
    return replace({ ...p, ...clean });
  },

  async setPhase(id, phaseIndex) {
    return replace({ ...mustFind(id), phaseIndex: parsePhaseIndex(phaseIndex) });
  },

  async setStatus(id, status) {
    return replace({ ...mustFind(id), status: parseStatus(status) });
  },

  async addComment(id, text) {
    const p = mustFind(id);
    // Demo mode has no signed-in person: comments get a neutral author.
    const comment = {
      author: "Vous",
      initials: "VO",
      color: "#4F5A63", // muted neutral, in line with AVATAR_PALETTE (no saturated persona hue)
      text: parseCommentText(text),
      at: REFERENCE_DATE, // posted "now" on the app clock → renders "à l’instant", then ages
      when: "à l'instant",
    };
    return replace({ ...p, comments: [...p.comments, comment] });
  },

  async addSubtask(projectId, input) {
    const p = mustFind(projectId);
    const v = parseNewSubtask(input, p.subtasks.map((s) => s.id));
    mustBeMember(v.assigneeId);
    const subtask: Subtask = { id: takeId("subtask"), ...v, done: false };
    return replace({ ...p, subtasks: [...p.subtasks, subtask] });
  },

  async updateSubtask(projectId, subtaskId, patch) {
    const p = mustFind(projectId);
    mustFindSubtask(p, subtaskId);
    const clean = parseSubtaskPatch(patch, p.subtasks.map((s) => s.id), subtaskId);
    mustBeMember(clean.assigneeId);
    return replace({
      ...p,
      subtasks: p.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...clean } : s)),
    });
  },

  async deleteSubtask(projectId, subtaskId) {
    const p = mustFind(projectId);
    return replace({
      ...p,
      subtasks: p.subtasks
        .filter((s) => s.id !== subtaskId)
        .map((s) => (s.dependsOn.includes(subtaskId) ? { ...s, dependsOn: s.dependsOn.filter((d) => d !== subtaskId) } : s)),
    });
  },

  async restoreSubtask(projectId, subtask, dependentIds) {
    const p = mustFind(projectId);
    if (p.subtasks.some((s) => s.id === subtask.id)) throw new UserFacingError("Cette tâche existe déjà.");
    const siblingIds = p.subtasks.map((s) => s.id);
    const s = parseSubtaskRecord(subtask, siblingIds);
    mustBeMember(s.assigneeId);
    const dependents = new Set(dependentIds.filter((d) => siblingIds.includes(d)));
    return replace({
      ...p,
      subtasks: [
        ...p.subtasks.map((x) => (dependents.has(x.id) && !x.dependsOn.includes(s.id) ? { ...x, dependsOn: [...x.dependsOn, s.id] } : x)),
        s,
      ],
    });
  },

  async addTeamMember(input) {
    const v = parseNewTeamMember(input);
    state.team = [...state.team, { id: takeId("member"), ...v, costPerDay: v.costPerDay ?? DEFAULT_COST_PER_DAY }];
    persist();
    return listTeam();
  },

  async updateTeamMember(id, patch) {
    if (!state.team.some((m) => m.id === id)) throw new UserFacingError("Membre introuvable.");
    const clean = parseTeamMemberPatch(patch);
    state.team = state.team.map((m) => (m.id === id ? { ...m, ...clean } : m));
    persist();
    return listTeam();
  },

  async deleteTeamMember(id) {
    // Refuse rather than orphan projects / tasks that reference the member.
    const inUse = state.projects.some((p) => p.responsableId === id || p.subtasks.some((s) => s.assigneeId === id));
    if (inUse) throw new UserFacingError(MEMBER_IN_USE_MESSAGE);
    state.team = state.team.filter((m) => m.id !== id);
    persist();
    return listTeam();
  },

  async restoreTeamMember(member) {
    const m = parseTeamMemberRecord(member);
    if (state.team.some((x) => x.id === m.id)) throw new UserFacingError("Ce membre existe déjà.");
    state.team = [...state.team, m].sort((a, b) => a.id - b.id);
    state.nextIds = { ...state.nextIds, member: Math.max(state.nextIds.member, m.id + 1) };
    persist();
    return listTeam();
  },
};
