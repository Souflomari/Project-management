import { afterEach, describe, expect, it, vi } from "vitest";

// Freeze the app clock (Monday 15 June 2026) before any module reads it.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_DEMO_DATE = "2026-06-15";
});

import {
  buildBudget,
  buildGantt,
  buildHistory,
  buildTaskEvents,
  buildTaskSpans,
  buildTeamLoad,
  computeCpm,
  computeKpis,
  deriveAll,
  deriveProject,
  portfolioHealth,
  recentRendus,
  workloadSummary,
  type DerivedProject,
} from "./derive";
import { buildSampleProjects, buildSampleTeam, DEMO_SHIFT_DAYS } from "./data/sample-data";
import { dayOfWeek, daysBetween, REFERENCE_DATE, shiftISO } from "./format";
import type { Project, Status, Subtask, TeamMember } from "./types";

// ------------------------------------------------------------------ fixtures

const TEAM: TeamMember[] = [
  { id: 0, name: "Arthur", initials: "AR", color: "#111", role: "Resp.", costPerDay: 1000 },
  { id: 1, name: "Paul", initials: "PL", color: "#222", role: "Ing.", costPerDay: 500 },
];

let seq = 0;
function task(p: Partial<Subtask> = {}): Subtask {
  return { id: ++seq, name: `T${seq}`, assigneeId: 0, start: "2026-06-15", plannedDays: 5, done: false, dependsOn: [], ...p };
}
function project(p: Partial<Project> = {}): Project {
  return {
    id: ++seq,
    name: `P${seq}`,
    client: "C",
    discipline: "D",
    responsableId: 0,
    phaseIndex: 0,
    status: "à jour",
    budget: 100,
    start: "2026-06-15",
    deadline: "2026-06-30",
    subtasks: [],
    comments: [],
    ...p,
  };
}
const derive = (ps: Project[]) => deriveAll(ps, TEAM);

