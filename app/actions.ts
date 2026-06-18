"use server";

import { redirect } from "next/navigation";

import type { NewProjectInput } from "@/lib/data/repository";
import { getServerContext } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Project, Status } from "@/lib/types";

/** Resolve the repository, enforcing auth when Supabase is connected. */
async function authedRepository() {
  const { repository, user } = await getServerContext();
  if (isSupabaseConfigured() && !user) {
    throw new Error("Not authenticated");
  }
  return repository;
}

export async function setPhaseAction(id: number, phaseIndex: number): Promise<Project> {
  return (await authedRepository()).setPhase(id, phaseIndex);
}

export async function setStatusAction(id: number, status: Status): Promise<Project> {
  return (await authedRepository()).setStatus(id, status);
}

export async function toggleRenduAction(id: number): Promise<Project> {
  return (await authedRepository()).toggleRendu(id);
}

export async function toggleDeliverableAction(id: number, index: number): Promise<Project> {
  return (await authedRepository()).toggleDeliverable(id, index);
}

export async function addCommentAction(id: number, text: string): Promise<Project> {
  return (await authedRepository()).addComment(id, text);
}

export async function createProjectAction(input: NewProjectInput): Promise<Project> {
  return (await authedRepository()).createProject(input);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
