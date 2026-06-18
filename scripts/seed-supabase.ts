// Seed a Supabase project with the sample portfolio.
//
// Usage:
//   1. run supabase/schema.sql in your Supabase project
//   2. set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
//   3. npm run seed
//
// Uses the service-role key (server-only) to bypass RLS. Re-running clears the
// existing rows first, so it is idempotent.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

import { buildSampleProjects, buildSampleTeam } from "../lib/data/sample-data";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

function check(label: string, error: { message: string } | null) {
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  // Deleting projects cascades to project_members, deliverables and comments.
  check("clear projects", (await sb.from("projects").delete().gt("id", 0)).error);

  const team = buildSampleTeam();
  check("upsert team_members", (await sb.from("team_members").upsert(team)).error);

  const projects = buildSampleProjects();
  let count = 0;
  for (const p of projects) {
    const insert = await sb
      .from("projects")
      .insert({
        name: p.name,
        client: p.client,
        discipline: p.discipline,
        responsable_id: p.responsableId,
        phase_index: p.phaseIndex,
        progress: p.progress,
        status: p.status,
        budget: p.budget,
        start: p.start,
        deadline: p.deadline,
        rendu_label: p.rendu.label,
        rendu_date: p.rendu.date,
        rendu_done: p.renduDone,
      })
      .select("id")
      .single();
    check(`insert project "${p.name}"`, insert.error);
    const id = insert.data!.id as number;

    check(
      `deliverables "${p.name}"`,
      (
        await sb.from("deliverables").insert(
          p.checklist.map((c, position) => ({
            project_id: id,
            position,
            label: c.label,
            done: c.done,
          })),
        )
      ).error,
    );

    check(
      `members "${p.name}"`,
      (
        await sb
          .from("project_members")
          .insert(p.memberIds.map((member_id) => ({ project_id: id, member_id })))
      ).error,
    );

    if (p.comments.length) {
      check(
        `comments "${p.name}"`,
        (
          await sb.from("comments").insert(
            p.comments.map((c) => ({
              project_id: id,
              author: c.author,
              initials: c.initials,
              color: c.color,
              text: c.text,
              when_label: c.when,
            })),
          )
        ).error,
      );
    }
    count++;
  }

  console.log(`✓ Seeded ${team.length} team members and ${count} projects.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
