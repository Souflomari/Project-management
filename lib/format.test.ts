import { afterEach, describe, expect, it, vi } from "vitest";

// Freeze the app clock BEFORE format.ts is evaluated (REFERENCE_DATE is read at
// module load). Tests never depend on the real date.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_DEMO_DATE = "2026-06-15";
});

import {
  dayOfWeek,
  daysBetween,
  daysFromToday,
  dueLabel,
  dueLabelFull,
  eachDayISO,
  effortDays,
  epochDay,
  fmtBudget,
  fmtEur,
  fmtFull,
  fmtShort,
  fromEpochDay,
  isValidISODate,
  NBSP,
  NNBSP,
  REFERENCE_DATE,
  relativeWhen,
  shiftISO,
  taskEnd,
  taskStartForEnd,
  toDate,
  toISO,
  toISODate,
  WEEK_LABEL,
  WEEK_SHORT,
  weekdaysInRange,
  weekLongLabel,
  weekRange,
  weekShortLabel,
  weeksInRange,
  workingDaysBetween,
} from "./format";

// ---- reference implementations: the pre-audit day-by-day loops ----------------

function isWd(d: Date) {
  return d.getDay() !== 0 && d.getDay() !== 6;
}
function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function oldTaskEnd(startIso: string, days: number): string {
  const n = Math.max(1, Math.floor(days));
  const cur = new Date(startIso + "T00:00:00");
  let counted = 0;
  while (true) {
    if (isWd(cur)) { counted++; if (counted >= n) break; }
    cur.setDate(cur.getDate() + 1);
  }
  return localISO(cur);
}
function oldTaskStartForEnd(endIso: string, days: number): string {
  const n = Math.max(1, Math.floor(days));
  const cur = new Date(endIso + "T00:00:00");
  let counted = 0;
  while (true) {
    if (isWd(cur)) { counted++; if (counted >= n) break; }
    cur.setDate(cur.getDate() - 1);
  }
  return localISO(cur);
}
function oldWorkingDaysBetween(a: string, b: string): number {
  const cur = new Date(a + "T00:00:00");
  const end = new Date(b + "T00:00:00");
  let count = 0;
  while (cur <= end) { if (isWd(cur)) count++; cur.setDate(cur.getDate() + 1); }
  return count;
}

