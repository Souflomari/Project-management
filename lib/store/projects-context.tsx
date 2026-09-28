"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  addCommentAction,
  addSubtaskAction,
  addTeamMemberAction,
  createProjectAction,
  updateProjectAction,
  deleteSubtaskAction,
  deleteTeamMemberAction,
  restoreSubtaskAction,
  restoreTeamMemberAction,
  setPhaseAction,
  setStatusAction,
  updateSubtaskAction,
  updateTeamMemberAction,
  type ActionResult,
} from "@/app/actions";
import { sampleRepository } from "../data";
import type {
  NewProjectInput,
  ProjectPatch,
  ProjectRepository,
  SubtaskPatch,
  TeamMemberPatch,
} from "../data/repository";
import { buildFilters, deriveAll, type DerivedProject, type FilterDef } from "../derive";
import { REFERENCE_DATE, toISO, toDate } from "../format";
import { toast, type ToastAction } from "../toast";
import { STATUS_META } from "../tokens";
import {
  FINAL_PHASE_INDEX,
  PHASES,
  STATUSES,
  type NewSubtaskInput,
  type NewTeamMemberInput,
  type Project,
  type Status,
  type Subtask,
  type TeamMember,
  type Viewer,
} from "../types";
import {
  MEMBER_IN_USE_MESSAGE,
  UserFacingError,
  ValidationError,
  parseCommentText,
  parseNewProject,
  parseNewSubtask,
  parseNewTeamMember,
  parsePhaseIndex,
  parseProjectPatch,
  parseStatus,
  parseSubtaskPatch,
  parseTeamMemberPatch,
} from "../validation";

type FilterKey = "all" | Status;
export type CalMode = "mois" | "semaine" | "agenda";
export type TeamMode = "semaine" | "mois";
export interface TableSort { key: string; dir: 1 | -1 }
export interface SavedView {
  id: string;
  name: string;
  filter: FilterKey;
  search: string;
  respFilter: number | null;
  phaseFilter: number | null;
  tableSort: TableSort | null;
}
const VIEWS_KEY = "setec.views";

/** Who is using the app, ready to render (sidebar account menu, settings). */
export interface Identity {
  name: string;
  role: string;
  initials: string;
  color: string;
  email: string | null;
  /** Sample mode: no account, edits stay in this browser. */
  demo: boolean;
}

interface ProjectsContextValue {
  projects: Project[];
  team: TeamMember[];
  serverBacked: boolean;
  /** Signed-in person (Supabase mode); null in sample mode. */
  viewer: Viewer | null;
  /** The team member linked to the viewer, if any. */
  viewerMember: TeamMember | null;
  identity: Identity;

  allDerived: DerivedProject[];
  searched: DerivedProject[];
  filtered: DerivedProject[];
  filters: FilterDef[];
  selected: Project | null;

  search: string;
  filter: FilterKey;
  respFilter: number | null;
  phaseFilter: number | null;
  tableSort: TableSort | null;
  savedViews: SavedView[];
  selectedId: number | null;
  selectedIds: Set<number>;
  showAdd: boolean;
  newName: string;
  newClient: string;
  newResp: number;
  commentDraft: string;

  calMode: CalMode;
  calAnchor: string;
  calProjectFilter: number | null;

  teamMode: TeamMode;
  teamAnchor: string;

  setSearch: (v: string) => void;
  setFilter: (f: FilterKey) => void;
  setRespFilter: (id: number | null) => void;
  setPhaseFilter: (i: number | null) => void;
  setTableSort: (s: TableSort | null) => void;
  resetFilters: () => void;
  saveView: (name: string) => void;
  applyView: (v: SavedView) => void;
  deleteView: (id: string) => void;
  /** Rename a saved view, keeping its filters. */
  renameView: (id: string, name: string) => void;
  toggleSelected: (id: number) => void;
  selectAll: (ids: number[]) => void;
  clearSelected: () => void;
  openProject: (id: number) => void;
  closeDrawer: () => void;
  openAdd: () => void;
  closeAdd: () => void;
  setNewName: (v: string) => void;
  setNewClient: (v: string) => void;
  setNewResp: (i: number) => void;
  setCommentDraft: (v: string) => void;

  setCalMode: (m: CalMode) => void;
  calPrev: () => void;
  calNext: () => void;
  calToday: () => void;
  setCalProjectFilter: (id: number | null) => void;

  setTeamMode: (m: TeamMode) => void;
  teamPrev: () => void;
  teamNext: () => void;
  teamToday: () => void;

  updateProject: (id: number, patch: ProjectPatch) => void;
  advancePhase: (id: number) => void;
  setPhase: (id: number, phaseIndex: number) => void;
  setStatus: (id: number, status: Status) => void;
  /** Post a comment (`text`, or the shared `commentDraft` when omitted).
   *  Resolves to true once saved, false after an error toast. */
  addComment: (id: number, text?: string) => Promise<boolean>;
  /** Create a project from the add-modal fields (+ optional details). Closes the
   *  modal on success; does not open the drawer (the caller navigates). */
  submitAdd: (extra?: Partial<NewProjectInput>) => Promise<boolean>;
  /** Create a project. Resolves to the new project, or null after an error
   *  toast (invalid input / server failure). */
  createProject: (input: NewProjectInput) => Promise<Project | null>;

