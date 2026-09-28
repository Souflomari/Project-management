import { describe, expect, it } from "vitest";

import {
  DEADLINE_BEFORE_START_MESSAGE,
  ValidationError,
  checkDependsOn,
  defaultDeadline,
  isIsoDate,
  parseCommentText,
  parseNewProject,
  parseNewSubtask,
  parseNewTeamMember,
  parsePhaseIndex,
  parseProjectPatch,
  parseStatus,
  parseSubtaskPatch,
  parseSubtaskRecord,
  parseTeamMemberPatch,
} from "./validation";
import { REFERENCE_DATE } from "./format";

/** The ValidationError message thrown by `fn`. */
function rejection(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    return (e as Error).message;
  }
  throw new Error("expected a ValidationError");
}

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-06-15")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate("15/06/2026")).toBe(false);
    expect(isIsoDate("2026-06-15T00:00:00Z")).toBe(false);
  });
});

describe("parseNewProject", () => {
  it("trims and applies defaults (start = REFERENCE_DATE, deadline = +1 year)", () => {
    const p = parseNewProject({ name: "  Viaduc  ", client: " ", responsableId: 2 });
    expect(p).toEqual({
      name: "Viaduc",
      client: "À définir",
      discipline: "À définir",
      responsableId: 2,
      budget: 0,
      phaseIndex: 0,
      start: REFERENCE_DATE,
      deadline: defaultDeadline(REFERENCE_DATE),
    });
    expect(defaultDeadline("2026-06-15")).toBe("2027-06-15");
  });

  it("keeps the dates and details the form collected", () => {
    const p = parseNewProject({
      name: "Tunnel", client: "SNCF", responsableId: 0, discipline: "Génie civil",
      budget: 320, phaseIndex: 2, start: "2026-09-01", deadline: "2027-03-31",
    });
    expect(p).toMatchObject({ start: "2026-09-01", deadline: "2027-03-31", budget: 320, phaseIndex: 2, discipline: "Génie civil" });
    expect(parseNewProject({ name: "X", client: "", responsableId: 0, start: "2026-09-01" }).deadline).toBe("2027-09-01");
  });

  it("rejects bad input with French messages", () => {
    expect(rejection(() => parseNewProject({ name: "   ", client: "", responsableId: 0 }))).toBe("L’intitulé du projet est requis.");
    expect(rejection(() => parseNewProject({ name: "x".repeat(201), client: "", responsableId: 0 }))).toMatch(/200 caractères/);
    expect(rejection(() => parseNewProject({ name: "X", client: "", responsableId: 0, start: "" }))).toMatch(/date requise/);
    expect(rejection(() => parseNewProject({ name: "X", client: "", responsableId: 0, start: "2026-02-30" }))).toMatch(/date invalide/);
    expect(
      rejection(() => parseNewProject({ name: "X", client: "", responsableId: 0, start: "2026-09-01", deadline: "2026-08-31" })),
    ).toBe(DEADLINE_BEFORE_START_MESSAGE);
    expect(rejection(() => parseNewProject({ name: "X", client: "", responsableId: 0, budget: -1 }))).toMatch(/négatifs/);
    expect(rejection(() => parseNewProject({ name: "X", client: "", responsableId: 0, budget: 1.5 }))).toMatch(/entier/);
    expect(rejection(() => parseNewProject({ name: "X", client: "", responsableId: 0, phaseIndex: 7 }))).toBe("Phase inconnue.");
    expect(rejection(() => parseNewProject({ name: "X", client: "", responsableId: "1" }))).toBe("Membre inconnu.");
  });
});

describe("parseProjectPatch", () => {
  const cur = { start: "2026-01-01", deadline: "2026-12-31" };

  it("checks the merged date order instead of clamping", () => {
    expect(parseProjectPatch({ deadline: "2026-06-30" }, cur)).toEqual({ deadline: "2026-06-30" });
    expect(rejection(() => parseProjectPatch({ deadline: "2025-12-31" }, cur))).toBe(DEADLINE_BEFORE_START_MESSAGE);
    expect(rejection(() => parseProjectPatch({ start: "2027-01-01" }, cur))).toBe(DEADLINE_BEFORE_START_MESSAGE);
    expect(rejection(() => parseProjectPatch({ start: "2026-05-01", deadline: "2026-04-01" }))).toBe(DEADLINE_BEFORE_START_MESSAGE);
    // Unrelated fields don't re-check stored dates.
    expect(parseProjectPatch({ name: "Nouveau" }, { start: "2026-02-01", deadline: "2026-01-01" })).toEqual({ name: "Nouveau" });
  });

  it("rejects empty text, empty dates and fractional budgets; strips unknown keys", () => {
    expect(rejection(() => parseProjectPatch({ name: "  " }))).toBe("L’intitulé du projet est requis.");
    expect(rejection(() => parseProjectPatch({ client: "" }))).toBe("Le maître d’ouvrage est requis.");
    expect(rejection(() => parseProjectPatch({ deadline: "" }, cur))).toMatch(/date requise/);
    expect(rejection(() => parseProjectPatch({ budget: 12.4 }))).toMatch(/entier/);
    expect(parseProjectPatch({ budget: 12, phaseIndex: 3, id: 99 } as never)).toEqual({ budget: 12 });
  });
});

