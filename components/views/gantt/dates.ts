import { shiftISO, toDate, workingDaysBetween } from "@/lib/format";

// ── Calendar-day helpers (DST-proof: dates are built from y/m/d, never from
//    "start + i × 24h", which drifts an hour — or a day — across DST changes).
export const dayIndex = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const isWeekendISO = (iso: string) => { const g = toDate(iso).getDay(); return g === 0 || g === 6; };

/** Move to the nearest weekday in `dir` when `iso` falls on a weekend. */
export function snapWeekday(iso: string, dir: 1 | -1): string {
  let cur = iso;
  while (isWeekendISO(cur)) cur = shiftISO(cur, dir);
  return cur;
}

/** Shift by `n` WORKING days (Sat/Sun skipped). */
export function shiftWorkingDays(iso: string, n: number): string {
  const dir = n >= 0 ? 1 : -1;
  let cur = snapWeekday(iso, dir as 1 | -1);
  for (let left = Math.abs(n); left > 0; ) {
    cur = shiftISO(cur, dir);
    if (!isWeekendISO(cur)) left--;
  }
  return cur;
}

/** Signed number of working days from `from` to `to` (0 when equal). */
export function workingDayDelta(from: string, to: string): number {
  if (to === from) return 0;
  return to > from ? workingDaysBetween(shiftISO(from, 1), to) : -workingDaysBetween(shiftISO(to, 1), from);
}
