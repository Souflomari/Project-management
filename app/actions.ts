"use server";

import { redirect } from "next/navigation";

import type {
  NewProjectInput,
  ProjectPatch,
  SubtaskPatch,
  TeamMemberPatch,
} from "@/lib/data/repository";
import { getServerContext } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  NewSubtaskInput,
  NewTeamMemberInput,
  Project,
  Status,
  TeamMember,
} from "@/lib/types";

/** Resolve the repository for a write. Server actions are public HTTP endpoints,
 *  so each one re-checks access here (the proxy is not a security boundary):
 *    • sample mode → refused: demo edits are applied in the visitor's browser and
 *      the server's seed data must never be mutable by anonymous callers;
 *    • Supabase    → the caller must be signed in AND granted access (app_users).
 *  RLS enforces the same rule again in the database. */
async function authedRepository() {
  if (!isSupabaseConfigured()) throw new Error("Server writes are disabled in demo mode");
  const { repository, user, viewer } = await getServerContext();
  if (!user) throw new Error("Not authenticated");
  if (!viewer) throw new Error("Not authorized");
  return repository;
}

export async function setPhaseAction(id: number, phaseIndex: number): Promise<Project> {
  return (await authedRepository()).setPhase(id, phaseIndex);
}

export async function setStatusAction(id: number, status: Status): Promise<Project> {
  return (await authedRepository()).setStatus(id, status);
}

export async function addCommentAction(id: number, text: string): Promise<Project> {
  return (await authedRepository()).addComment(id, text);
}

export async function createProjectAction(input: NewProjectInput): Promise<Project> {
  return (await authedRepository()).createProject(input);
}

export async function updateProjectAction(id: number, patch: ProjectPatch): Promise<Project> {
  return (await authedRepository()).updateProject(id, patch);
}

export async function addSubtaskAction(projectId: number, input: NewSubtaskInput): Promise<Project> {
  return (await authedRepository()).addSubtask(projectId, input);
}

export async function updateSubtaskAction(
  projectId: number,
  subtaskId: number,
  patch: SubtaskPatch,
): Promise<Project> {
  return (await authedRepository()).updateSubtask(projectId, subtaskId, patch);
}

export async function deleteSubtaskAction(projectId: number, subtaskId: number): Promise<Project> {
  return (await authedRepository()).deleteSubtask(projectId, subtaskId);
}

export async function addTeamMemberAction(input: NewTeamMemberInput): Promise<TeamMember[]> {
  return (await authedRepository()).addTeamMember(input);
}

export async function updateTeamMemberAction(id: number, patch: TeamMemberPatch): Promise<TeamMember[]> {
  return (await authedRepository()).updateTeamMember(id, patch);
}

export async function deleteTeamMemberAction(id: number): Promise<TeamMember[]> {
  return (await authedRepository()).deleteTeamMember(id);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
