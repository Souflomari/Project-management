// The data-access seam. Every read/write goes through this interface; the
// Supabase implementation drops in with no UI changes. Implementations validate
// their input (lib/validation.ts) and throw a UserFacingError with a French
// message when it is rejected.

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
  // Optional details the "Nouveau projet" form collects. Defaults: discipline
  // "À définir", budget 0, phase ESQ, start = REFERENCE_DATE, deadline = start + 1 an.
  discipline?: string;
  /** Fees in k€ (integer ≥ 0). */
  budget?: number;
  phaseIndex?: number;
  /** ISO yyyy-mm-dd. */
  start?: string;
  /** ISO yyyy-mm-dd, ≥ start. */
  deadline?: string;
}

export type SubtaskPatch = Partial<Omit<Subtask, "id">>;
export type TeamMemberPatch = Partial<NewTeamMemberInput>;
export type ProjectPatch = Partial<
  Pick<Project, "name" | "client" | "discipline" | "budget" | "deadline" | "start" | "responsableId">
>;

export interface ProjectRepository {
  listProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | null>;
  listTeam(): Promise<TeamMember[]>;

  // project mutations
  createProject(input: NewProjectInput): Promise<Project>;
  updateProject(id: number, patch: ProjectPatch): Promise<Project>;
  setPhase(id: number, phaseIndex: number): Promise<Project>;
  setStatus(id: number, status: Status): Promise<Project>;
  addComment(id: number, text: string): Promise<Project>;

  // task (sous-tâche) mutations
  addSubtask(projectId: number, input: NewSubtaskInput): Promise<Project>;
  updateSubtask(projectId: number, subtaskId: number, patch: SubtaskPatch): Promise<Project>;
  /** Deletes the task and removes it from its siblings' `dependsOn`. */
  deleteSubtask(projectId: number, subtaskId: number): Promise<Project>;
  /** Undo of a delete: re-inserts the exact task (same id, fields, done flag)
   *  and re-adds it to the `dependsOn` of `dependentIds`. */
  restoreSubtask(projectId: number, subtask: Subtask, dependentIds: number[]): Promise<Project>;

  // team mutations
  addTeamMember(input: NewTeamMemberInput): Promise<TeamMember[]>;
  updateTeamMember(id: number, patch: TeamMemberPatch): Promise<TeamMember[]>;
  /** Refused (UserFacingError) while the member leads a project or is assigned a task. */
  deleteTeamMember(id: number): Promise<TeamMember[]>;
  /** Undo of a delete: re-inserts the exact member (same id, costPerDay…). */
  restoreTeamMember(member: TeamMember): Promise<TeamMember[]>;
}
