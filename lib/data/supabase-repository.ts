// Supabase-backed implementation of ProjectRepository.
//
// Implements exactly the same interface as the sample repository, so switching
// to it (see index.ts) requires no changes anywhere in app/ or components/.

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Project, Status, TeamMember } from "../types";
import { STD_RENDUS } from "./sample-data";
import type { NewProjectInput, ProjectRepository } from "./repository";

const PROJECT_SELECT = `
  id, name, client, discipline, responsable_id, phase_index, progress, status,
  budget, start, deadline, rendu_label, rendu_date, rendu_done,
  deliverables ( label, done, position ),
  comments ( author, initials, color, text, when_label, created_at ),
  project_members ( member_id )
`;

interface ProjectRow {
  id: number;
  name: string;
  client: string;
  discipline: string;
  responsable_id: number;
  phase_index: number;
  progress: number;
  status: Status;
  budget: number;
  start: string;
  deadline: string;
  rendu_label: string;
  rendu_date: string;
  rendu_done: boolean;
  deliverables: { label: string; done: boolean; position: number }[];
  comments: {
    author: string;
    initials: string;
    color: string;
    text: string;
    when_label: string;
    created_at: string;
  }[];
  project_members: { member_id: number }[];
}

function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error("No data returned from Supabase");
  return res.data;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    discipline: row.discipline,
    responsableId: row.responsable_id,
    phaseIndex: row.phase_index,
    progress: row.progress,
    status: row.status,
    budget: row.budget,
    start: row.start,
    deadline: row.deadline,
    rendu: { label: row.rendu_label, date: row.rendu_date },
    renduDone: row.rendu_done,
    memberIds: row.project_members.map((m) => m.member_id),
    checklist: [...row.deliverables]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({ label: d.label, done: d.done })),
    comments: [...row.comments]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({
        author: c.author,
        initials: c.initials,
        color: c.color,
        text: c.text,
        when: c.when_label,
      })),
  };
}

export function createSupabaseRepository(sb: SupabaseClient): ProjectRepository {
  async function fetchProject(id: number): Promise<Project> {
    const row = unwrap(
      await sb.from("projects").select(PROJECT_SELECT).eq("id", id).single(),
    ) as unknown as ProjectRow;
    return rowToProject(row);
  }

  return {
    async listProjects() {
      const rows = unwrap(
        await sb.from("projects").select(PROJECT_SELECT).order("id"),
      ) as unknown as ProjectRow[];
      return rows.map(rowToProject);
    },

    async getProject(id) {
      const { data, error } = await sb
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToProject(data as unknown as ProjectRow) : null;
    },

    async listTeam() {
      const data = unwrap(
        await sb.from("team_members").select("id, name, initials, color, role").order("id"),
      );
      return data as TeamMember[];
    },

    async createProject(input: NewProjectInput) {
      const inserted = unwrap(
        await sb
          .from("projects")
          .insert({
            name: input.name.trim(),
            client: input.client.trim() || "À définir",
            discipline: "À définir",
            responsable_id: input.responsableId,
            phase_index: 0,
            progress: 0,
            status: "à jour",
            budget: 0,
            start: "2026-06-15",
            deadline: "2027-06-30",
            rendu_label: "Note de cadrage",
            rendu_date: "2026-09-30",
            rendu_done: false,
          })
          .select("id")
          .single(),
      ) as { id: number };

      const id = inserted.id;
      await sb.from("deliverables").insert(
        STD_RENDUS.map((label, position) => ({ project_id: id, position, label, done: false })),
      );
      await sb.from("project_members").insert({ project_id: id, member_id: input.responsableId });
      return fetchProject(id);
    },

    async setPhase(id, phaseIndex) {
      const r1 = await sb.from("projects").update({ phase_index: phaseIndex }).eq("id", id);
      if (r1.error) throw new Error(r1.error.message);
      // Keep finished phases ticked (mirrors the design's recalcCheck).
      const r2 = await sb
        .from("deliverables")
        .update({ done: true })
        .eq("project_id", id)
        .lt("position", phaseIndex);
      if (r2.error) throw new Error(r2.error.message);
      return fetchProject(id);
    },

    async setStatus(id, status: Status) {
      const { error } = await sb.from("projects").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      return fetchProject(id);
    },

    async toggleRendu(id) {
      const cur = unwrap(
        await sb.from("projects").select("rendu_done").eq("id", id).single(),
      ) as { rendu_done: boolean };
      const { error } = await sb
        .from("projects")
        .update({ rendu_done: !cur.rendu_done })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return fetchProject(id);
    },

    async toggleDeliverable(id, index) {
      const cur = unwrap(
        await sb
          .from("deliverables")
          .select("id, done")
          .eq("project_id", id)
          .eq("position", index)
          .single(),
      ) as { id: number; done: boolean };
      const { error } = await sb
        .from("deliverables")
        .update({ done: !cur.done })
        .eq("id", cur.id);
      if (error) throw new Error(error.message);
      return fetchProject(id);
    },

    async addComment(id, text) {
      const trimmed = text.trim();
      if (!trimmed) return fetchProject(id);
      const { error } = await sb.from("comments").insert({
        project_id: id,
        author: "P. Dubois",
        initials: "PD",
        color: "#1D4459",
        text: trimmed,
        when_label: "à l'instant",
      });
      if (error) throw new Error(error.message);
      return fetchProject(id);
    },
  };
}