/** Walk any value; fail on non-finite numbers and on "NaN"/"undefined" text. */
function assertClean(value: unknown, path = "$"): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${path} = ${value}`).toBe(true);
  } else if (typeof value === "string") {
    expect(/NaN|undefined|Infinity/.test(value), `${path} = "${value}"`).toBe(false);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertClean(v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertClean(v, `${path}.${k}`);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ------------------------------------------------------------ workload (#1)

describe("team workload — demand ÷ capacity", () => {
  const week = { start: "2026-06-15", end: "2026-06-21" };

  it("detects over-allocation: 3 parallel 5-day tasks in a 5-day week = 300 %", () => {
    const ps = derive([
      project({ subtasks: [task()] }),
      project({ subtasks: [task()] }),
      project({ subtasks: [task()] }),
    ]);
    const [arthur, paul] = buildTeamLoad(ps, TEAM, week, "day");
    expect(arthur.capacity).toBe(5);
    expect(arthur.allocDays).toBe(15);
    expect(arthur.periodDays).toBe(15);
    expect(arthur.chargeAllocPct).toBe(300);
    expect(arthur.chargePct).toBe(300);
    expect(arthur.costEur).toBe(15_000);
    expect(arthur.projectsActive).toBe(3);
    expect(arthur.projectSplit.map((s) => s.days)).toEqual([5, 5, 5]);
    expect(arthur.buckets).toHaveLength(5);
    for (const b of arthur.buckets) {
      expect(b.days).toBe(3);
      expect(b.pct).toBe(300);
      expect(b.allocPct).toBe(300);
      expect(b.projectSplit).toHaveLength(3);
    }
    expect(paul.chargeAllocPct).toBe(0);

    const summary = workloadSummary(ps, TEAM, week);
    expect(summary.overCapacityCount).toBe(1);
    expect(summary.members[0]).toMatchObject({ chargePct: 300, overCapacity: true });
    expect(summary.avgChargePct).toBe(150);
  });

  it("counts only the part of a task inside the window, and scales capacity by FTE", () => {
    // Wed 17 → Tue 23 June (5 working days): 3 of them fall in the week.
    const ps = derive([project({ subtasks: [task({ start: "2026-06-17" })] })]);
    const [full] = buildTeamLoad(ps, TEAM, week);
    expect(full.allocDays).toBe(3);
    expect(full.chargeAllocPct).toBe(60);
    const [half] = buildTeamLoad(ps, TEAM, week, "week", { 0: 2.5 });
    expect(half.capacityFte).toBe(2.5);
    expect(half.chargeAllocPct).toBe(120);
    expect(half.tasks[0].daysInPeriod).toBe(3);
  });

  it("delivered (done) work stops loading the calendar after today", () => {
    const ps = derive([project({ subtasks: [task({ start: "2026-06-12", plannedDays: 5, done: true })] })]);
    // Fri 12 → Thu 18; done → only Fri 12 and Mon 15 (today) still count.
    const [a] = buildTeamLoad(ps, TEAM, { start: "2026-06-08", end: "2026-06-21" });
    expect(a.allocDays).toBe(2);
    const [future] = buildTeamLoad(ps, TEAM, { start: "2026-06-16", end: "2026-06-21" });
    expect(future.allocDays).toBe(0);
    expect(future.tasks).toEqual([]);
  });

  it("gives meaningful (uncapped, finite) figures on the sample portfolio", () => {
    const team = buildSampleTeam();
    const ps = deriveAll(buildSampleProjects(), team);
    const loads = buildTeamLoad(ps, team, { start: "2026-06-15", end: "2026-07-12" });
    assertClean(loads);
    expect(Math.max(...loads.map((l) => l.chargeAllocPct))).toBeGreaterThan(100);
    for (const l of loads) expect(l.chargePct).toBe(l.chargeAllocPct);
  });
});

// --------------------------------------------------------- invalid dates (#2)

describe("empty / invalid dates", () => {
  it("never leak NaN into derived projects", () => {
    const [p] = derive([
      project({
        start: "",
        deadline: "garbage",
        subtasks: [task({ start: "" }), task({ start: "2026-02-30" })],
      }),
    ]);
    assertClean(p);
    expect(p.nextTask).toBeNull();
    expect(p.renduDaysLabel).toBe("Non planifié");
    expect(p.renduLabel).toBe("Tâches à planifier");
    expect(p.deadlineFull).toBe("—");
    expect(p.deadlineDaysLabel).toBe("—");
    expect(p.subtasksD.every((s) => !s.scheduled && s.end === "")).toBe(true);
    expect(p.totalDays).toBe(10); // unscheduled work still counts as effort
  });

  it("a single bad project never breaks the Gantt window", () => {
    const good = project({
      start: "2026-06-15",
      deadline: "2026-06-19",
      subtasks: [task({ start: "2026-06-15", plannedDays: 5 })],
    });
    const bad = project({ start: "", deadline: "", subtasks: [task({ start: "" }), task({ start: "not a date" })] });
    const g = buildGantt(derive([bad, good]));
    assertClean(g);
    expect(g.windowStart).toBe("2026-06-01");
    expect(g.spanDays).toBe(30);
    expect(g.months).toEqual([{ label: "JUIN", left: 0, width: 100 }]);
    expect(g.rows[0]).toMatchObject({ left: 0, width: 0 });
    expect(g.rows[0].subtasks.every((s) => !s.visible && s.width === 0)).toBe(true);
    expect(g.rows[1].width).toBeCloseTo((5 / 30) * 100, 10);
  });

  it("normalises full timestamps and keeps unscheduled tasks off calendars", () => {
    const [p] = derive([
      project({
        start: "2026-06-15T08:00:00+00:00",
        subtasks: [task({ start: "2026-06-15T08:00:00+00:00", plannedDays: 2 }), task({ start: "" })],
      }),
    ]);
    expect(p.start).toBe("2026-06-15");
    expect(p.subtasksD[0]).toMatchObject({ start: "2026-06-15", end: "2026-06-16", scheduled: true });
    expect(buildTaskEvents([p])).toHaveLength(1);
    expect(buildTaskSpans([p], { start: "2026-06-01", end: "2026-06-30" })).toHaveLength(1);
    assertClean(buildTeamLoad([p], TEAM, { start: "2026-06-01", end: "2026-06-30" }));
    assertClean(computeKpis([p]));
    assertClean(buildHistory([p]));
  });
});

// ---------------------------------------------------- Gantt geometry (#3/#4)

describe("Gantt geometry — inclusive ends", () => {
  const day = (g: { spanDays: number }, pct: number) => (pct * g.spanDays) / 100;

  it("a Mon–Fri task is 5 days wide and a 1-day task one day wide", () => {
    const g = buildGantt(
      derive([
        project({
          start: "2026-06-15",
          deadline: "2026-06-19",
          subtasks: [
            task({ id: 1, start: "2026-06-15", plannedDays: 5 }),
            task({ id: 2, start: "2026-06-22", plannedDays: 1, dependsOn: [1] }),
          ],
        }),
      ]),
    );
    const [row] = g.rows;
    const [week, single] = row.subtasks;
    expect(day(g, row.width)).toBeCloseTo(5, 10);
    expect(day(g, week.left)).toBeCloseTo(14, 10); // 15 June is day 14 of June
    expect(day(g, week.width)).toBeCloseTo(5, 10);
    expect(day(g, single.width)).toBeCloseTo(1, 10);
    // Arrow geometry: predecessor's right edge = end of Friday 19 (day 19).
    expect(day(g, week.left + week.width)).toBeCloseTo(19, 10);
    expect(day(g, g.todayLeft)).toBeCloseTo(14, 10);
  });

  it("float ghosts start exactly at the bar's right edge", () => {
    const g = buildGantt(
      derive([
        project({
          subtasks: [
            task({ id: 1, start: "2026-06-15", plannedDays: 2 }),
            task({ id: 2, start: "2026-06-15", plannedDays: 4 }),
            task({ id: 3, start: "2026-06-19", plannedDays: 1, dependsOn: [1, 2] }),
          ],
        }),
      ]),
    );
    const short = g.rows[0].subtasks[0];
    expect(short.float).toBe(2);
    // Ghost covers Wed 17 + Thu 18 (2 working days after the Tue 16 end).
    expect(day(g, short.floatWidth)).toBeCloseTo(2, 10);
    expect(g.rows[0].subtasks[1].floatWidth).toBe(0);
  });

  it("positions are whole days across DST changes (March and October 2026)", () => {
    for (const [start, deadline] of [["2026-03-02", "2026-04-24"], ["2026-10-05", "2026-11-27"]]) {
      const subtasks = Array.from({ length: 30 }, (_, i) => task({ start: shiftISO(start, i * 2), plannedDays: 1 + (i % 4) }));
      const g = buildGantt(derive([project({ start, deadline, subtasks })]));
      assertClean(g);
      for (const b of g.rows[0].subtasks) {
        const l = day(g, b.left);
        const w = day(g, b.width);
        expect(Math.abs(l - Math.round(l))).toBeLessThan(1e-9);
        expect(Math.abs(w - Math.round(w))).toBeLessThan(1e-9);
        expect(Math.round(l)).toBe(daysBetween(g.windowStart, b.start));
        expect(Math.round(w)).toBe(daysBetween(b.start, b.end) + 1);
      }
      const sumMonths = g.months.reduce((s, m) => s + m.width, 0);
      expect(sumMonths).toBeCloseTo(100, 9);
    }
  });

  it("history steps whole weeks across a DST change", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATE", "2026-04-08"); // history spans the 29 March change
    vi.resetModules();
    const d = await import("./derive");
    const h = d.buildHistory(d.deriveAll([project({ subtasks: [task({ start: "2026-03-02" })] })], TEAM));
    expect(h.map((x) => x.date)).toEqual([
      "2026-02-18", "2026-02-25", "2026-03-04", "2026-03-11",
      "2026-03-18", "2026-03-25", "2026-04-01", "2026-04-08",
    ]);
    const recent = d.recentRendus(
      d.deriveAll([project({ subtasks: [task({ start: "2026-04-02", plannedDays: 1, done: true })] })], TEAM),
      7,
    );
    expect(recent).toHaveLength(1);
    expect(recent[0].daysAgo).toBe(6);
  });
});

// ------------------------------------------------------ plannedDays (#6)

describe("plannedDays normalisation", () => {
  it("floors decimals and lifts 0 to 1 in progress, budget, end and CPM alike", () => {
    const raw = project({
      budget: 10,
      subtasks: [
        task({ id: 1, plannedDays: 2.9, done: true }),
        task({ id: 2, plannedDays: 0, dependsOn: [1] }),
        task({ id: 3, plannedDays: -4, assigneeId: 1, dependsOn: [2] }),
      ],
    });
    const p = deriveProject(raw, TEAM);
    expect(p.subtasksD.map((s) => s.plannedDays)).toEqual([2, 1, 1]);
    expect(p.subtasksD.map((s) => s.end)).toEqual(["2026-06-16", "2026-06-15", "2026-06-15"]);
    expect(p.totalDays).toBe(4);
    expect(p.doneDays).toBe(2);
    expect(p.progress).toBe(50);
    const b = buildBudget(raw, TEAM);
    expect(b.plannedCostEur).toBe(2 * 1000 + 1 * 1000 + 1 * 500);
    expect(b.earnedValueEur).toBe(2000);
    expect(b.spentPct).toBe(57);
  });
});

// -------------------------------------------------------------- CPM (#11)

describe("computeCpm", () => {
  it("computes float on a diamond", () => {
    const r = computeCpm([
      task({ id: 1, plannedDays: 2 }),
      task({ id: 2, plannedDays: 3, dependsOn: [1] }),
      task({ id: 3, plannedDays: 1, dependsOn: [1] }),
      task({ id: 4, plannedDays: 1, dependsOn: [2, 3] }),
    ]);
    expect([1, 2, 3, 4].map((id) => r.float.get(id))).toEqual([0, 0, 2, 0]);
    expect([1, 2, 3, 4].map((id) => r.critical.get(id))).toEqual([true, true, false, true]);
  });

  it("survives cycles, self-dependencies, dangling ids, duplicates and missing arrays", () => {
    const r = computeCpm([
      task({ id: 1, dependsOn: [1, 99] }), // self + dangling → treated as a root
      task({ id: 2, dependsOn: [3] }), // 2 ⇄ 3 cycle
      task({ id: 3, dependsOn: [2] }),
      task({ id: 4, dependsOn: [3, 1, 1] }), // fed by the cycle
      task({ id: 5, dependsOn: undefined as unknown as number[] }),
      task({ id: 5, dependsOn: [1] }), // duplicate id
    ]);
    expect(r.float.size).toBe(5);
    for (const id of [2, 3, 4]) {
      expect(r.float.get(id)).toBe(0);
      expect(r.critical.get(id)).toBe(false);
    }
    expect(r.critical.get(1)).toBe(true);
    expect(computeCpm([task({ id: 1, dependsOn: [2] }), task({ id: 2, dependsOn: [1] })]).critical.get(1)).toBe(false);
    expect(computeCpm([]).float.size).toBe(0);
  });

  it("is linear on long chains", () => {
    const n = 20_000;
    const chain = Array.from({ length: n }, (_, i) => task({ id: i + 1, plannedDays: 1, dependsOn: i ? [i] : [] }));
    const t0 = performance.now();
    const r = computeCpm(chain);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.critical.get(n)).toBe(true);
  });

  it("derives a project whose tasks form a cycle", () => {
    const [p] = derive([project({ subtasks: [task({ id: 1, dependsOn: [2] }), task({ id: 2, dependsOn: [1] })] })]);
    assertClean(buildGantt([p]));
  });
});

// -------------------------------------------------------- KPIs & history (#7)

describe("dashboard KPIs", () => {
  const team = buildSampleTeam();
  const sample = () => deriveAll(buildSampleProjects(), team);

  it("the last history point IS the KPI (same basis for value and delta)", () => {
    const all = sample();
    const k = computeKpis(all);
    const h = buildHistory(all);
    const last = h[h.length - 1];
    expect(last.date).toBe(REFERENCE_DATE);
    expect(last).toMatchObject({ avg: k.avg, late: k.late, active: k.active, rendus: k.rendus });
    expect(k.late).toBe(all.filter((p) => p.status === "en retard").length);
    expect(k.active).toBe(all.filter((p) => p.status !== "terminé").length);
    expect(k.avg).toBe(Math.round(all.reduce((s, p) => s + p.progress, 0) / all.length));
    for (let i = 1; i < h.length; i++) {
      expect(daysBetween(h[i - 1].date, h[i].date)).toBe(7);
      expect(h[i].avg).toBeGreaterThanOrEqual(h[i - 1].avg); // done work never un-happens
    }
  });

  it("history reconstructs lateness from the schedule, from today at the latest", () => {
    const mk = (status: Status, subtasks: Subtask[], deadline = "2026-07-30") => project({ status, deadline, subtasks });
    const all = derive([
      mk("en retard", [task({ start: "2026-06-01", plannedDays: 2 })]), // open since 3 June → late from 3 June
      mk("en retard", [task({ start: "2026-06-22" })]), // declared late, no evidence → today only
      mk("à jour", [task({ start: "2026-05-01" })]), // overdue but not declared late → not counted
    ]);
    const h = buildHistory(all);
    expect(h.map((x) => x.late)).toEqual([0, 0, 0, 0, 0, 0, 1, 2]);
    expect(computeKpis(all).late).toBe(2);
  });

  it("health bands 75 / 55 exclude archived work", () => {
    const withStatuses = (s: Status[]) => derive(s.map((status) => project({ status })));
    expect(portfolioHealth(withStatuses(["à jour", "à jour", "à jour", "à risque"]))).toMatchObject({ score: 88, band: "sain" });
    expect(portfolioHealth(withStatuses(["à jour", "à risque"]))).toMatchObject({ score: 75, band: "sain" });
    expect(portfolioHealth(withStatuses(["à jour", "à risque", "à risque", "en retard", "terminé"]))).toMatchObject({ score: 50, band: "critique", activeTotal: 4 });
    expect(portfolioHealth(withStatuses(["à risque", "à risque", "à jour", "à jour", "à risque", "en retard"]))).toMatchObject({ score: 58, band: "fragile" });
    expect(portfolioHealth(withStatuses(["terminé"]))).toMatchObject({ empty: true, score: 100 });
  });

  it("recent rendus cover today and the 6 previous days", () => {
    const done = (end: string) => task({ start: end, plannedDays: 1, done: true });
    const all = derive([project({ subtasks: [done("2026-06-15"), done("2026-06-09"), done("2026-06-08"), done("2026-06-16")] })]);
    const r = recentRendus(all, 7);
    expect(r.map((x) => [x.date, x.daysAgo])).toEqual([["2026-06-15", 0], ["2026-06-09", 6]]);
  });
});

// ------------------------------------------------------- sample data (#5)

describe("sample data time-shift", () => {
  const plain = (ps: Project[]) => ps.map((p) => ({ ...p, comments: p.comments.map((c) => ({ ...c, when: "" })) }));

  it("is unshifted at the anchor week", () => {
    expect(REFERENCE_DATE).toBe("2026-06-15");
    expect(DEMO_SHIFT_DAYS).toBe(0);
    expect(buildSampleProjects()[0].start).toBe("2025-03-01");
  });

  it("shifts every date by whole weeks to the current week, weekdays intact", async () => {
    const anchorProjects = plain(buildSampleProjects());
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATE", "2026-10-01"); // a Thursday; its Monday is 28 Sept
    vi.resetModules();
    const s = await import("./data/sample-data");
    const d = await import("./derive");
    expect(s.DEMO_SHIFT_DAYS).toBe(105);
    const shifted = plain(s.buildSampleProjects());
    expect(shifted).toHaveLength(anchorProjects.length);
    shifted.forEach((p, i) => {
      const a = anchorProjects[i];
      expect(daysBetween(a.start, p.start)).toBe(105);
      expect(daysBetween(a.deadline, p.deadline)).toBe(105);
      expect(dayOfWeek(p.start)).toBe(dayOfWeek(a.start));
      p.comments.forEach((c, j) => expect(daysBetween(a.comments[j].at!, c.at!)).toBe(105));
      p.subtasks.forEach((t, j) => {
        expect(daysBetween(a.subtasks[j].start, t.start)).toBe(105);
        expect(t.plannedDays).toBe(a.subtasks[j].plannedDays);
      });
    });
    // Relative to "today" the portfolio still reads like the designed demo.
    const all = d.deriveAll(s.buildSampleProjects(), s.buildSampleTeam());
    const kpis = d.computeKpis(all);
    expect(kpis.late).toBe(2);
    expect(kpis.active).toBe(23);
    assertClean(d.buildGantt(all));
  });
});

describe("sample portfolio", () => {
  it("derives without NaN anywhere", () => {
    const all: DerivedProject[] = deriveAll(buildSampleProjects(), buildSampleTeam());
    assertClean(all);
    assertClean(buildGantt(all));
    assertClean(buildHistory(all));
  });
});
