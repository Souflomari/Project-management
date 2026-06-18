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
  **Supabase** backend + **magic-link auth** (see below) that switches on via
  env vars.

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
  store/projects-context.tsx# client store (state + actions)
lib/supabase/              # auth-aware Supabase clients (config/server/browser)
app/actions.ts             # server actions for writes (auth + RLS)
proxy.ts                   # auth gate / session refresh (Next "proxy" middleware)
```

The active backend is chosen at request time:

- **Sample mode** (no env vars): reads come from the in-memory sample data and
  writes happen client-side for instant, session-local edits. No login.
- **Supabase mode** (env vars set): the whole app is gated behind login;
  reads use a request-scoped, authenticated Supabase client and writes go
  through **server actions** (`app/actions.ts`) subject to RLS.

Nothing in the views imports a concrete repository, so the UI is identical
either way.

### Authentication

Login uses **Supabase Auth — email magic link**. When Supabase env vars are
present, `proxy.ts` redirects unauthenticated visitors to `/login`; the magic
link returns to `/auth/callback`, which exchanges the code for a session cookie.

### Connecting Supabase

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql)
   in its SQL editor (tables + authenticated-only RLS policies).
2. In **Authentication → Providers**, enable **Email** (magic link). Under
   **Authentication → URL Configuration**, add your site URL and
   `…/auth/callback` to the redirect allow-list (e.g. `http://localhost:3000`
   and your Vercel URL).
3. Copy `.env.example` to `.env` and fill in all four values
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`).
4. Seed the database with the sample portfolio: `npm run seed`.
5. Restart `npm run dev`, then sign in with your email. On Vercel, set the two
   `NEXT_PUBLIC_*` vars in the project settings (the service-role key is only
   needed locally for seeding).

> The RLS policies in `schema.sql` allow any **authenticated** user to read and
> write. Tighten them (per-team / per-owner roles) when you introduce roles.

> **Note:** dates are anchored to a fixed reference "today" (`REFERENCE_DATE` in
> `lib/format.ts`) so the curated sample data reads exactly as designed. Remove
> or change that once live data is connected.

## Original design

The source design is kept at the repo root
(`Pilotage Setec (cards version) - standalone.html`) for reference.
