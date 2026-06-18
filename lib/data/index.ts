// Client-safe data exports.
//
// Reads happen on the server via `getServerRepository` (lib/data/server.ts) and
// writes via server actions (app/actions.ts). In sample mode the client store
// talks to `sampleRepository` directly for instant, session-local mutations.
// The Supabase swap is driven by env vars in lib/supabase/config.ts.

export type { ProjectRepository, NewProjectInput } from "./repository";
export { sampleRepository } from "./sample-repository";
