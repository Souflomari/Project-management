// The data-access seam. Every read/write goes through this interface; the
// Supabase implementation drops in with no UI changes.

import type {
  NewSubtaskInput,
  NewTeamMemberInput,
  Project,
  Status,
  Subtask,
  TeamMember,
} from "../types";

export interface NewProjectInput {
  name: string;
  client: string;
  responsableId: number;
}

export type SubtaskPatch = Partial<Omit<Subtask, "id">>;
export type TeamMemberPatch = Partial<NewTeamMemberInput>;

export interface ProjectRepository {
  listProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | null>;
  listTeam(): Promise<TeamMember[]>;

  // project mutations
  createProject(input: NewProjectInput): Promise<Project>;
  setPhase(id: number, phaseIndex: number): Promise<Project>;
  setStatus(id: number, status: Status): Promise<Project>;
  addComment(id: number, text: string): Promise<Project>;

  // task (sous-tâche) mutations
  addSubtask(projectId: number, input: NewSubtaskInput): Promise<Project>;
  updateSubtask(projectId: number, subtaskId: number, patch: SubtaskPatch): Promise<Project>;
  deleteSubtask(projectId: number, subtaskId: number): Promise<Project>;

  // team mutations
  addTeamMember(input: NewTeamMemberInput): Promise<TeamMember[]>;
  updateTeamMember(id: number, patch: TeamMemberPatch): Promise<TeamMember[]>;
  deleteTeamMember(id: number): Promise<TeamMember[]>;
}
