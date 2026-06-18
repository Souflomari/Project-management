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
- No backend yet — realistic in-memory **sample data**.

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
  derive.ts                 # pure view-model derivation (KPIs, gantt, calendar…)
  format.ts                 # date / budget formatting
  store/projects-context.tsx# client store (state + actions, calls the repository)
```

To connect Supabase later:

1. Add `lib/data/supabase-repository.ts` implementing `ProjectRepository`.
2. Change the one export in `lib/data/index.ts` to point at it.
3. (Optionally) move the store's write actions behind server actions.

Nothing in `app/` or `components/` imports a concrete repository, so the UI is
unaffected.

> **Note:** dates are anchored to a fixed reference "today" (`REFERENCE_DATE` in
> `lib/format.ts`) so the curated sample data reads exactly as designed. Remove
> or change that once live data is connected.

## Original design

The source design is kept at the repo root
(`Pilotage Setec (cards version) - standalone.html`) for reference.
