// The data-access seam. Every read/write the app needs goes through this
// interface. Today it's backed by in-memory sample data; tomorrow a
// `SupabaseRepository` implementing the same interface drops in with no UI
// changes — see lib/data/index.ts for the single swap point.

import type { Project, Status, TeamMember } from "../types";

export interface NewProjectInput {
  name: string;
  client: string;
  /** TeamMember.id of the responsible person. */
  responsableId: number;
}

export interface ProjectRepository {
  /** All projects in the portfolio. */
  listProjects(): Promise<Project[]>;
  /** A single project by id, or null. */
  getProject(id: number): Promise<Project | null>;
  /** The full team roster. */
  listTeam(): Promise<TeamMember[]>;

  // --- mutations ---
  createProject(input: NewProjectInput): Promise<Project>;
  setPhase(id: number, phaseIndex: number): Promise<Project>;
  setStatus(id: number, status: Status): Promise<Project>;
  toggleRendu(id: number): Promise<Project>;
  toggleDeliverable(id: number, index: number): Promise<Project>;
  addComment(id: number, text: string): Promise<Project>;
}
