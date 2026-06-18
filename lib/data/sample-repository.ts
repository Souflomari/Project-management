// In-memory implementation of ProjectRepository backed by the sample data.
// State lives in module-level arrays so a browser session sees its own edits.

import { FINAL_PHASE_INDEX } from "../types";
import type {
  NewSubtaskInput,
  NewTeamMemberInput,
  Project,
  Status,
  TeamMember,
} from "../types";
import { buildSampleProjects, buildSampleTeam } from "./sample-data";
import type {
  NewProjectInput,
  ProjectRepository,
  SubtaskPatch,
  TeamMemberPatch,
} from "./repository";

let projects: Project[] = buildSampleProjects();
let team: TeamMember[] = buildSampleTeam();

const clone = <T>(v: T): T => structuredClone(v);

function mustFind(id: number): Project {
  const p = projects.find((x) => x.id === id);
  if (!p) throw new Error(`Project ${id} not found`);
  return p;
}

function replace(updated: Project): Project {
  projects = projects.map((p) => (p.id === updated.id ? updated : p));
  return clone(updated);
}

function nextSubtaskId(p: Project): number {
  return Math.max(0, ...p.subtasks.map((s) => s.id)) + 1;
}

export const sampleRepository: ProjectRepository = {
  async listProjects() {
    return projects.map(clone);
  },

  async getProject(id) {
    const p = projects.find((x) => x.id === id);
    return p ? clone(p) : null;
  },

  async listTeam() {
    return team.map(clone);
  },

  async createProject(input: NewProjectInput) {
    const id = Math.max(0, ...projects.map((p) => p.id)) + 1;
    const np: Project = {
      id,
      name: input.name.trim(),
      client: input.client.trim() || "À définir",
      discipline: "À définir",
      responsableId: input.responsableId,
      phaseIndex: 0,
      status: "à jour",
      budget: 0,
      start: "2026-06-15",
      deadline: "2027-06-30",
      subtasks: [],
      comments: [],
    };
    projects = [np, ...projects];
    return clone(np);
  },

  async setPhase(id, phaseIndex) {
    return replace({ ...mustFind(id), phaseIndex: Math.min(Math.max(0, phaseIndex), FINAL_PHASE_INDEX) });
  },

  async setStatus(id, status: Status) {
    return replace({ ...mustFind(id), status });
  },

  async addComment(id, text) {
    const p = mustFind(id);
    const trimmed = text.trim();
    if (!trimmed) return clone(p);
    const comment = {
      author: "P. Dubois",
      initials: "PD",
      color: "#1D4459",
      text: trimmed,
      when: "à l'instant",
    };
    return replace({ ...p, comments: [...p.comments, comment] });
  },

  async addSubtask(projectId, input: NewSubtaskInput) {
    const p = mustFind(projectId);
    const subtask = {
      id: nextSubtaskId(p),
      name: input.name.trim() || "Nouvelle tâche",
      assigneeId: input.assigneeId,
      start: input.start,
      plannedDays: Math.max(1, Math.floor(input.plannedDays)),
      done: false,
      dependsOn: input.dependsOn ?? [],
    };
    return replace({ ...p, subtasks: [...p.subtasks, subtask] });
  },

  async updateSubtask(projectId, subtaskId, patch: SubtaskPatch) {
    const p = mustFind(projectId);
    return replace({
      ...p,
      subtasks: p.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s)),
    });
  },

  async deleteSubtask(projectId, subtaskId) {
    const p = mustFind(projectId);
    return replace({ ...p, subtasks: p.subtasks.filter((s) => s.id !== subtaskId) });
  },

  async addTeamMember(input: NewTeamMemberInput) {
    const id = Math.max(-1, ...team.map((m) => m.id)) + 1;
    team = [...team, { id, ...input }];
    return team.map(clone);
  },

  async updateTeamMember(id, patch: TeamMemberPatch) {
    team = team.map((m) => (m.id === id ? { ...m, ...patch } : m));
    return team.map(clone);
  },

  async deleteTeamMember(id) {
    team = team.filter((m) => m.id !== id);
    return team.map(clone);
  },
};
