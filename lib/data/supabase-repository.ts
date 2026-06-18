// Supabase-backed implementation of ProjectRepository (task model).

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type {
  NewSubtaskInput,
  NewTeamMemberInput,
  Project,
  Status,
  Subtask,
  TeamMember,
} from "../types";
import type {
  NewProjectInput,
  ProjectRepository,
  SubtaskPatch,
  TeamMemberPatch,
} from "./repository";

const PROJECT_SELECT = `
  id, name, client, discipline, responsable_id, phase_index, status, budget, start, deadline,
  subtasks ( id, name, assignee_id, start, planned_days, done, depends_on ),
  comments ( author, initials, color, text, when_label, created_at )
`;

interface ProjectRow {
  id: number;
  name: string;
  client: string;
  discipline: string;
  responsable_id: number;
  phase_index: number;
  status: Status;
  budget: number;
  start: string;
  deadline: string;
  subtasks: { id: number; name: string; assignee_id: number; start: string; planned_days: number; done: boolean; depends_on: number[] | null }[];
  comments: {
    author: string; initials: string; color: string; text: string; when_label: string; created_at: string;
  }[];
}

function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error("No data returned from Supabase");
  return res.data;
}

function rowToProject(row: ProjectRow): Project {
  const subtasks: Subtask[] = [...row.subtasks]
    .sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id)
    .map((s) => ({
      id: s.id,
      name: s.name,
      assigneeId: s.assignee_id,
      start: s.start,
      plannedDays: s.planned_days,
      done: s.done,
      dependsOn: s.depends_on ?? [],
    }));
  return {
    id: row.id,
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
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({
        author: c.author, initials: c.initials, color: c.color, text: c.text, when: c.when_label,
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

export function createSupabaseRepository(sb: SupabaseClient): ProjectRepository {
  async function fetchProject(id: number): Promise<Project> {
    const row = unwrap(
      await sb.from("projects").select(PROJECT_SELECT).eq("id", id).single(),
    ) as unknown as ProjectRow;
    return rowToProject(row);
  }

  async function listTeam(): Promise<TeamMember[]> {
    return unwrap(
      await sb.from("team_members").select("id, name, initials, color, role").order("id"),
    ) as TeamMember[];
  }

  return {
    async listProjects() {
      const rows = unwrap(
        await sb.from("projects").select(PROJECT_SELECT).order("id"),
      ) as unknown as ProjectRow[];
      return rows.map(rowToProject);
    },

    async getProject(id) {
      const { data, error } = await sb.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToProject(data as unknown as ProjectRow) : null;
    },

    listTeam,

    async createProject(input: NewProjectInput) {
      const inserted = unwrap(
        await sb
          .from("projects")
          .insert({
            name: input.name.trim(),
            client: input.client.trim() || "À définir",
            discipline: "À définir",
            responsable_id: input.responsableId,
            phase_index: 0,
            status: "à jour",
            budget: 0,
            start: "2026-06-15",
            deadline: "2027-06-30",
          })
          .select("id")
          .single(),
      ) as { id: number };
      return fetchProject(inserted.id);
    },

    async setPhase(id, phaseIndex) {
      const { error } = await sb.from("projects").update({ phase_index: phaseIndex }).eq("id", id);
      if (error) throw new Error(error.message);
      return fetchProject(id);
    },

    async setStatus(id, status: Status) {
      const { error } = await sb.from("projects").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      return fetchProject(id);
    },

    async addComment(id, text) {
      const trimmed = text.trim();
      if (!trimmed) return fetchProject(id);
      const { error } = await sb.from("comments").insert({
        project_id: id, author: "P. Dubois", initials: "PD", color: "#1D4459", text: trimmed, when_label: "à l'instant",
      });
      if (error) throw new Error(error.message);
      return fetchProject(id);
    },

    async addSubtask(projectId, input: NewSubtaskInput) {
      const { error } = await sb.from("subtasks").insert({
        project_id: projectId,
        name: input.name.trim() || "Nouvelle tâche",
        assignee_id: input.assigneeId,
        start: input.start,
        planned_days: Math.max(1, Math.floor(input.plannedDays)),
        done: false,
        depends_on: input.dependsOn ?? [],
      });
      if (error) throw new Error(error.message);
      return fetchProject(projectId);
    },

    async updateSubtask(projectId, subtaskId, patch: SubtaskPatch) {
      const { error } = await sb
        .from("subtasks")
        .update(subtaskPatchToRow(patch))
        .eq("id", subtaskId)
        .eq("project_id", projectId);
      if (error) throw new Error(error.message);
      return fetchProject(projectId);
    },

    async deleteSubtask(projectId, subtaskId) {
      const { error } = await sb.from("subtasks").delete().eq("id", subtaskId).eq("project_id", projectId);
      if (error) throw new Error(error.message);
      return fetchProject(projectId);
    },

    async addTeamMember(input: NewTeamMemberInput) {
      const existing = unwrap(await sb.from("team_members").select("id")) as { id: number }[];
      const id = Math.max(-1, ...existing.map((m) => m.id)) + 1;
      const { error } = await sb.from("team_members").insert({ id, ...input });
      if (error) throw new Error(error.message);
      return listTeam();
    },

    async updateTeamMember(id, patch: TeamMemberPatch) {
      const { error } = await sb.from("team_members").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return listTeam();
    },

    async deleteTeamMember(id) {
      const { error } = await sb.from("team_members").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return listTeam();
    },
  };
}
