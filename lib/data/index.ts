// Single swap point for the data layer.
//
// The active repository is chosen at module load:
//   • Supabase env vars present  → SupabaseRepository (real database)
//   • otherwise                  → sampleRepository  (in-memory sample data)
//
// So the app deploys and runs on sample data today, and switches to Supabase the
// moment NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set —
// nothing else in the app imports a concrete repository.

import { sampleRepository } from "./sample-repository";
import { createSupabaseRepository } from "./supabase-repository";
import { isSupabaseConfigured } from "./supabase-client";
import type { ProjectRepository } from "./repository";

export const repository: ProjectRepository = isSupabaseConfigured()
  ? createSupabaseRepository()
  : sampleRepository;

export type { ProjectRepository, NewProjectInput } from "./repository";