/** Deterministic PRNG (mulberry32) so "random" inputs are reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ----------------------------------------------------------------- the clock

describe("REFERENCE_DATE", () => {
  it("honours the NEXT_PUBLIC_DEMO_DATE override", () => {
    expect(REFERENCE_DATE).toBe("2026-06-15");
    expect(daysFromToday("2026-06-18")).toBe(3);
  });

  it("re-evaluates from the env on module load", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATE", "2026-09-30");
    vi.resetModules();
    const f = await import("./format");
    expect(f.REFERENCE_DATE).toBe("2026-09-30");
    expect(f.isToday("2026-09-30")).toBe(true);
    expect(f.WEEK_LABEL).toBe("Semaine du 28 septembre au 4 octobre 2026");
  });

  it("falls back to today's date in Europe/Paris (not the server's UTC date)", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATE", "");
    const prevTz = process.env.TZ;
    process.env.TZ = "UTC"; // the server runs in UTC
    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      // 22:30 UTC on the 27th is already 00:30 on the 28th in Paris (CEST).
      vi.setSystemTime(new Date("2026-09-27T22:30:00Z"));
      vi.resetModules();
      const f = await import("./format");
      expect(f.REFERENCE_DATE).toBe("2026-09-28");
    } finally {
      process.env.TZ = prevTz;
    }
  });

  it("ignores an invalid override", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_DATE", "2026-02-30");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    vi.resetModules();
    const f = await import("./format");
    expect(f.REFERENCE_DATE).toBe("2026-01-10");
  });

  it("derives the week labels from the clock", () => {
    expect(WEEK_LABEL).toBe("Semaine du 15 au 21 juin 2026");
    expect(WEEK_SHORT).toBe(`15${NBSP}–${NBSP}21 juin`);
    expect(weekShortLabel("2026-09-30")).toBe(`28 sept.${NBSP}–${NBSP}4 oct.`);
    expect(weekLongLabel("2026-12-30")).toBe("Semaine du 28 décembre 2026 au 3 janvier 2027");
    expect(weekLongLabel("")).toBe("—");
  });
});

// ------------------------------------------------------------ date parsing

describe("date parsing", () => {
  it("validates strict ISO calendar dates", () => {
    expect(isValidISODate("2026-06-15")).toBe(true);
    expect(isValidISODate("2028-02-29")).toBe(true);
    for (const bad of ["", " ", "2026-02-30", "2026-13-01", "2026-6-15", "15/06/2026", "2026-09-28T10:12:00+00:00", null, undefined, 42]) {
      expect(isValidISODate(bad)).toBe(false);
    }
  });

  it("accepts full ISO / Postgres timestamps, dated in Europe/Paris", () => {
    expect(toISODate("2026-09-28T10:12:00+00:00")).toBe("2026-09-28");
    expect(toISODate("2026-09-28 10:12:00.123456+00")).toBe("2026-09-28");
    expect(toISODate("2026-09-28T23:30:00Z")).toBe("2026-09-29"); // 01:30 in Paris
    expect(toISODate("2026-01-15T23:30:00+0000")).toBe("2026-01-16"); // CET, +1
    expect(toISODate("2026-09-28T23:30:00")).toBe("2026-09-28"); // floating: own date
    expect(toISODate("2026-09-28T10:12:00.5-05:00")).toBe("2026-09-28");
    expect(toISODate("2026-02-30T10:00:00Z")).toBeNull();
    expect(toISODate("nope")).toBeNull();
  });

  it("toDate: local midnight, or an Invalid Date — never a shifted date", () => {
    const d = toDate("2026-10-25");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 25, 0]);
    expect(toISO(toDate("2026-09-28T10:12:00+00:00"))).toBe("2026-09-28");
    expect(Number.isNaN(toDate("").getTime())).toBe(true);
    expect(toISO(toDate(""))).toBe("");
  });

  it("formatters degrade to an em dash instead of NaN/undefined", () => {
    expect(fmtShort("")).toBe("—");
    expect(fmtFull("junk")).toBe("—");
    expect(dueLabel(daysFromToday(""))).toBe("—");
    expect(dueLabelFull(NaN)).toBe("—");
    expect(relativeWhen("")).toBe("—");
    expect(shiftISO("", 3)).toBe("");
    expect(fmtShort("2026-06-15")).toBe("15 juin");
    expect(fmtFull("2026-06-15")).toBe("15 juin 2026");
  });
});

// --------------------------------------------------------------- relativeWhen

describe("relativeWhen", () => {
  it("labels dates and full timestamps against the clock", () => {
    expect(relativeWhen("2026-06-15")).toBe("à l’instant");
    expect(relativeWhen("2026-06-20")).toBe("à l’instant");
    expect(relativeWhen("2026-06-14")).toBe("hier");
    expect(relativeWhen("2026-06-13T10:12:00+00:00")).toBe(`il y a 2${NNBSP}j`);
    expect(relativeWhen("2026-06-01")).toBe(`il y a 2${NNBSP}sem.`);
    expect(relativeWhen("2026-03-15")).toBe(`il y a 3${NNBSP}mois`);
  });

  it("pluralises years from the rounded value", () => {
    expect(relativeWhen("2025-06-15")).toBe(`il y a 1${NNBSP}an`);
    // 700 days rounds to 2 years: "2 ans" (was "2 an").
    expect(relativeWhen(shiftISO("2026-06-15", -700))).toBe(`il y a 2${NNBSP}ans`);
    expect(relativeWhen("2023-06-15")).toBe(`il y a 3${NNBSP}ans`);
  });
});

// -------------------------------------------------------------------- money

describe("fmtEur / fmtBudget", () => {
  const n = (x: number) => x.toLocaleString("fr-FR");

  it("chooses the unit after rounding", () => {
    expect(fmtEur(999_960)).toBe(`1,0${NNBSP}M€`);
    expect(fmtEur(999_949)).toBe(`999,9${NNBSP}k€`);
    expect(fmtEur(999.6)).toBe(`${n(1000)}${NNBSP}€`);
    expect(fmtEur(1000)).toBe(`1,0${NNBSP}k€`);
    expect(fmtEur(184_500)).toBe(`184,5${NNBSP}k€`);
    expect(fmtEur(1_250_000)).toBe(`1,3${NNBSP}M€`);
    expect(fmtEur(0)).toBe(`0${NNBSP}€`);
  });

  it("never prints a negative zero", () => {
    expect(fmtEur(-0.4)).toBe(`0${NNBSP}€`);
    expect(fmtEur(-0)).toBe(`0${NNBSP}€`);
    expect(fmtEur(-0.6)).toBe(`−1${NNBSP}€`);
    expect(fmtEur(-184_500)).toBe(`−184,5${NNBSP}k€`);
    expect(fmtEur(-999_960)).toBe(`−1,0${NNBSP}M€`);
  });

  it("guards non-finite input", () => {
    expect(fmtEur(NaN)).toBe("—");
    expect(fmtEur(Infinity)).toBe("—");
    expect(fmtBudget(NaN)).toBe("—");
    expect(fmtBudget(0)).toBe("—");
    expect(fmtBudget(1500)).toBe(`1,5${NNBSP}M€`);
  });
});

// --------------------------------------------------------- DST-safe arithmetic

describe("calendar-day arithmetic across DST", () => {
  // Europe/Paris: summer time starts Sun 29 March 2026, ends Sun 25 October 2026.
  it("shifts by whole days over both transitions", () => {
    expect(shiftISO("2026-03-28", 1)).toBe("2026-03-29");
    expect(shiftISO("2026-03-29", 1)).toBe("2026-03-30");
    expect(shiftISO("2026-03-27", 7)).toBe("2026-04-03");
    expect(shiftISO("2026-10-24", 1)).toBe("2026-10-25");
    expect(shiftISO("2026-10-25", 1)).toBe("2026-10-26");
    expect(shiftISO("2026-10-30", -7)).toBe("2026-10-23");
    expect(shiftISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-03-28", "2026-03-31")).toBe(3);
    expect(daysBetween("2026-10-31", "2026-10-24")).toBe(-7);
  });

  it("iterates each calendar day exactly once", () => {
    const march = eachDayISO("2026-03-25", "2026-04-02");
    expect(march).toEqual([
      "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29",
      "2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02",
    ]);
    const oct = eachDayISO("2026-10-20", "2026-10-31");
    expect(oct).toHaveLength(12);
    expect(new Set(oct).size).toBe(12);
    expect(eachDayISO("2026-10-31", "2026-10-20")).toEqual([]);
    expect(eachDayISO("", "2026-10-20")).toEqual([]);
  });

  it("round-trips epoch days and weekdays", () => {
    expect(fromEpochDay(epochDay("2026-10-25"))).toBe("2026-10-25");
    expect(dayOfWeek("2026-06-15")).toBe(0); // Monday
    expect(dayOfWeek("2026-10-25")).toBe(6); // Sunday
    expect(Number.isNaN(epochDay(""))).toBe(true);
  });

  it("task ends skip the weekend on DST weekends", () => {
    expect(taskEnd("2026-03-27", 2)).toBe("2026-03-30");
    expect(taskEnd("2026-10-23", 2)).toBe("2026-10-26");
    expect(taskStartForEnd("2026-03-30", 2)).toBe("2026-03-27");
    expect(workingDaysBetween("2026-10-19", "2026-11-01")).toBe(10);
  });

  it("builds week buckets across DST", () => {
    expect(weekRange("2026-03-29")).toEqual({ start: "2026-03-23", end: "2026-03-29" });
    expect(weekRange("2026-10-26")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(weeksInRange({ start: "2026-10-01", end: "2026-10-31" }).map((w) => w.start)).toEqual([
      "2026-10-01", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26",
    ]);
    expect(weekdaysInRange({ start: "2026-10-23", end: "2026-10-27" }).map((w) => w.start)).toEqual([
      "2026-10-23", "2026-10-26", "2026-10-27",
    ]);
  });

  it("never loops on invalid ranges", () => {
    expect(weeksInRange({ start: "", end: "" })).toEqual([]);
    expect(weekdaysInRange({ start: "", end: "" })).toEqual([]);
    expect(weekdaysInRange({ start: "2026-06-20", end: "2026-06-10" })).toEqual([]);
    expect(weekRange("")).toEqual({ start: "", end: "" });
  });
});

// --------------------------------------------------------------- working days

describe("working-day helpers", () => {
  it("normalise effort the one way: whole days, min 1", () => {
    expect(effortDays(5)).toBe(5);
    expect(effortDays(2.9)).toBe(2);
    expect(effortDays(0.4)).toBe(1);
    expect(effortDays(0)).toBe(1);
    expect(effortDays(-3)).toBe(1);
    expect(effortDays(NaN)).toBe(1);
  });

  it("match the old day-by-day loops on random inputs", () => {
    const rand = rng(20260615);
    const base = epochDay("2024-01-01");
    for (let i = 0; i < 3000; i++) {
      const start = fromEpochDay(base + Math.floor(rand() * 5 * 365)); // 2024–2028, weekends included
      const days = [0, 1, 2.5, -2][i % 4] + Math.floor(rand() * 400);
      expect(taskEnd(start, days)).toBe(oldTaskEnd(start, days));
      expect(taskStartForEnd(start, days)).toBe(oldTaskStartForEnd(start, days));
      const other = shiftISO(start, Math.floor(rand() * 200) - 20);
      expect(workingDaysBetween(start, other)).toBe(oldWorkingDaysBetween(start, other));
    }
  });

  it("taskEnd is O(1): huge efforts are instant and exact", () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) taskEnd("2026-06-15", 1e7); // the old loop took ~4 s for ONE call
    expect(performance.now() - t0).toBeLessThan(200);
    // 1e6 working days ≈ year 5859 — still a 4-digit ISO year, so it round-trips.
    const end = taskEnd("2026-06-15", 1e6);
    expect(taskStartForEnd(end, 1e6)).toBe("2026-06-15");
    expect(workingDaysBetween("2026-06-15", end)).toBe(1e6);
    expect(dayOfWeek(end)).toBeLessThan(5);
  });

  it("inclusive ends: Mon + 5 working days ends Friday; weekend start → Monday", () => {
    expect(taskEnd("2026-06-15", 5)).toBe("2026-06-19");
    expect(taskEnd("2026-06-15", 1)).toBe("2026-06-15");
    expect(taskEnd("2026-06-13", 1)).toBe("2026-06-15");
    expect(taskEnd("2026-06-15", 6)).toBe("2026-06-22");
    expect(taskEnd("2026-06-15", 0)).toBe("2026-06-15");
    expect(taskEnd("2026-06-15", 2.9)).toBe("2026-06-16");
    expect(taskEnd("", 3)).toBe("");
    expect(workingDaysBetween("2026-06-15", "2026-06-19")).toBe(5);
    expect(workingDaysBetween("", "2026-06-19")).toBe(0);
  });
});
