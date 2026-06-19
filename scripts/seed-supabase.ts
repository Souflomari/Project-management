// Seed a Supabase project with the sample portfolio (task model).
//
// Usage:
//   1. run supabase/schema.sql in your Supabase project
//   2. set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
//   3. npm run seed
//
// Uses the service-role key to bypass RLS. Idempotent (clears first).

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
  // Deleting projects cascades to subtasks and comments.
  check("clear projects", (await sb.from("projects").delete().gt("id", 0)).error);

  const team = buildSampleTeam();
  check(
    "upsert team_members",
    (
      await sb.from("team_members").upsert(
        team.map((m) => ({
          id: m.id,
          name: m.name,
          initials: m.initials,
          color: m.color,
          role: m.role,
          cost_per_day: m.costPerDay,
        })),
      )
    ).error,
  );

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
        status: p.status,
        budget: p.budget,
        start: p.start,
        deadline: p.deadline,
      })
      .select("id")
      .single();
    check(`insert project "${p.name}"`, insert.error);
    const id = insert.data!.id as number;

    if (p.subtasks.length) {
      // Insert without deps first; a single multi-row INSERT returns rows in
      // insertion order, so dbIds[k] is the DB id of the k-th sample task.
      const ins = await sb
        .from("subtasks")
        .insert(
          p.subtasks.map((s) => ({
            project_id: id,
            name: s.name,
            assignee_id: s.assigneeId,
            start: s.start,
            planned_days: s.plannedDays,
            done: s.done,
          })),
        )
        .select("id");
      check(`subtasks "${p.name}"`, ins.error);
      const dbIds = (ins.data ?? []).map((r) => r.id as number);

      // Remap each task's dependsOn (sample ids 1..n) to the DB ids.
      for (let k = 0; k < p.subtasks.length; k++) {
        const deps = p.subtasks[k].dependsOn
          .map((sid) => dbIds[sid - 1])
          .filter((v): v is number => typeof v === "number");
        if (deps.length) {
          check(
            `deps "${p.name}"`,
            (await sb.from("subtasks").update({ depends_on: deps }).eq("id", dbIds[k])).error,
          );
        }
      }
    }

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
