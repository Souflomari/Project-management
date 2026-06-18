import "server-only";

import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "../supabase/config";
import { createServerSupabaseClient } from "../supabase/server";
import type { ProjectRepository } from "./repository";
import { sampleRepository } from "./sample-repository";
import { createSupabaseRepository } from "./supabase-repository";

export interface ServerContext {
  repository: ProjectRepository;
  /** Signed-in user, or null in sample mode / when unauthenticated. */
  user: User | null;
}

/**
 * Resolve the active repository for the current request.
 *   • Supabase configured → repository bound to the request's auth session
 *   • otherwise           → in-memory sample repository
 */
export async function getServerContext(): Promise<ServerContext> {
  if (!isSupabaseConfigured()) {
    return { repository: sampleRepository, user: null };
  }
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return { repository: createSupabaseRepository(client), user };
}

export async function getServerRepository(): Promise<ProjectRepository> {
  return (await getServerContext()).repository;
}
