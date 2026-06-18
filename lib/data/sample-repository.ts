// In-memory implementation of ProjectRepository backed by the sample data.
//
// State lives in a module-level array so a browser session sees its own
// mutations persist while the tab is open. There is no real persistence yet —
// that arrives with the Supabase implementation. The mutation methods are kept
// faithful to the design's reducers so they can be reused as-is behind server
// actions once a database is connected.

import { FINAL_PHASE_INDEX } from "../types";
import type { Project, Status, TeamMember } from "../types";
import {
  STD_RENDUS,
  TEAM,
  buildSampleProjects,
  buildSampleTeam,
} from "./sample-data";
import type { NewProjectInput, ProjectRepository } from "./repository";

let projects: Project[] = buildSampleProjects();

const clone = (p: Project): Project => structuredClone(p);

function mustFind(id: number): Project {
  const p = projects.find((x) => x.id === id);
  if (!p) throw new Error(`Project ${id} not found`);
  return p;
}

/** Re-tick the checklist so finished phases stay ticked (design's recalcCheck). */
function recalcCheck(p: Project): Project {
  return {
    ...p,
    checklist: p.checklist.map((c, i) => ({ ...c, done: i < p.phaseIndex || c.done })),
  };
}

function replace(updated: Project): Project {
  projects = projects.map((p) => (p.id === updated.id ? updated : p));
  return clone(updated);
}

export const sampleRepository: ProjectRepository = {
  async listProjects() {
    return projects.map(clone);
  },

  async getProject(id) {
    const p = projects.find((x) => x.id === id);
    return p ? clone(p) : null;
  },

  async listTeam(): Promise<TeamMember[]> {
    return buildSampleTeam();
  },

  async createProject(input: NewProjectInput) {
    const ri = input.responsableId;
    const id = Math.max(0, ...projects.map((p) => p.id)) + 1;
    const np: Project = {
      id,
      name: input.name.trim(),
      client: input.client.trim() || "À définir",
      discipline: "À définir",
      responsableId: ri,
      phaseIndex: 0,
      progress: 0,
      status: "à jour",
      budget: 0,
      start: "2026-06-15",
      deadline: "2027-06-30",
      rendu: { label: "Note de cadrage", date: "2026-09-30" },
      renduDone: false,
      memberIds: [ri],
      checklist: STD_RENDUS.map((label) => ({ label, done: false })),
      comments: [],
    };
    projects = [np, ...projects];
    return clone(np);
  },

  async setPhase(id, phaseIndex) {
    const next = recalcCheck({ ...mustFind(id), phaseIndex });
    return replace(next);
  },

  async setStatus(id, status: Status) {
    return replace({ ...mustFind(id), status });
  },

  async toggleRendu(id) {
    const p = mustFind(id);
    return replace({ ...p, renduDone: !p.renduDone });
  },

  async toggleDeliverable(id, index) {
    const p = mustFind(id);
    return replace({
      ...p,
      checklist: p.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c)),
    });
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
};

/** Advance a project by one phase (capped at the final phase). */
export function nextPhaseIndex(current: number): number {
  return Math.min(current + 1, FINAL_PHASE_INDEX);
}

// Re-export so consumers can reference the roster without a second import.
export const SAMPLE_TEAM = TEAM;
