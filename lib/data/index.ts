// Single swap point for the data layer.
//
// To move from sample data to Supabase later:
//   1. add `supabase-repository.ts` implementing `ProjectRepository`
//   2. change the line below to export it instead
// Nothing else in the app imports a concrete repository.

import { sampleRepository } from "./sample-repository";
import type { ProjectRepository } from "./repository";

export const repository: ProjectRepository = sampleRepository;

export type { ProjectRepository, NewProjectInput } from "./repository";
