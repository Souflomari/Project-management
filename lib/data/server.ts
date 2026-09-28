import "server-only";

import type { User } from "@supabase/supabase-js";

import type { Viewer } from "../types";
import { isSupabaseConfigured } from "../supabase/config";
import { createServerSupabaseClient } from "../supabase/server";
import type { ProjectRepository } from "./repository";
import { sampleRepository } from "./sample-repository";
import { createSupabaseRepository } from "./supabase-repository";

export interface ServerContext {
  repository: ProjectRepository;
  /** Signed-in user, or null in sample mode / when unauthenticated. */
  user: User | null;
  /** App identity: set only when the user has been granted access (a row in
   *  `app_users`). A signed-in user without it can't read or write anything. */
  viewer: Viewer | null;
}

/**
 * Resolve the active repository for the current request.
 *   • Supabase configured → repository bound to the request's auth session
 *   • otherwise           → the sample repository (seed data; reads only on the
 *                           server — demo edits live in each visitor's browser)
 */
export async function getServerContext(): Promise<ServerContext> {
  if (!isSupabaseConfigured()) {
    return { repository: sampleRepository, user: null, viewer: null };
  }
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  let viewer: Viewer | null = null;
  if (user) {
    const { data } = await client
      .from("app_users")
      .select("member_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      viewer = {
        email: user.email ?? null,
        memberId: (data.member_id as number | null) ?? null,
        role: data.role === "admin" ? "admin" : "member",
      };
    }
  }
  return { repository: createSupabaseRepository(client, viewer), user, viewer };
}

export async function getServerRepository(): Promise<ProjectRepository> {
  return (await getServerContext()).repository;
}
