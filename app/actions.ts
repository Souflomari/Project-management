"use server";

import { redirect } from "next/navigation";

import type { ProjectRepository } from "@/lib/data/repository";
import { getServerContext } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Project, TeamMember } from "@/lib/types";
import {
  UserFacingError,
  parseCommentText,
  parseId,
  parseNewProject,
  parseNewTeamMember,
  parsePhaseIndex,
  parseProjectPatch,
  parseStatus,
  parseTeamMemberPatch,
  parseTeamMemberRecord,
  parseWith,
  newSubtaskSchema,
  subtaskPatchSchema,
  subtaskRecordSchema,
} from "@/lib/validation";
import { z } from "zod";

/** Outcome of a write. Expected failures (invalid input, a refused delete)
 *  come back as `{ ok: false, error }` with a French message the client shows
 *  as-is — thrown errors are redacted by Next.js in production. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Resolve the repository for a write. Server actions are public HTTP endpoints,
 *  so each one re-checks access here (the proxy is not a security boundary):
 *    • sample mode → refused: demo edits are applied in the visitor's browser and
 *      the server's seed data must never be mutable by anonymous callers;
 *    • Supabase    → the caller must be signed in AND granted access (app_users).
 *  RLS enforces the same rule again in the database. */
async function authedRepository(): Promise<ProjectRepository> {
  if (!isSupabaseConfigured()) throw new Error("Server writes are disabled in demo mode");
  const { repository, user, viewer } = await getServerContext();
  if (!user) throw new Error("Not authenticated");
  if (!viewer) throw new Error("Not authorized");
  return repository;
}

/** Check access, then run `fn`. Arguments are untrusted: every action parses
 *  them (lib/validation) before calling the repository, which checks again the
 *  rules that need stored state (dependencies, date order, references). */
async function run<T>(fn: (repo: ProjectRepository) => Promise<T>): Promise<ActionResult<T>> {
  const repo = await authedRepository();
  try {
    return { ok: true, data: await fn(repo) };
  } catch (e) {
    if (e instanceof UserFacingError) return { ok: false, error: e.message };
    throw e;
  }
}

const idList = z.array(z.int().min(1)).max(1000);

export async function setPhaseAction(id: number, phaseIndex: number): Promise<ActionResult<Project>> {
  return run((repo) => repo.setPhase(parseId(id), parsePhaseIndex(phaseIndex)));
}

export async function setStatusAction(id: number, status: string): Promise<ActionResult<Project>> {
  return run((repo) => repo.setStatus(parseId(id), parseStatus(status)));
}

export async function addCommentAction(id: number, text: string): Promise<ActionResult<Project>> {
  return run((repo) => repo.addComment(parseId(id), parseCommentText(text)));
}

export async function createProjectAction(input: unknown): Promise<ActionResult<Project>> {
  return run((repo) => repo.createProject(parseNewProject(input)));
}

export async function updateProjectAction(id: number, patch: unknown): Promise<ActionResult<Project>> {
  return run((repo) => repo.updateProject(parseId(id), parseProjectPatch(patch)));
}

export async function addSubtaskAction(projectId: number, input: unknown): Promise<ActionResult<Project>> {
  // Dependency existence needs the project's tasks: the repository checks it.
  return run((repo) => repo.addSubtask(parseId(projectId), parseWith(newSubtaskSchema, input)));
}

export async function updateSubtaskAction(
  projectId: number,
  subtaskId: number,
  patch: unknown,
): Promise<ActionResult<Project>> {
  // Dependency existence / self-reference needs the project's tasks: the repository checks it.
  return run((repo) => repo.updateSubtask(parseId(projectId), parseId(subtaskId), parseWith(subtaskPatchSchema, patch)));
}

export async function deleteSubtaskAction(projectId: number, subtaskId: number): Promise<ActionResult<Project>> {
  return run((repo) => repo.deleteSubtask(parseId(projectId), parseId(subtaskId)));
}

export async function restoreSubtaskAction(
  projectId: number,
  subtask: unknown,
  dependentIds: unknown,
): Promise<ActionResult<Project>> {
  return run((repo) =>
    repo.restoreSubtask(
      parseId(projectId),
      parseWith(subtaskRecordSchema, subtask),
      parseWith(idList, dependentIds),
    ),
  );
}

export async function addTeamMemberAction(input: unknown): Promise<ActionResult<TeamMember[]>> {
  return run((repo) => repo.addTeamMember(parseNewTeamMember(input)));
}

export async function updateTeamMemberAction(id: number, patch: unknown): Promise<ActionResult<TeamMember[]>> {
  return run((repo) => repo.updateTeamMember(parseId(id), parseTeamMemberPatch(patch)));
}

export async function deleteTeamMemberAction(id: number): Promise<ActionResult<TeamMember[]>> {
  return run((repo) => repo.deleteTeamMember(parseId(id)));
}

export async function restoreTeamMemberAction(member: unknown): Promise<ActionResult<TeamMember[]>> {
  return run((repo) => repo.restoreTeamMember(parseTeamMemberRecord(member)));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
