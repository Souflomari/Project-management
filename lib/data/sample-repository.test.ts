import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MEMBER_IN_USE_MESSAGE, UserFacingError, ValidationError } from "../validation";
import { REFERENCE_DATE } from "../format";
import { buildSampleProjects, buildSampleTeam } from "./sample-data";
import { STORAGE_VERSION, clearSampleData, restorePersisted, sampleRepository as repo } from "./sample-repository";

const MEMBER = { name: "Léa", initials: "LE", color: "#4F5A63", role: "Ingénieure" };

beforeEach(() => clearSampleData());

describe("ids", () => {
  it("never reuses a deleted member id", async () => {
    const t1 = await repo.addTeamMember(MEMBER);
    const first = t1[t1.length - 1];
    expect(first.id).toBe(Math.max(...buildSampleTeam().map((m) => m.id)) + 1);
    expect(first.costPerDay).toBe(700);
    await repo.deleteTeamMember(first.id);
    const t2 = await repo.addTeamMember({ ...MEMBER, name: "Hugo" });
    expect(t2[t2.length - 1].id).toBe(first.id + 1);
  });

  it("never reuses a deleted task id", async () => {
    let p = await repo.addSubtask(1, { name: "A", assigneeId: 0, start: REFERENCE_DATE, plannedDays: 2 });
    const a = p.subtasks[p.subtasks.length - 1];
    await repo.deleteSubtask(1, a.id);
    p = await repo.addSubtask(1, { name: "B", assigneeId: 0, start: REFERENCE_DATE, plannedDays: 2 });
    const b = p.subtasks[p.subtasks.length - 1];
    expect(b.id).toBeGreaterThan(a.id);
    // Ids are unique across projects too.
    const other = await repo.addSubtask(2, { name: "C", assigneeId: 1, start: REFERENCE_DATE, plannedDays: 1 });
    expect(other.subtasks[other.subtasks.length - 1].id).toBeGreaterThan(b.id);
  });

  it("gives new projects fresh ids and the collected dates", async () => {
    const p = await repo.createProject({ name: " Pont ", client: "", responsableId: 1, start: "2026-09-01", deadline: "2027-01-31", budget: 120 });
    expect(p).toMatchObject({ id: 26, name: "Pont", client: "À définir", start: "2026-09-01", deadline: "2027-01-31", budget: 120 });
    const q = await repo.createProject({ name: "Quai", client: "Port", responsableId: 1 });
    expect(q.id).toBe(27);
    expect(q.start).toBe(REFERENCE_DATE);
    expect(q.deadline > q.start).toBe(true);
  });
});

describe("referential integrity", () => {
  it("removes a deleted task from its siblings' dependsOn", async () => {
    // Seed project 1: 1 ← 2 ← 3 ← 4 ← 5 (each depends on the previous one).
    const p = await repo.deleteSubtask(1, 2);
    expect(p.subtasks.map((s) => s.id)).toEqual([1, 3, 4, 5]);
    expect(p.subtasks.find((s) => s.id === 3)!.dependsOn).toEqual([]);
    expect(p.subtasks.flatMap((s) => s.dependsOn)).not.toContain(2);
  });

  it("restores the exact task, done flag and dependency edges", async () => {
    await repo.updateSubtask(1, 2, { done: true });
    const before = (await repo.getProject(1))!.subtasks.find((s) => s.id === 2)!;
    await repo.deleteSubtask(1, 2);
    const p = await repo.restoreSubtask(1, before, [3]);
    expect(p.subtasks.find((s) => s.id === 2)).toEqual(before);
    expect(p.subtasks.find((s) => s.id === 3)!.dependsOn).toEqual([2]);
    await expect(repo.restoreSubtask(1, before, [])).rejects.toThrow("Cette tâche existe déjà.");
  });

  it("refuses to delete a member who leads a project or is assigned a task", async () => {
    await expect(repo.deleteTeamMember(0)).rejects.toThrow(MEMBER_IN_USE_MESSAGE);
    await expect(repo.deleteTeamMember(0)).rejects.toBeInstanceOf(UserFacingError);
    expect((await repo.listTeam()).some((m) => m.id === 0)).toBe(true);
  });

  it("restores a deleted member with the same id and rate", async () => {
    const t = await repo.addTeamMember({ ...MEMBER, costPerDay: 910 });
    const m = t[t.length - 1];
    await repo.deleteTeamMember(m.id);
    const restored = await repo.restoreTeamMember(m);
    expect(restored.find((x) => x.id === m.id)).toEqual(m);
    // …and the counter still moves forward.
    const next = await repo.addTeamMember({ ...MEMBER, name: "Hugo" });
    expect(next[next.length - 1].id).toBe(m.id + 1);
  });

  it("rejects references to unknown members", async () => {
    await expect(repo.updateProject(1, { responsableId: 42 })).rejects.toThrow("Membre inconnu.");
    await expect(repo.addSubtask(1, { name: "X", assigneeId: 42, start: REFERENCE_DATE, plannedDays: 1 })).rejects.toThrow("Membre inconnu.");
  });
});

