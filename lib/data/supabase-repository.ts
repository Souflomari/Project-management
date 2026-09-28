// Supabase-backed implementation of ProjectRepository (task model).

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Project, Subtask, TeamMember, Viewer } from "../types";
import {
  MEMBER_IN_USE_MESSAGE,
  UserFacingError,
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
import type { ProjectRepository, SubtaskPatch } from "./repository";

const PROJECT_SELECT = `
  id, name, client, discipline, responsable_id, phase_index, status, budget, start, deadline,
  subtasks ( id, name, assignee_id, start, planned_days, done, depends_on ),
  comments ( author, initials, color, text, when_label, created_at )
`;

// bigint columns (ids, depends_on) may arrive as numbers or strings depending
// on the client; everything is normalised to safe JS integers below.
type BigintValue = number | string;

interface ProjectRow {
  id: BigintValue;
  name: string;
  client: string;
  discipline: string;
  responsable_id: number;
  phase_index: number;
  status: Project["status"];
  budget: number;
  start: string;
  deadline: string;
  subtasks: {
    id: BigintValue; name: string; assignee_id: number; start: string; planned_days: number; done: boolean;
    depends_on: BigintValue[] | null;
  }[];
  comments: {
    author: string; initials: string; color: string; text: string; when_label: string | null; created_at: string;
  }[];
}

/** Fallback daily rate (€) when a row/insert omits one. */
const DEFAULT_COST_PER_DAY = 700;

interface TeamMemberRow {
  id: number;
  name: string;
  initials: string;
  color: string;
  role: string;
  cost_per_day: number | null;
}

function rowToTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    color: row.color,
    role: row.role,
    costPerDay: row.cost_per_day ?? DEFAULT_COST_PER_DAY,
  };
}

function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error("No data returned from Supabase");
  return res.data;
}

function check(error: PostgrestError | null): void {
  if (error) throw new Error(error.message);
}

function toId(v: BigintValue): number {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new Error(`Unexpected id from Supabase: ${String(v)}`);
  return n;
}

/** bigint[] → number[], dropping anything that isn't a safe integer. */
function toIds(v: BigintValue[] | null | undefined): number[] {
  return (v ?? []).map(Number).filter(Number.isSafeInteger);
}

function rowToProject(row: ProjectRow): Project {
  const subtasks: Subtask[] = row.subtasks
    .map((s) => ({
      id: toId(s.id),
      name: s.name,
      assigneeId: s.assignee_id,
      start: s.start,
      plannedDays: s.planned_days,
      done: s.done,
      dependsOn: toIds(s.depends_on),
    }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id);
  return {
    id: toId(row.id),
    name: row.name,
    client: row.client,
    discipline: row.discipline,
    responsableId: row.responsable_id,
    phaseIndex: row.phase_index,
    status: row.status,
    budget: row.budget,
    start: row.start,
    deadline: row.deadline,
    subtasks,
    comments: [...row.comments]
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((c) => ({
        author: c.author,
        initials: c.initials,
        color: c.color,
        text: c.text,
        when: c.when_label ?? "",
        at: c.created_at, // full ISO timestamp — the UI derives the relative label
      })),
  };
}

function subtaskPatchToRow(patch: SubtaskPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId;
  if (patch.start !== undefined) row.start = patch.start;
  if (patch.plannedDays !== undefined) row.planned_days = patch.plannedDays;
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.dependsOn !== undefined) row.depends_on = patch.dependsOn;
  return row;
}

