"use server";

import { redirect } from "next/navigation";

import type {
  NewProjectInput,
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

/** Resolve the repository, enforcing auth when Supabase is connected. */
async function authedRepository() {
  const { repository, user } = await getServerContext();
  if (isSupabaseConfigured() && !user) throw new Error("Not authenticated");
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