describe("validation", () => {
  it("rejects invalid writes instead of clamping or saving them", async () => {
    const p = (await repo.getProject(1))!;
    await expect(repo.updateProject(1, { deadline: "2000-01-01" })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateProject(1, { start: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateProject(1, { name: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateProject(1, { budget: -3 })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.setPhase(1, 9)).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.addComment(1, "  ")).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateSubtask(1, 2, { dependsOn: [2] })).rejects.toThrow("Une tâche ne peut pas dépendre d’elle-même.");
    await expect(repo.updateSubtask(1, 2, { dependsOn: [99] })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateSubtask(1, 2, { plannedDays: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateSubtask(1, 999, { done: true })).rejects.toThrow("Tâche introuvable.");
    await expect(repo.addTeamMember({ ...MEMBER, color: "blue" })).rejects.toBeInstanceOf(ValidationError);
    expect(await repo.getProject(1)).toEqual(p); // nothing was written
  });

  it("labels demo comments neutrally", async () => {
    const p = await repo.addComment(1, " Vu. ");
    expect(p.comments[p.comments.length - 1]).toMatchObject({ author: "Vous", text: "Vu.", at: REFERENCE_DATE });
  });
});

describe("restorePersisted", () => {
  const seed = () => ({ projects: buildSampleProjects(), team: buildSampleTeam() });

  it("migrates a v1 payload and derives the id counters", () => {
    const v1 = seed();
    v1.team = v1.team.slice(0, 3); // members 3..5 were deleted
    const s = restorePersisted(v1)!;
    expect(s.team.map((m) => m.id)).toEqual([0, 1, 2]);
    expect(s.projects).toHaveLength(25);
    expect(s.nextIds).toEqual({ project: 26, member: 3, subtask: expect.any(Number) });
  });

  it("keeps persisted counters that are ahead of the data (no reuse after delete)", () => {
    const s = restorePersisted({ version: STORAGE_VERSION, ...seed(), nextIds: { project: 40, member: 12, subtask: 500 } })!;
    expect(s.nextIds).toEqual({ project: 40, member: 12, subtask: 500 });
  });

  it("keeps an empty team instead of discarding every edit", () => {
    const data = seed();
    data.projects[0].name = "Renommé";
    const s = restorePersisted({ ...data, team: [] })!;
    expect(s.team).toEqual([]);
    expect(s.projects[0].name).toBe("Renommé");
  });

  it("drops only the invalid parts", () => {
    const data = seed() as { projects: unknown[]; team: unknown[] };
    const projects = data.projects as ReturnType<typeof buildSampleProjects>;
    projects[0].subtasks[1] = { ...projects[0].subtasks[1], start: "pas une date" };
    (projects[0].subtasks[2] as { plannedDays: number }).plannedDays = 2.6; // repaired
    projects[0].comments.push({ nope: true } as never);
    projects[1] = { ...projects[1], status: "inconnu" as never };
    data.team.push({ id: 9, name: "", initials: "X", color: "#000000", role: "" });
    const s = restorePersisted(data)!;
    expect(s.projects).toHaveLength(24);
    expect(s.projects.some((p) => p.id === 2)).toBe(false);
    const p1 = s.projects.find((p) => p.id === 1)!;
    expect(p1.subtasks.map((x) => x.id)).toEqual([1, 3, 4, 5]);
    expect(p1.subtasks.find((x) => x.id === 3)).toMatchObject({ plannedDays: 3, dependsOn: [] }); // dangling edge dropped
    expect(p1.comments.every((c) => typeof c.text === "string")).toBe(true);
    expect(s.team).toHaveLength(6);
  });

  it("returns null for unusable payloads (caller keeps the seed)", () => {
    expect(restorePersisted(null)).toBeNull();
    expect(restorePersisted("oops")).toBeNull();
    expect(restorePersisted([])).toBeNull();
    expect(restorePersisted({})).toBeNull();
    expect(restorePersisted({ version: 99, projects: [], team: [] })).toBeNull();
  });
});

describe("browser hydration", () => {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", { localStorage });
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  const load = async () => (await import("./sample-repository")).sampleRepository;

  it("migrates the legacy v1 key to the versioned one", async () => {
    const data = { projects: buildSampleProjects(), team: buildSampleTeam() };
    data.projects[0].name = "Édité";
    store.set("setec.sample.v1", JSON.stringify(data));
    const r = await load();
    expect((await r.getProject(1))!.name).toBe("Édité");
    expect(store.has("setec.sample.v1")).toBe(false);
    expect(JSON.parse(store.get("setec.sample")!)).toMatchObject({ version: STORAGE_VERSION, nextIds: { project: 26 } });
  });

  it("falls back to the seed on corrupt JSON without throwing", async () => {
    store.set("setec.sample", "{not json");
    const r = await load();
    expect(await r.listProjects()).toHaveLength(25);
    expect(JSON.parse(store.get("setec.sample")!).version).toBe(STORAGE_VERSION);
  });

  it("persists the counters so a reload never reuses an id", async () => {
    let r = await load();
    const t = await r.addTeamMember(MEMBER);
    const id = t[t.length - 1].id;
    await r.deleteTeamMember(id);
    vi.resetModules();
    r = await load();
    const t2 = await r.addTeamMember(MEMBER);
    expect(t2[t2.length - 1].id).toBe(id + 1);
  });
});