export function createSupabaseRepository(sb: SupabaseClient, viewer: Viewer | null = null): ProjectRepository {
  const selectProjects = () =>
    sb.from("projects").select(PROJECT_SELECT).order("created_at", { referencedTable: "comments" });

  async function fetchProject(id: number): Promise<Project> {
    const row = unwrap(await selectProjects().eq("id", id).single()) as unknown as ProjectRow;
    return rowToProject(row);
  }

  async function listTeam(): Promise<TeamMember[]> {
    const rows = unwrap(
      await sb.from("team_members").select("id, name, initials, color, role, cost_per_day").order("id"),
    ) as TeamMemberRow[];
    return rows.map(rowToTeamMember);
  }

  /** Ids of a project's tasks — only fetched when a dependency list must be checked. */
  async function subtaskIds(projectId: number): Promise<number[]> {
    const rows = unwrap(await sb.from("subtasks").select("id").eq("project_id", projectId)) as { id: BigintValue }[];
    return rows.map((r) => toId(r.id));
  }

  /** Rewrite `depends_on` for the project's tasks that currently contain `id`. */
  async function editDependents(
    projectId: number,
    rows: { id: BigintValue; depends_on: BigintValue[] | null }[],
    edit: (deps: number[]) => number[],
  ): Promise<void> {
    for (const r of rows) {
      const { error } = await sb
        .from("subtasks")
        .update({ depends_on: edit(toIds(r.depends_on)) })
        .eq("id", toId(r.id))
        .eq("project_id", projectId);
      check(error);
    }
  }

  return {
    async listProjects() {
      const rows = unwrap(await selectProjects().order("id")) as unknown as ProjectRow[];
      return rows.map(rowToProject);
    },

    async getProject(id) {
      const { data, error } = await selectProjects().eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToProject(data as unknown as ProjectRow) : null;
    },

    listTeam,

    async createProject(input) {
      const v = parseNewProject(input);
      const inserted = unwrap(
        await sb
          .from("projects")
          .insert({
            name: v.name,
            client: v.client,
            discipline: v.discipline,
            responsable_id: v.responsableId,
            phase_index: v.phaseIndex,
            status: "à jour",
            budget: v.budget,
            start: v.start,
            deadline: v.deadline,
          })
          .select("id")
          .single(),
      ) as { id: BigintValue };
      return fetchProject(toId(inserted.id));
    },

    async updateProject(id, patch) {
      let clean = parseProjectPatch(patch);
      // A one-sided date change is checked against the stored other date.
      if ((clean.start === undefined) !== (clean.deadline === undefined)) {
        const cur = unwrap(await sb.from("projects").select("start, deadline").eq("id", id).single()) as {
          start: string; deadline: string;
        };
        clean = parseProjectPatch(clean, cur);
      }
      const row: Record<string, unknown> = {};
      if (clean.name !== undefined) row.name = clean.name;
      if (clean.client !== undefined) row.client = clean.client;
      if (clean.discipline !== undefined) row.discipline = clean.discipline;
      if (clean.budget !== undefined) row.budget = clean.budget;
      if (clean.deadline !== undefined) row.deadline = clean.deadline;
      if (clean.start !== undefined) row.start = clean.start;
      if (clean.responsableId !== undefined) row.responsable_id = clean.responsableId;
      if (Object.keys(row).length) check((await sb.from("projects").update(row).eq("id", id)).error);
      return fetchProject(id);
    },

    async setPhase(id, phaseIndex) {
      check((await sb.from("projects").update({ phase_index: parsePhaseIndex(phaseIndex) }).eq("id", id)).error);
      return fetchProject(id);
    },

    async setStatus(id, status) {
      check((await sb.from("projects").update({ status: parseStatus(status) }).eq("id", id)).error);
      return fetchProject(id);
    },

    async addComment(id, text) {
      const body = parseCommentText(text);
      // Author = the signed-in user's linked team member (author_id defaults to
      // auth.uid() in the DB and the insert policy enforces it).
      const { data: me } = viewer?.memberId != null
        ? await sb.from("team_members").select("name, initials, color").eq("id", viewer.memberId).maybeSingle()
        : { data: null };
      const fallback = viewer?.email?.split("@")[0] ?? "Utilisateur";
      const { error } = await sb.from("comments").insert({
        project_id: id,
        author: me?.name ?? fallback,
        initials: me?.initials ?? fallback.slice(0, 2).toUpperCase(),
        color: me?.color ?? "#4F5A63",
        text: body,
      });
      check(error);
      return fetchProject(id);
    },

    async addSubtask(projectId, input) {
      const hasDeps = Array.isArray(input.dependsOn) && input.dependsOn.length > 0;
      const v = parseNewSubtask(input, hasDeps ? await subtaskIds(projectId) : []);
      const { error } = await sb.from("subtasks").insert({
        project_id: projectId,
        name: v.name,
        assignee_id: v.assigneeId,
        start: v.start,
        planned_days: v.plannedDays,
        done: false,
        depends_on: v.dependsOn,
      });
      check(error);
      return fetchProject(projectId);
    },

    async updateSubtask(projectId, subtaskId, patch) {
      const hasDeps = Array.isArray(patch.dependsOn) && patch.dependsOn.length > 0;
      const clean = parseSubtaskPatch(patch, hasDeps ? await subtaskIds(projectId) : [], subtaskId);
      const row = subtaskPatchToRow(clean);
      if (Object.keys(row).length) {
        const updated = unwrap(
          await sb.from("subtasks").update(row).eq("id", subtaskId).eq("project_id", projectId).select("id"),
        ) as unknown[];
        if (!updated.length) throw new UserFacingError("Tâche introuvable.");
      }
      return fetchProject(projectId);
    },

    async deleteSubtask(projectId, subtaskId) {
      check((await sb.from("subtasks").delete().eq("id", subtaskId).eq("project_id", projectId)).error);
      // Drop the deleted id from its siblings' dependencies. The schema's
      // AFTER DELETE trigger does the same in the database; this keeps older
      // installs consistent too (and finds nothing when the trigger ran).
      const dependents = unwrap(
        await sb.from("subtasks").select("id, depends_on").eq("project_id", projectId).contains("depends_on", [subtaskId]),
      ) as { id: BigintValue; depends_on: BigintValue[] | null }[];
      await editDependents(projectId, dependents, (deps) => deps.filter((d) => d !== subtaskId));
      return fetchProject(projectId);
    },

    async restoreSubtask(projectId, subtask, dependentIds) {
      const siblings = unwrap(
        await sb.from("subtasks").select("id, depends_on").eq("project_id", projectId),
      ) as { id: BigintValue; depends_on: BigintValue[] | null }[];
      const siblingIds = siblings.map((r) => toId(r.id));
      if (siblingIds.includes(subtask.id)) throw new UserFacingError("Cette tâche existe déjà.");
      const s = parseSubtaskRecord(subtask, siblingIds);
      // Same id as before the delete (subtasks.id is "generated by default").
      const { error } = await sb.from("subtasks").insert({
        id: s.id,
        project_id: projectId,
        name: s.name,
        assignee_id: s.assigneeId,
        start: s.start,
        planned_days: s.plannedDays,
        done: s.done,
        depends_on: s.dependsOn,
      });
      check(error);
      const wanted = new Set(dependentIds);
      await editDependents(
        projectId,
        siblings.filter((r) => wanted.has(toId(r.id)) && !toIds(r.depends_on).includes(s.id)),
        (deps) => [...deps, s.id],
      );
      return fetchProject(projectId);
    },

    async addTeamMember(input) {
      const v = parseNewTeamMember(input);
      // No id: the identity column assigns the next one (never a reused id).
      const { error } = await sb.from("team_members").insert({
        name: v.name,
        initials: v.initials,
        color: v.color,
        role: v.role,
        cost_per_day: v.costPerDay ?? DEFAULT_COST_PER_DAY,
      });
      check(error);
      return listTeam();
    },

    async updateTeamMember(id, patch) {
      const clean = parseTeamMemberPatch(patch);
      const row: Record<string, unknown> = {};
      if (clean.name !== undefined) row.name = clean.name;
      if (clean.initials !== undefined) row.initials = clean.initials;
      if (clean.color !== undefined) row.color = clean.color;
      if (clean.role !== undefined) row.role = clean.role;
      if (clean.costPerDay !== undefined) row.cost_per_day = clean.costPerDay;
      if (Object.keys(row).length) {
        const updated = unwrap(await sb.from("team_members").update(row).eq("id", id).select("id")) as unknown[];
        if (!updated.length) throw new UserFacingError("Membre introuvable.");
      }
      return listTeam();
    },

    async deleteTeamMember(id) {
      // Refuse rather than orphan: the foreign keys would reject it anyway, but
      // with an opaque message.
      const [led, assigned] = await Promise.all([
        sb.from("projects").select("id", { count: "exact", head: true }).eq("responsable_id", id),
        sb.from("subtasks").select("id", { count: "exact", head: true }).eq("assignee_id", id),
      ]);
      check(led.error);
      check(assigned.error);
      if ((led.count ?? 0) > 0 || (assigned.count ?? 0) > 0) throw new UserFacingError(MEMBER_IN_USE_MESSAGE);
      const { error } = await sb.from("team_members").delete().eq("id", id);
      if (error?.code === "23503") throw new UserFacingError(MEMBER_IN_USE_MESSAGE); // FK race
      check(error);
      return listTeam();
    },

    async restoreTeamMember(member) {
      const m = parseTeamMemberRecord(member);
      const { error } = await sb.from("team_members").insert({
        id: m.id,
        name: m.name,
        initials: m.initials,
        color: m.color,
        role: m.role,
        cost_per_day: m.costPerDay,
      });
      if (error?.code === "23505") throw new UserFacingError("Ce membre existe déjà.");
      check(error);
      return listTeam();
    },
  };
}