describe("subtasks", () => {
  const siblings = [1, 2, 3];

  it("validates a new task and its dependencies", () => {
    expect(parseNewSubtask({ name: " Note ", assigneeId: 1, start: "2026-06-15", plannedDays: 3 }, siblings)).toEqual({
      name: "Note", assigneeId: 1, start: "2026-06-15", plannedDays: 3, dependsOn: [],
    });
    expect(parseNewSubtask({ name: "N", assigneeId: 1, start: "2026-06-15", plannedDays: 3, dependsOn: [2, 2] }, siblings).dependsOn).toEqual([2]);
    expect(rejection(() => parseNewSubtask({ name: "N", assigneeId: 1, start: "2026-06-15", plannedDays: 3, dependsOn: [9] }, siblings))).toMatch(
      /n’existe pas dans ce projet/,
    );
  });

  it("bounds plannedDays to an integer in 1..1000", () => {
    const base = { name: "N", assigneeId: 1, start: "2026-06-15" };
    expect(rejection(() => parseNewSubtask({ ...base, plannedDays: 0 }, siblings))).toMatch(/au moins 1 jour/);
    expect(rejection(() => parseNewSubtask({ ...base, plannedDays: 1001 }, siblings))).toMatch(/1000 jours/);
    expect(rejection(() => parseNewSubtask({ ...base, plannedDays: 2.5 }, siblings))).toMatch(/entier/);
    expect(rejection(() => parseNewSubtask({ ...base, plannedDays: Number.NaN }, siblings))).toMatch(/nombre de jours/);
  });

  it("refuses a self-dependency or an unknown predecessor in a patch", () => {
    expect(parseSubtaskPatch({ done: true }, siblings, 2)).toEqual({ done: true });
    expect(rejection(() => parseSubtaskPatch({ dependsOn: [2] }, siblings, 2))).toBe("Une tâche ne peut pas dépendre d’elle-même.");
    expect(rejection(() => parseSubtaskPatch({ dependsOn: [4] }, siblings, 2))).toMatch(/n’existe pas/);
    expect(rejection(() => parseSubtaskPatch({ start: "" }, siblings, 2))).toMatch(/date requise/);
    expect(() => checkDependsOn([1, 3], siblings, 2)).not.toThrow();
  });

  it("parses a whole task for an exact restore", () => {
    const task = { id: 3, name: "Visa", assigneeId: 0, start: "2026-06-15", plannedDays: 2, done: true, dependsOn: [1] };
    expect(parseSubtaskRecord(task, [1, 2])).toEqual(task);
    expect(rejection(() => parseSubtaskRecord({ ...task, dependsOn: [3] }, [1, 2]))).toMatch(/elle-même/);
  });
});

describe("team members", () => {
  it("validates name, initials, colour and daily rate", () => {
    const ok = { name: " Léa ", initials: "LÉ", color: "#4F5A63", role: "Ingénieure", costPerDay: 700 };
    expect(parseNewTeamMember(ok)).toEqual({ ...ok, name: "Léa" });
    expect(parseNewTeamMember({ ...ok, costPerDay: undefined }).costPerDay).toBeUndefined();
    expect(rejection(() => parseNewTeamMember({ ...ok, name: "" }))).toBe("Le nom est requis.");
    expect(rejection(() => parseNewTeamMember({ ...ok, color: "#4F5A6" }))).toMatch(/#RRGGBB/);
    expect(rejection(() => parseNewTeamMember({ ...ok, color: "red" }))).toMatch(/#RRGGBB/);
    expect(rejection(() => parseNewTeamMember({ ...ok, initials: "ABCDE" }))).toMatch(/4 initiales/);
    expect(rejection(() => parseNewTeamMember({ ...ok, costPerDay: -5 }))).toMatch(/négatif/);
  });

  it("strips keys the model doesn't carry (e.g. a UI-only fte)", () => {
    expect(parseTeamMemberPatch({ role: "Chef de projet", fte: 0.8 })).toEqual({ role: "Chef de projet" });
  });
});

describe("scalars", () => {
  it("rejects out-of-range phases, unknown statuses and empty comments", () => {
    expect(parsePhaseIndex(6)).toBe(6);
    expect(rejection(() => parsePhaseIndex(-1))).toBe("Phase inconnue.");
    expect(parseStatus("à risque")).toBe("à risque");
    expect(rejection(() => parseStatus("annulé"))).toBe("Statut inconnu.");
    expect(parseCommentText("  Bien reçu  ")).toBe("Bien reçu");
    expect(rejection(() => parseCommentText("   "))).toBe("Le commentaire est vide.");
  });
});