  addSubtask: (projectId: number, input: NewSubtaskInput) => void;
  updateSubtask: (projectId: number, subtaskId: number, patch: SubtaskPatch) => void;
  deleteSubtask: (projectId: number, subtaskId: number) => void;

  addTeamMember: (input: NewTeamMemberInput) => void;
  updateTeamMember: (id: number, patch: TeamMemberPatch) => void;
  deleteTeamMember: (id: number) => void;

  bulkSetStatus: (ids: number[], status: Status) => void;
  bulkAdvancePhase: (ids: number[]) => void;
  bulkSetResponsable: (ids: number[], responsableId: number) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function shiftMonth(anchor: string, delta: number): string {
  const d = toDate(anchor);
  return toISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
function shiftDays(anchor: string, delta: number): string {
  const d = toDate(anchor);
  d.setDate(d.getDate() + delta);
  return toISO(d);
}

const NEUTRAL_AVATAR = "#4F5A63";

export function resolveIdentity(serverBacked: boolean, viewer: Viewer | null, member: TeamMember | null): Identity {
  if (!serverBacked) {
    return {
      name: "Mode démonstration",
      role: "Données locales à ce navigateur",
      initials: "DM",
      color: NEUTRAL_AVATAR,
      email: null,
      demo: true,
    };
  }
  const fallback = viewer?.email?.split("@")[0] || "Utilisateur";
  const name = member?.name ?? fallback;
  return {
    name,
    role: member?.role || (viewer?.role === "admin" ? "Administrateur" : "Membre"),
    initials: member?.initials ?? name.slice(0, 2).toUpperCase(),
    color: member?.color ?? NEUTRAL_AVATAR,
    email: viewer?.email ?? null,
    demo: false,
  };
}

// ---- saved views / URL parsing (pure; run once on mount) ----

/** Tolerate old / partial shapes: coerce each entry, drop anything unusable. */
function parseSavedViews(raw: string | null): SavedView[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((v): v is Record<string, unknown> => v != null && typeof v === "object")
    .map((v, i) => ({
      id: typeof v.id === "string" ? v.id : `${Date.now()}-${i}`,
      name: typeof v.name === "string" && v.name.trim() ? v.name : "Vue",
      filter: (v.filter === "all" || (STATUSES as readonly string[]).includes(v.filter as string)) ? (v.filter as FilterKey) : "all",
      search: typeof v.search === "string" ? v.search : "",
      respFilter: Number.isInteger(v.respFilter) ? (v.respFilter as number) : null,
      phaseFilter:
        Number.isInteger(v.phaseFilter) && (v.phaseFilter as number) >= 0 && (v.phaseFilter as number) <= FINAL_PHASE_INDEX
          ? (v.phaseFilter as number)
          : null,
      tableSort:
        v.tableSort && typeof v.tableSort === "object" && typeof (v.tableSort as TableSort).key === "string"
          ? { key: (v.tableSort as TableSort).key, dir: (v.tableSort as TableSort).dir === -1 ? -1 : 1 }
          : null,
    }));
}

interface UrlState {
  filter?: FilterKey;
  search?: string;
  respFilter?: number;
  phaseFilter?: number;
  tableSort?: TableSort;
  selectedId?: number;
}

/** Read the shareable filter params, ignoring any value that doesn't name a real
 *  status / team member / phase / project. */
function parseUrlState(search: string, teamIds: Set<number>, projectIds: Set<number>): UrlState {
  const sp = new URLSearchParams(search);
  const out: UrlState = {};
  const nat = (v: string | null) => (v != null && /^\d+$/.test(v) ? Number(v) : null);
  const st = sp.get("statut");
  if (st === "all" || (STATUSES as readonly string[]).includes(st ?? "")) out.filter = st as FilterKey;
  const q = sp.get("q"); if (q) out.search = q;
  const rp = nat(sp.get("resp")); if (rp != null && teamIds.has(rp)) out.respFilter = rp;
  const ph = nat(sp.get("phase")); if (ph != null && ph <= FINAL_PHASE_INDEX) out.phaseFilter = ph;
  const tri = sp.get("tri");
  if (tri) { const [k, d] = tri.split("."); if (k && /^[\w-]+$/.test(k)) out.tableSort = { key: k, dir: d === "-1" ? -1 : 1 }; }
  const pj = nat(sp.get("projet")); if (pj != null && projectIds.has(pj)) out.selectedId = pj;
  return out;
}

// ---- writes ----

type Writes = Omit<ProjectRepository, "listProjects" | "getProject" | "listTeam">;

/** Unwrap a server action result: an expected failure (invalid input, refused
 *  delete) becomes a UserFacingError — the same thing the sample repo throws. */
async function ok<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const r = await result;
  if (!r.ok) throw new UserFacingError(r.error);
  return r.data;
}

/** Supabase mode: every write goes through a server action. */
const actionWrites: Writes = {
  createProject: (input) => ok(createProjectAction(input)),
  updateProject: (id, patch) => ok(updateProjectAction(id, patch)),
  setPhase: (id, phaseIndex) => ok(setPhaseAction(id, phaseIndex)),
  setStatus: (id, status) => ok(setStatusAction(id, status)),
  addComment: (id, text) => ok(addCommentAction(id, text)),
  addSubtask: (projectId, input) => ok(addSubtaskAction(projectId, input)),
  updateSubtask: (projectId, subtaskId, patch) => ok(updateSubtaskAction(projectId, subtaskId, patch)),
  deleteSubtask: (projectId, subtaskId) => ok(deleteSubtaskAction(projectId, subtaskId)),
  restoreSubtask: (projectId, subtask, dependentIds) => ok(restoreSubtaskAction(projectId, subtask, dependentIds)),
  addTeamMember: (input) => ok(addTeamMemberAction(input)),
  updateTeamMember: (id, patch) => ok(updateTeamMemberAction(id, patch)),
  deleteTeamMember: (id) => ok(deleteTeamMemberAction(id)),
  restoreTeamMember: (member) => ok(restoreTeamMemberAction(member)),
};

type Updater<T> = (fn: (prev: T) => T) => void;

interface MutationDeps {
  repo: Writes;
  getProjects: () => Project[];
  setProjects: Updater<Project[]>;
  getTeam: () => TeamMember[];
  setTeam: Updater<TeamMember[]>;
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const i = Math.min(Math.max(0, index), list.length);
  return [...list.slice(0, i), item, ...list.slice(i)];
}

/**
 * Optimistic mutations with per-entity sequencing and targeted rollback.
 *
 *   • Every write bumps a counter for the entity whose server copy it gets back
 *     (a project, or the team list). A response is applied only if no newer write
 *     to that entity was issued since — a late reply never clobbers a newer
 *     optimistic value.
 *   • Each written field also gets its own counter. On failure a field is reverted
 *     to its previous value only if this write still owns it, so unrelated edits
 *     made meanwhile (other fields, other projects) survive.
 *   • Deletes are applied at once; their "Annuler" restores the exact entity
 *     (same id, fields and dependency edges) through the repository's restore*.
 */
function createMutations({ repo, getProjects, setProjects, getTeam, setTeam }: MutationDeps) {
  const seq = new Map<string, number>();
  const bump = (key: string) => {
    const n = (seq.get(key) ?? 0) + 1;
    seq.set(key, n);
    return n;
  };
  const isLatest = (key: string, n: number) => seq.get(key) === n;

  const findProject = (id: number) => getProjects().find((p) => p.id === id);
  const mapProject = (id: number, fn: (p: Project) => Project) =>
    setProjects((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));
  const applyProject = (u: Project) => mapProject(u.id, () => u);
  const projectKey = (id: number) => `p${id}`;

  /** Specific, recoverable error: the French message of an expected failure, or
   *  the fallback with a retry for a transport / server error. */
  function failToast(e: unknown, fallback: string, retry?: () => void) {
    const expected = e instanceof UserFacingError;
    toast({
      message: expected ? e.message : fallback,
      variant: "error",
      action: !expected && retry ? { label: "Réessayer", onClick: retry } : undefined,
    });
  }

  /** Run a validator; on rejection show its message and return null. */
  function validated<T>(fn: () => T): T | null {
    try {
      return fn();
    } catch (e) {
      if (e instanceof UserFacingError) {
        toast({ message: e.message, variant: "error" });
        return null;
      }
      throw e;
    }
  }

  function checkMember(id: number | undefined) {
    if (id !== undefined && !getTeam().some((m) => m.id === id)) throw new ValidationError("Membre inconnu.");
  }

  function optimistic<T extends object, R>(o: {
    responseKey: string;
    fieldPrefix: string;
    current: T;
    fields: Partial<T>;
    apply: (fn: (x: T) => T) => void;
    request: () => Promise<R>;
    reconcile: (r: R) => void;
  }): Promise<R> {
    const keys = Object.keys(o.fields) as (keyof T)[];
    const prev: Partial<T> = {};
    for (const k of keys) prev[k] = o.current[k];
    const rv = bump(o.responseKey);
    const fv = new Map(keys.map((k) => [k, bump(`${o.fieldPrefix}.${String(k)}`)]));
    o.apply((x) => ({ ...x, ...o.fields }));
    return o.request().then(
      (r) => {
        if (isLatest(o.responseKey, rv)) o.reconcile(r);
        return r;
      },
      (e) => {
        o.apply((x) => {
          const out = { ...x };
          for (const k of keys) if (isLatest(`${o.fieldPrefix}.${String(k)}`, fv.get(k)!)) out[k] = prev[k] as T[keyof T];
          return out;
        });
        throw e;
      },
    );
  }

  const writeProject = (cur: Project, fields: Partial<Project>, request: () => Promise<Project>) =>
    optimistic({
      responseKey: projectKey(cur.id),
      fieldPrefix: projectKey(cur.id),
      current: cur,
      fields,
      apply: (fn) => mapProject(cur.id, fn),
      request,
      reconcile: applyProject,
    });

  /** A non-optimistic (or already-applied) structural write on a project. If a
   *  newer write was issued meanwhile, only `merge` what this one added. */
  function structural(projectId: number, request: () => Promise<Project>, merge: (local: Project, server: Project) => Project) {
    const v = bump(projectKey(projectId));
    return request().then((u) => {
      if (isLatest(projectKey(projectId), v)) applyProject(u);
      else mapProject(projectId, (local) => merge(local, u));
      return u;
    });
  }

  // ---- projects ----

  function setStatus(id: number, status: Status) {
    const cur = findProject(id);
    const s = validated(() => parseStatus(status));
    if (!cur || s == null) return;
    const prev = cur.status;
    writeProject(cur, { status: s }, () => repo.setStatus(id, s))
      .then(() =>
        toast({
          message: `Statut : ${STATUS_META[s].label}`,
          variant: "success",
          action: prev !== s ? { label: "Annuler", onClick: () => setStatus(id, prev) } : undefined,
        }),
      )
      .catch((e) => failToast(e, `Statut non enregistré pour « ${cur.name} »`, () => setStatus(id, s)));
  }

  function setPhase(id: number, phaseIndex: number) {
    const cur = findProject(id);
    const ph = validated(() => parsePhaseIndex(phaseIndex));
    if (!cur || ph == null) return;
    const prev = cur.phaseIndex;
    writeProject(cur, { phaseIndex: ph }, () => repo.setPhase(id, ph))
      .then(() =>
        toast({
          message: `Phase : ${PHASES[ph]}`,
          variant: "success",
          action: prev !== ph ? { label: "Annuler", onClick: () => setPhase(id, prev) } : undefined,
        }),
      )
      .catch((e) => failToast(e, `Phase non enregistrée pour « ${cur.name} »`, () => setPhase(id, ph)));
  }

  function advancePhase(id: number) {
    const cur = findProject(id);
    if (cur) setPhase(id, Math.min(cur.phaseIndex + 1, FINAL_PHASE_INDEX));
  }

  function updateProject(id: number, patch: ProjectPatch) {
    const cur = findProject(id);
    if (!cur) return;
    // Rejected (not clamped) when invalid, e.g. an échéance before the start.
    const clean = validated(() => {
      const c = parseProjectPatch(patch, cur);
      checkMember(c.responsableId);
      return c;
    });
    if (!clean || !Object.keys(clean).length) return;
    writeProject(cur, clean, () => repo.updateProject(id, clean)).catch((e) =>
      failToast(e, `Modification non enregistrée pour « ${cur.name} »`, () => updateProject(id, clean)),
    );
  }

  function addComment(id: number, text: string): Promise<boolean> {
    const body = validated(() => parseCommentText(text));
    if (body == null) return Promise.resolve(false);
    return structural(id, () => repo.addComment(id, body), (local, server) => ({
      ...local,
      comments: [...local.comments, ...server.comments.slice(-1)],
    })).then(
      () => {
        toast({ message: "Commentaire ajouté", variant: "success" });
        return true;
      },
      (e) => {
        failToast(e, "Commentaire non publié");
        return false;
      },
    );
  }

  function createProject(input: NewProjectInput): Promise<Project | null> {
    const v = validated(() => {
      const c = parseNewProject(input);
      checkMember(c.responsableId);
      return c;
    });
    if (!v) return Promise.resolve(null);
    return repo.createProject(v).then(
      (created) => {
        setProjects((ps) => [created, ...ps.filter((p) => p.id !== created.id)]);
        toast({ message: "Projet créé", variant: "success" });
        return created;
      },
      (e) => {
        failToast(e, `Projet « ${v.name} » non créé`);
        return null;
      },
    );
  }

  // ---- tasks ----

  function addSubtask(projectId: number, input: NewSubtaskInput) {
    const p = findProject(projectId);
    if (!p) return;
    const v = validated(() => {
      const c = parseNewSubtask(input, p.subtasks.map((s) => s.id));
      checkMember(c.assigneeId);
      return c;
    });
    if (!v) return;
    const before = new Set(p.subtasks.map((s) => s.id));
    structural(projectId, () => repo.addSubtask(projectId, v), (local, server) => {
      const added = server.subtasks.filter((s) => !before.has(s.id) && !local.subtasks.some((l) => l.id === s.id));
      return added.length ? { ...local, subtasks: [...local.subtasks, ...added] } : local;
    })
      .then(() => toast({ message: "Tâche ajoutée", variant: "success" }))
      .catch((e) => failToast(e, "Tâche non ajoutée", () => addSubtask(projectId, input)));
  }

  function updateSubtask(projectId: number, subtaskId: number, patch: SubtaskPatch) {
    const p = findProject(projectId);
    const s = p?.subtasks.find((x) => x.id === subtaskId);
    if (!p || !s) return;
    const clean = validated(() => {
      const c = parseSubtaskPatch(patch, p.subtasks.map((x) => x.id), subtaskId);
      checkMember(c.assigneeId);
      return c;
    });
    if (!clean || !Object.keys(clean).length) return;
    optimistic<Subtask, Project>({
      responseKey: projectKey(projectId),
      fieldPrefix: `${projectKey(projectId)}.s${subtaskId}`,
      current: s,
      fields: clean,
      apply: (fn) => mapProject(projectId, (q) => ({ ...q, subtasks: q.subtasks.map((x) => (x.id === subtaskId ? fn(x) : x)) })),
      request: () => repo.updateSubtask(projectId, subtaskId, clean),
      reconcile: applyProject,
    }).catch((e) => failToast(e, "Modification non enregistrée", () => updateSubtask(projectId, subtaskId, clean)));
  }

  function deleteSubtask(projectId: number, subtaskId: number) {
    const p = findProject(projectId);
    const s = p?.subtasks.find((x) => x.id === subtaskId);
    if (!p || !s) return;
    const index = p.subtasks.indexOf(s);
    // Tasks that depended on it: the delete strips the edge, undo puts it back.
    const dependents = p.subtasks.filter((x) => x.dependsOn.includes(subtaskId)).map((x) => x.id);
    const detach = (q: Project): Project => ({
      ...q,
      subtasks: q.subtasks
        .filter((x) => x.id !== subtaskId)
        .map((x) => (x.dependsOn.includes(subtaskId) ? { ...x, dependsOn: x.dependsOn.filter((d) => d !== subtaskId) } : x)),
    });
    const attach = (q: Project, task: Subtask): Project => {
      if (q.subtasks.some((x) => x.id === subtaskId)) return q;
      const linked = q.subtasks.map((x) =>
        dependents.includes(x.id) && !x.dependsOn.includes(subtaskId) ? { ...x, dependsOn: [...x.dependsOn, subtaskId] } : x,
      );
      return { ...q, subtasks: insertAt(linked, index, task) };
    };

    const undo = () => {
      const q = findProject(projectId);
      if (!q) return;
      // Exact copy (id, done, dates…); predecessors deleted since are dropped.
      const ids = new Set(q.subtasks.map((x) => x.id));
      const task: Subtask = { ...s, dependsOn: s.dependsOn.filter((d) => ids.has(d)) };
      const deps = dependents.filter((d) => ids.has(d));
      mapProject(projectId, (x) => attach(x, task));
      structural(projectId, () => repo.restoreSubtask(projectId, task, deps), (local) => attach(local, task))
        .then(() => toast({ message: `« ${s.name} » rétablie`, variant: "success" }))
        .catch((e) => {
          mapProject(projectId, detach);
          failToast(e, `« ${s.name} » non rétablie`);
        });
    };

    mapProject(projectId, detach); // optimistic
    structural(projectId, () => repo.deleteSubtask(projectId, subtaskId), detach)
      .then(() => toast({ message: `« ${s.name} » supprimée`, duration: 8000, action: { label: "Annuler", onClick: undo } }))
      .catch((e) => {
        mapProject(projectId, (q) => attach(q, s));
        failToast(e, "Suppression non enregistrée");
      });
  }

  // ---- team ----

  const TEAM_KEY = "team";
  const reconcileTeam = (t: TeamMember[]) => setTeam(() => t);

  function addTeamMember(input: NewTeamMemberInput) {
    const v = validated(() => parseNewTeamMember(input));
    if (!v) return;
    const before = new Set(getTeam().map((m) => m.id));
    const n = bump(TEAM_KEY);
    repo.addTeamMember(v)
      .then((t) => {
        if (isLatest(TEAM_KEY, n)) reconcileTeam(t);
        else {
          const added = t.filter((m) => !before.has(m.id));
          setTeam((cur) => [...cur, ...added.filter((a) => !cur.some((c) => c.id === a.id))]);
        }
        toast({ message: `${v.name} ajouté·e à l’équipe`, variant: "success" });
      })
      .catch((e) => failToast(e, "Membre non ajouté", () => addTeamMember(input)));
  }

  function updateTeamMember(id: number, patch: TeamMemberPatch) {
    const cur = getTeam().find((m) => m.id === id);
    const clean = validated(() => parseTeamMemberPatch(patch));
    if (!cur || !clean || !Object.keys(clean).length) return;
    optimistic<TeamMember, TeamMember[]>({
      responseKey: TEAM_KEY,
      fieldPrefix: `m${id}`,
      current: cur,
      fields: clean,
      apply: (fn) => setTeam((t) => t.map((m) => (m.id === id ? fn(m) : m))),
      request: () => repo.updateTeamMember(id, clean),
      reconcile: reconcileTeam,
    })
      .then(() => toast({ message: "Membre mis à jour", variant: "success" }))
      .catch((e) => failToast(e, "Modification non enregistrée", () => updateTeamMember(id, clean)));
  }

  function deleteTeamMember(id: number) {
    const team = getTeam();
    const m = team.find((x) => x.id === id);
    if (!m) return;
    // Refuse rather than orphan the projects / tasks that reference the member
    // (the repositories enforce the same rule).
    if (getProjects().some((p) => p.responsableId === id || p.subtasks.some((s) => s.assigneeId === id))) {
      toast({ message: `${m.name} : ${MEMBER_IN_USE_MESSAGE}`, variant: "error" });
      return;
    }
    const index = team.indexOf(m);
    const remove = (t: TeamMember[]) => t.filter((x) => x.id !== id);
    const reinsert = (t: TeamMember[]) => (t.some((x) => x.id === id) ? t : insertAt(t, index, m));

    const undo = () => {
      setTeam(reinsert);
      const n = bump(TEAM_KEY);
      repo.restoreTeamMember(m) // exact member: same id, costPerDay, colour…
        .then((t) => {
          if (isLatest(TEAM_KEY, n)) reconcileTeam(t);
          toast({ message: `${m.name} réintégré·e à l’équipe`, variant: "success" });
        })
        .catch((e) => {
          setTeam(remove);
          failToast(e, `${m.name} non réintégré·e`);
        });
    };

    setTeam(remove); // optimistic
    const n = bump(TEAM_KEY);
    repo.deleteTeamMember(id)
      .then((t) => {
        if (isLatest(TEAM_KEY, n)) reconcileTeam(t);
        toast({ message: `${m.name} retiré·e de l’équipe`, duration: 8000, action: { label: "Annuler", onClick: undo } });
      })
      .catch((e) => {
        setTeam(reinsert);
        failToast(e, "Suppression non enregistrée");
      });
  }

  // ---- bulk actions (optimistic batch, per-project outcome, one summary toast) ----

  interface BulkTarget { project: Project; fields: Partial<Project> }

  function bulk(
    targets: BulkTarget[],
    request: (id: number, fields: Partial<Project>) => Promise<Project>,
    doneLabel: string,
    undoable: boolean,
  ) {
    if (!targets.length) return;
    const prevById = new Map(
      targets.map((t) => [t.project.id, Object.fromEntries(Object.keys(t.fields).map((k) => [k, t.project[k as keyof Project]])) as Partial<Project>]),
    );
    Promise.allSettled(targets.map((t) => writeProject(t.project, t.fields, () => request(t.project.id, t.fields)))).then(
      (results) => {
        // Successes stay; each failure was already reverted (its fields only).
        const done = targets.filter((_, i) => results[i].status === "fulfilled");
        const failed = targets.length - done.length;
        let action: ToastAction | undefined;
        if (undoable && done.length) {
          action = {
            label: "Annuler",
            onClick: () => {
              const back = done.flatMap((t) => {
                const project = findProject(t.project.id);
                return project ? [{ project, fields: prevById.get(t.project.id)! }] : [];
              });
              bulk(back, request, "modification annulée", false);
            },
          };
        }
        if (!failed) {
          toast({ message: `${plural(done.length, "projet")} · ${doneLabel}`, variant: "success", action });
        } else {
          toast({
            message: done.length
              ? `${plural(done.length, "projet")} mis à jour · ${failed} en échec`
              : `Aucun projet mis à jour (${failed} en échec)`,
            variant: "error",
            action,
          });
        }
      },
    );
  }

  function bulkSetStatus(ids: number[], status: Status) {
    const s = validated(() => parseStatus(status));
    if (s == null) return;
    const targets = ids.flatMap((id) => {
      const project = findProject(id);
      return project ? [{ project, fields: { status: s } }] : [];
    });
    bulk(targets, (id, f) => repo.setStatus(id, f.status as Status), STATUS_META[s].label, true);
  }

  function bulkAdvancePhase(ids: number[]) {
    const targets = ids.flatMap((id) => {
      const project = findProject(id);
      return project && project.phaseIndex < FINAL_PHASE_INDEX ? [{ project, fields: { phaseIndex: project.phaseIndex + 1 } }] : [];
    });
    bulk(targets, (id, f) => repo.setPhase(id, f.phaseIndex as number), "phase avancée", true);
  }

  function bulkSetResponsable(ids: number[], responsableId: number) {
    const who = getTeam().find((m) => m.id === responsableId);
    if (!who) {
      toast({ message: "Membre inconnu.", variant: "error" });
      return;
    }
    const targets = ids.flatMap((id) => {
      const project = findProject(id);
      return project ? [{ project, fields: { responsableId } }] : [];
    });
    bulk(targets, (id, f) => repo.updateProject(id, { responsableId: f.responsableId }), `responsable ${who.name}`, true);
  }

  return {
    setStatus, setPhase, advancePhase, updateProject, addComment, createProject,
    addSubtask, updateSubtask, deleteSubtask,
    addTeamMember, updateTeamMember, deleteTeamMember,
    bulkSetStatus, bulkAdvancePhase, bulkSetResponsable,
  };
}

export function ProjectsProvider({
  initialProjects,
  initialTeam,
  serverBacked,
  viewer = null,
  children,
}: {
  initialProjects: Project[];
  initialTeam: TeamMember[];
  serverBacked: boolean;
  /** Signed-in person (Supabase mode), resolved on the server. */
  viewer?: Viewer | null;
  children: ReactNode;
}) {
  const [projects, setProjectsState] = useState<Project[]>(initialProjects);
  const [team, setTeamState] = useState<TeamMember[]>(initialTeam);

  // Live mirrors of projects/team so mutation callbacks can read current state
  // WITHOUT listing projects/team in their dep arrays. The setters below write
  // the mirror synchronously, then React state, so a read right after a write
  // (even before a re-render) sees it.
  const projectsRef = useRef(initialProjects);
  const teamRef = useRef(initialTeam);
  const setProjects = useCallback((next: Project[] | ((prev: Project[]) => Project[])) => {
    projectsRef.current = typeof next === "function" ? next(projectsRef.current) : next;
    setProjectsState(projectsRef.current);
  }, []);
  const setTeam = useCallback((next: TeamMember[] | ((prev: TeamMember[]) => TeamMember[])) => {
    teamRef.current = typeof next === "function" ? next(teamRef.current) : next;
    setTeamState(teamRef.current);
  }, []);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [respFilter, setRespFilter] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
  const [tableSort, setTableSort] = useState<TableSort | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newResp, setNewResp] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [urlReady, setUrlReady] = useState(false);

