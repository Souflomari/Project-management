# Setec · Pilotage des projets

A project-portfolio tool for an engineering firm (setec, Direction technique),
rebuilt as a real Next.js app from the original HTML design.

It tracks engineering projects across six views:

| View | Route | Description |
| --- | --- | --- |
| **Tableau de bord** | `/` | KPIs, upcoming deliverables (échéancier), points de vigilance |
| **Projets** | `/projets` | Filterable portfolio table |
| **Planning** | `/planning` | Gantt — project durations & deliverable markers |
| **Calendrier** | `/calendrier` | Monthly calendar of deliverables (rendus) |
| **Kanban** | `/kanban` | Cards grouped by study phase, drag to advance the phase |
| **Équipe** | `/equipe` | Workload per responsable |

Each project has: name, client (maître d'ouvrage), study phase
(ESQ → APS → APD → PRO → DCE → EXE → RÉC), next deliverable + due date,
progress %, fees (honoraires, in M€), a responsible person, and a status
(à jour / à risque / en retard / terminé). Clicking any project opens a detail
drawer (phase stepper, deliverable checklist, status, comments); "+ Nouveau
projet" adds one.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- Styling ported directly from the design (inline styles, single "Design Setec"
  theme). Fonts (Montserrat, Oswald) load from Google Fonts.
- Runs on realistic in-memory **sample data** out of the box, with an optional
  **Supabase** backend (see below) that switches on via env vars.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

## Deploying to Vercel

Push the repo and import it in Vercel — it builds with zero configuration
(`next build`). No environment variables are required for the sample-data build.

## Data layer (built for the Supabase swap)

The data layer is isolated behind a single interface so the move to a real
database is a one-file change.

```
lib/
  types.ts                  # domain model (Project, TeamMember, Phase, Status, …)
  data/
    repository.ts           # ProjectRepository interface (reads + mutations)
    sample-data.ts          # the seed content (25 projects, 8 people)
    sample-repository.ts    # in-memory implementation
    index.ts                # exports the active repository  ← swap point
  data/
    supabase-client.ts      # supabase-js client (+ isSupabaseConfigured)
    supabase-repository.ts   # Supabase implementation of ProjectRepository
  derive.ts                 # pure view-model derivation (KPIs, gantt, calendar…)
  format.ts                 # date / budget formatting
  store/projects-context.tsx# client store (state + actions, calls the repository)
```

The active repository is chosen automatically in `lib/data/index.ts`: if the
Supabase env vars are present it uses `SupabaseRepository`, otherwise the sample
data. Nothing in `app/` or `components/` imports a concrete repository, so the
UI is unaffected either way.

### Connecting Supabase

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql)
   in its SQL editor (tables + open demo RLS policies).
2. Copy `.env.example` to `.env` and fill in all four values
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`).
3. Seed the database with the sample portfolio: `npm run seed`.
4. Restart `npm run dev` — the app now reads/writes Supabase. On Vercel, set the
   two `NEXT_PUBLIC_*` vars in the project settings.

> The RLS policies in `schema.sql` are intentionally **open** (anon read/write)
> for a no-auth demo. Lock them down with auth-scoped policies before using real
> data. Writes currently go straight from the browser via the anon key; moving
> them behind server actions is a natural follow-up.

> **Note:** dates are anchored to a fixed reference "today" (`REFERENCE_DATE` in
> `lib/format.ts`) so the curated sample data reads exactly as designed. Remove
> or change that once live data is connected.

## Original design

The source design is kept at the repo root
(`Pilotage Setec (cards version) - standalone.html`) for reference.
