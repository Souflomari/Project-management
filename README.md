# Setec · Pilotage des projets

A project-portfolio tool for an engineering firm (setec, Direction technique),
rebuilt as a real Next.js app from the original HTML design.

It tracks engineering projects across six views:

| View | Route | Description |
| --- | --- | --- |
| **Tableau de bord** | `/` | KPIs, upcoming deliverables (échéancier), points de vigilance |
| **Projets** | `/projets` | Filterable portfolio table |
| **Planning** | `/planning` | Interactive Gantt — click a project to expand its tasks as sub-bars |
| **Calendrier** | `/calendrier` | Month / week / agenda views, per-project filter, project-labelled events |
| **Kanban** | `/kanban` | Cards grouped by study phase, drag to advance the phase |
| **Équipe** | `/equipe` | Editable team + workload (charge) per week/month |

Each project has: name, client (maître d'ouvrage), study phase
(ESQ → APS → APD → PRO → DCE → EXE → RÉC), fees (honoraires, in k€), a project
lead, a status (à jour / à risque / en retard / terminé), and a list of editable
**tasks (sous-tâches)** — each with its own assignee, start date and planned
days. **Progress** and the **next deliverable** are derived from those tasks.
Clicking any project opens a drawer to add / rename / reschedule / reassign /
delete tasks; "+ Nouveau projet" adds a project, and Équipe manages the team.

**Workload (charge):** a person's charge for the selected week/month =
their planned task-days falling in that period ÷ working days available, shown
as a % (with the raw days). Tasks are assignable per person, so it reflects real
allocation.

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

The data layer is isolated behind a single interface, so the views never know
which backend they are talking to.

```
lib/
  types.ts                   # domain model (Project, TeamMember, Viewer, …)
  validation.ts              # zod schemas + French messages for every write
  data/
    repository.ts            # ProjectRepository interface (reads + mutations)
    sample-data.ts           # the seed content (25 projects, 6 people)
    sample-repository.ts     # in-memory implementation, persisted in localStorage
    supabase-repository.ts   # Supabase implementation of ProjectRepository
    server.ts                # picks the repository per request (+ signed-in viewer)
    index.ts                 # client-safe exports (sample repository)
  supabase/                  # auth-aware Supabase clients (config/server/browser)
  derive.ts                  # pure view-model derivation (KPIs, gantt, calendar…)
  format.ts                  # date / budget formatting
  store/projects-context.tsx # client store (state + optimistic actions)
app/actions.ts               # server actions for writes (access check + validation)
proxy.ts                     # auth gate / session refresh (Next "proxy" middleware)
supabase/schema.sql          # tables, constraints, RLS, access helpers
scripts/seed-supabase.ts     # loads the sample portfolio into Supabase
```

The active backend is chosen at request time:

- **Demo mode** (no Supabase env vars): the server renders the sample portfolio,
  and every edit is applied **in the visitor's browser** — kept in
  `localStorage` (versioned and validated on load), never sent anywhere. Each
  visitor has their own copy; *Paramètres → Réinitialiser la démonstration*
  restores the seed. Server writes are **disabled**: the server actions refuse
  to run, so nobody can change the data other visitors see. No login.
- **Supabase mode** (env vars set): the whole app is gated behind login;
  reads use a request-scoped, authenticated Supabase client and writes go
  through **server actions** (`app/actions.ts`), which check that the caller is
  signed in *and* granted access, validate the input, then call the
  repository. RLS enforces access again in the database.

Every write is validated with the same rules in both modes
(`lib/validation.ts`: required names, real `yyyy-mm-dd` dates, échéance ≥
début, whole days 1–1000, dependencies within the project…); rejected input is
reported as a French toast instead of being saved or silently clamped.

### Authentication

Login uses **Supabase Auth — email magic link**, with sign-ups closed: only
invited users can sign in, and only those with a row in `app_users` see any
data. When Supabase env vars are present, `proxy.ts` redirects unauthenticated
visitors to `/login`; the magic link returns to `/auth/callback`, which
exchanges the code for a session cookie. The sidebar and *Paramètres* show the
signed-in person's team member (name, initials, colour); comments are signed
with it.

### Connecting Supabase

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql)
   in its SQL editor (tables, constraints, RLS policies, access helpers). The
   file is idempotent: re-run it after pulling a newer version.
2. In **Authentication → Providers → Email**, enable Email (magic link) and
   **disable "Allow new users to sign up"**. Under **Authentication → URL
   Configuration**, add your site URL and `…/auth/callback` to the redirect
   allow-list (e.g. `http://localhost:3000` and your Vercel URL).
3. Copy `.env.example` to `.env` and fill in all four values
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`).
4. Seed the database with the sample portfolio: `npm run seed` (optional — skip
   it to start empty, but create at least one team member). It prints the team
   ids you need for the next step.
5. **Invite users** from **Authentication → Users → Invite user**.
6. **Grant access.** Signing in is not enough: each person needs a row in
   `app_users` linking their login to a team member. Create the first admin in
   the SQL editor:

   ```sql
   insert into app_users (user_id, member_id, role)
   select id, 0, 'admin' from auth.users where email = 'you@setec.fr';
   ```

   Add everyone else the same way with `role = 'member'` (admins can manage
   `app_users` rows; only admins can delete projects).
7. Restart `npm run dev`, then sign in with your email. On Vercel, set the two
   `NEXT_PUBLIC_*` vars in the project settings (the service-role key is only
   needed locally for seeding — never expose it to the browser).

> **Note:** "today" comes from `REFERENCE_DATE` in `lib/format.ts` (the current
> date, Europe/Paris); relative labels, the sidebar week and default project
> dates are all anchored to it.

## Original design

The source design is kept in
[`docs/prototype/pilotage-cards-standalone.html`](docs/prototype/pilotage-cards-standalone.html) for reference.