  const [calMode, setCalMode] = useState<CalMode>("mois");
  const [calAnchor, setCalAnchor] = useState(REFERENCE_DATE);
  const [calProjectFilter, setCalProjectFilter] = useState<number | null>(null);

  const [teamMode, setTeamMode] = useState<TeamMode>("mois");
  const [teamAnchor, setTeamAnchor] = useState(REFERENCE_DATE);

  // ---- project / task / team mutations (server actions vs sample repo) ----
  const mutations = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- the getters are only called from event handlers / async callbacks, never during render
      createMutations({
        repo: serverBacked ? actionWrites : sampleRepository,
        getProjects: () => projectsRef.current,
        setProjects,
        getTeam: () => teamRef.current,
        setTeam,
      }),
    [serverBacked, setProjects, setTeam],
  );

  const addComment = useCallback(
    (id: number, text?: string) => {
      const body = text ?? commentDraft;
      if (!body.trim()) return Promise.resolve(false);
      return mutations.addComment(id, body).then((posted) => {
        if (posted && text === undefined) setCommentDraft("");
        return posted;
      });
    },
    [mutations, commentDraft],
  );

  const createProject = mutations.createProject;
  const submitAdd = useCallback(async (extra?: Partial<NewProjectInput>) => {
    if (!newName.trim()) return false;
    const created = await createProject({ name: newName, client: newClient, responsableId: newResp, ...extra });
    if (!created) return false;
    setShowAdd(false);
    return true;
  }, [createProject, newName, newClient, newResp]);

  // ---- facets / saved views / url sync ----
  const resetFilters = useCallback(() => { setFilter("all"); setRespFilter(null); setPhaseFilter(null); setSearch(""); }, []);

  const applyView = useCallback((v: SavedView) => {
    setFilter(v.filter); setSearch(v.search); setRespFilter(v.respFilter); setPhaseFilter(v.phaseFilter); setTableSort(v.tableSort);
  }, []);

  const writeViews = useCallback((fn: (prev: SavedView[]) => SavedView[]) => {
    setSavedViews((prev) => {
      const next = fn(prev);
      try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const saveView = useCallback((name: string) => {
    const v: SavedView = { id: `${Date.now()}`, name: name.trim() || "Vue", filter, search, respFilter, phaseFilter, tableSort };
    writeViews((prev) => [...prev.filter((x) => x.name !== v.name), v]);
    toast({ message: `Vue « ${v.name} » enregistrée`, variant: "success" });
  }, [writeViews, filter, search, respFilter, phaseFilter, tableSort]);

  const renameView = useCallback((id: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    // Names stay unique (as with saveView): a same-named other view is replaced.
    writeViews((prev) => prev.filter((x) => x.id === id || x.name !== n).map((x) => (x.id === id ? { ...x, name: n } : x)));
    toast({ message: `Vue renommée en « ${n} »`, variant: "success" });
  }, [writeViews]);

  const deleteView = useCallback((id: string) => {
    writeViews((prev) => prev.filter((x) => x.id !== id));
  }, [writeViews]);

  // Mount: re-read the sample repository (it hydrates its own state from
  // localStorage — the SSR `initial*` props are the fresh seed), then restore
  // saved views and the URL filters. Supabase mode persists server-side, so the
  // re-read is skipped. Everything browser-only is read here, after hydration.
  useEffect(() => {
    let alive = true;
    // Read now: the URL-mirroring effect rewrites the query string once ready.
    const query = window.location.search;
    let rawViews: string | null = null;
    try { rawViews = localStorage.getItem(VIEWS_KEY); } catch {}
    const persisted = serverBacked
      ? Promise.resolve(null)
      : Promise.all([sampleRepository.listProjects(), sampleRepository.listTeam()]).catch(() => null); // keep the SSR seed
    persisted.then((data) => {
      if (!alive) return;
      if (data) { setProjects(data[0]); setTeam(data[1]); }
      setSavedViews(parseSavedViews(rawViews));
      const url = parseUrlState(
        query,
        new Set(teamRef.current.map((m) => m.id)),
        new Set(projectsRef.current.map((p) => p.id)),
      );
      if (url.filter) setFilter(url.filter);
      if (url.search) setSearch(url.search);
      if (url.respFilter != null) setRespFilter(url.respFilter);
      if (url.phaseFilter != null) setPhaseFilter(url.phaseFilter);
      if (url.tableSort) setTableSort(url.tableSort);
      if (url.selectedId != null) setSelectedId(url.selectedId);
      setUrlReady(true);
    });
    return () => { alive = false; };
  }, [serverBacked, setProjects, setTeam]);

  // mirror project filters to the URL (shareable, refresh-proof) without a route push
  useEffect(() => {
    if (!urlReady) return;
    const sp = new URLSearchParams();
    if (filter !== "all") sp.set("statut", filter);
    if (search.trim()) sp.set("q", search.trim());
    if (respFilter != null) sp.set("resp", String(respFilter));
    if (phaseFilter != null) sp.set("phase", String(phaseFilter));
    if (tableSort) sp.set("tri", `${tableSort.key}.${tableSort.dir}`);
    if (selectedId != null) sp.set("projet", String(selectedId));
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [urlReady, filter, search, respFilter, phaseFilter, tableSort, selectedId]);

  // ---- cross-view selection (store-backed so it survives navigation) ----
  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const selectAll = useCallback((ids: number[]) => setSelectedIds(new Set(ids)), []);
  const clearSelected = useCallback(() => setSelectedIds(new Set()), []);

  // ---- ui actions ----
  const openProject = useCallback((id: number) => setSelectedId(id), []);
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const openAdd = useCallback(() => {
    setNewName("");
    setNewClient("");
    setNewResp(teamRef.current[0]?.id ?? 0);
    setShowAdd(true);
  }, []);
  const closeAdd = useCallback(() => setShowAdd(false), []);

  const calPrev = useCallback(() => {
    setCalAnchor((a) => (calMode === "semaine" ? shiftDays(a, -7) : shiftMonth(a, -1)));
  }, [calMode]);
  const calNext = useCallback(() => {
    setCalAnchor((a) => (calMode === "semaine" ? shiftDays(a, 7) : shiftMonth(a, 1)));
  }, [calMode]);

  const calToday = useCallback(() => setCalAnchor(REFERENCE_DATE), []);

  const teamPrev = useCallback(() => {
    setTeamAnchor((a) => (teamMode === "semaine" ? shiftDays(a, -7) : shiftMonth(a, -1)));
  }, [teamMode]);
  const teamNext = useCallback(() => {
    setTeamAnchor((a) => (teamMode === "semaine" ? shiftDays(a, 7) : shiftMonth(a, 1)));
  }, [teamMode]);
  const teamToday = useCallback(() => setTeamAnchor(REFERENCE_DATE), []);

  // ---- identity ----
  const viewerMember = useMemo(
    () => (viewer?.memberId != null ? team.find((m) => m.id === viewer.memberId) ?? null : null),
    [viewer, team],
  );
  const identity = useMemo(() => resolveIdentity(serverBacked, viewer, viewerMember), [serverBacked, viewer, viewerMember]);

  // ---- derived ----
  const allDerived = useMemo(() => deriveAll(projects, team), [projects, team]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDerived;
    return allDerived.filter((p) =>
      `${p.name} ${p.client} ${p.discipline} ${p.responsable.name}`.toLowerCase().includes(q),
    );
  }, [allDerived, search]);

  const filtered = useMemo(() => {
    let r = filter === "all" ? searched : searched.filter((p) => p.status === filter);
    if (respFilter != null) r = r.filter((p) => p.responsableId === respFilter);
    if (phaseFilter != null) r = r.filter((p) => p.phaseIndex === phaseFilter);
    return r;
  }, [searched, filter, respFilter, phaseFilter]);

  const filters = useMemo(() => buildFilters(searched, filter), [searched, filter]);
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const value = useMemo<ProjectsContextValue>(() => ({
    projects,
    team,
    serverBacked,
    viewer,
    viewerMember,
    identity,
    allDerived,
    searched,
    filtered,
    filters,
    selected,
    search,
    filter,
    selectedId,
    selectedIds,
    showAdd,
    newName,
    newClient,
    newResp,
    commentDraft,
    calMode,
    calAnchor,
    calProjectFilter,
    teamMode,
    teamAnchor,
    respFilter,
    phaseFilter,
    tableSort,
    savedViews,
    setSearch,
    setFilter,
    setRespFilter,
    setPhaseFilter,
    setTableSort,
    resetFilters,
    saveView,
    applyView,
    deleteView,
    renameView,
    toggleSelected,
    selectAll,
    clearSelected,
    openProject,
    closeDrawer,
    openAdd,
    closeAdd,
    setNewName,
    setNewClient,
    setNewResp,
    setCommentDraft,
    setCalMode,
    calPrev,
    calNext,
    calToday,
    setCalProjectFilter,
    setTeamMode,
    teamPrev,
    teamNext,
    teamToday,
    updateProject: mutations.updateProject,
    advancePhase: mutations.advancePhase,
    setPhase: mutations.setPhase,
    setStatus: mutations.setStatus,
    addComment,
    submitAdd,
    createProject,
    addSubtask: mutations.addSubtask,
    updateSubtask: mutations.updateSubtask,
    deleteSubtask: mutations.deleteSubtask,
    addTeamMember: mutations.addTeamMember,
    updateTeamMember: mutations.updateTeamMember,
    deleteTeamMember: mutations.deleteTeamMember,
    bulkSetStatus: mutations.bulkSetStatus,
    bulkAdvancePhase: mutations.bulkAdvancePhase,
    bulkSetResponsable: mutations.bulkSetResponsable,
  }), [
    // state / derived — the only things that legitimately change identity
    projects, team, serverBacked, viewer, viewerMember, identity,
    allDerived, searched, filtered, filters, selected,
    search, filter, selectedId, selectedIds, showAdd,
    newName, newClient, newResp, commentDraft,
    calMode, calAnchor, calProjectFilter,
    teamMode, teamAnchor,
    respFilter, phaseFilter, tableSort, savedViews,
    // stable callbacks (identity fixed via refs/functional updaters) — listed for correctness
    resetFilters, saveView, applyView, deleteView, renameView,
    toggleSelected, selectAll, clearSelected,
    openProject, closeDrawer, openAdd, closeAdd,
    calPrev, calNext, calToday,
    teamPrev, teamNext, teamToday,
    mutations, addComment, submitAdd, createProject,
  ]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectsProvider");
  return ctx;
}
