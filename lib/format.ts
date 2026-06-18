// Pure formatting, date and working-day helpers.
//
// Relative date labels and the "today" highlight are anchored to a fixed
// reference date so the curated sample data reads exactly as designed. Change
// REFERENCE_DATE in one place to re-anchor everything.

export const REFERENCE_DATE = "2026-06-15";

/** True if an ISO date is the app's "today". One definition, used everywhere. */
export function isToday(iso: string): boolean {
  return iso === REFERENCE_DATE;
}

// French typographic spaces. NNBSP (U+202F) before % ? ! ; and the "j" unit and
// inside number groups; NBSP (U+00A0) before : and in date ranges/before €.
export const NNBSP = " ";
export const NBSP = " ";

export const WEEK_SHORT = `15${NBSP}–${NBSP}21 juin`;
export const WEEK_LABEL = "Semaine du 15 au 21 juin 2026";

export const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

export const MONTHS_FULL = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const MONS = [
  "JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN",
  "JUIL", "AOÛ", "SEP", "OCT", "NOV", "DÉC",
];

export const MONS_LONG = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function toDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const REFERENCE_TS = toDate(REFERENCE_DATE).getTime();

export function daysFromToday(iso: string): number {
  return Math.round((toDate(iso).getTime() - REFERENCE_TS) / 86_400_000);
}

export function fmtShort(iso: string): string {
  const d = toDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtFull(iso: string): string {
  const d = toDate(iso);
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

// Compact contexts (cells, chips) use "j"; prose (dueLabelFull) uses "jours".
export function dueLabel(days: number): string {
  if (days < 0) return `${-days}${NNBSP}j de retard`;
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  return `Dans ${days}${NNBSP}j`;
}

export function dueLabelFull(days: number): string {
  if (days < 0) return `${-days}${NNBSP}jours de retard`;
  if (days === 0) return "Aujourd’hui";
  return `Dans ${days}${NNBSP}jours`;
}

export function fmtBudget(k: number): string {
  if (!k) return "—";
  return k >= 1000
    ? `${(k / 1000).toFixed(1).replace(".", ",")}${NNBSP}M€`
    : `${k.toLocaleString("fr-FR")}${NNBSP}k€`;
}

// ----------------------------------------------------------- working days

export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

/** End date (ISO) of a task starting at `startIso` lasting `days` working days. */
export function taskEnd(startIso: string, days: number): string {
  const n = Math.max(1, Math.floor(days));
  const cur = toDate(startIso);
  let counted = 0;
  while (true) {
    if (isWeekday(cur)) {
      counted++;
      if (counted >= n) break;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return toISO(cur);
}

/** Start date (ISO) such that a `days`-working-day task ends on `endIso`. */
export function taskStartForEnd(endIso: string, days: number): string {
  const n = Math.max(1, Math.floor(days));
  const cur = toDate(endIso);
  let counted = 0;
  while (true) {
    if (isWeekday(cur)) {
      counted++;
      if (counted >= n) break;
    }
    cur.setDate(cur.getDate() - 1);
  }
  return toISO(cur);
}

/** Inclusive count of weekdays between two ISO dates. */
export function workingDaysBetween(aIso: string, bIso: string): number {
  const a = toDate(aIso);
  const b = toDate(bIso);
  if (a > b) return 0;
  let count = 0;
  const cur = new Date(a);
  while (cur <= b) {
    if (isWeekday(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Working days of [taskStart, taskEnd] that fall inside [pStart, pEnd]. */
export function overlapWorkingDays(
  taskStart: string,
  taskEndIso: string,
  pStart: string,
  pEnd: string,
): number {
  const s = taskStart > pStart ? taskStart : pStart;
  const e = taskEndIso < pEnd ? taskEndIso : pEnd;
  return workingDaysBetween(s, e);
}

export interface DateRange {
  start: string;
  end: string;
}

/** Monday–Sunday range containing the given date. */
export function weekRange(iso: string): DateRange {
  const d = toDate(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: toISO(mon), end: toISO(sun) };
}

export function monthRange(year: number, month: number): DateRange {
  return {
    start: toISO(new Date(year, month, 1)),
    end: toISO(new Date(year, month + 1, 0)),
  };
}

export function shiftISO(iso: string, days: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Monday–Sunday weeks overlapping a range, each clamped to the range. */
export function weeksInRange(range: DateRange): DateRange[] {
  const out: DateRange[] = [];
  let cur = weekRange(range.start).start; // Monday on/before range start
  for (let i = 0; i < 8 && cur <= range.end; i++) {
    const wEnd = weekRange(cur).end;
    out.push({
      start: cur < range.start ? range.start : cur,
      end: wEnd > range.end ? range.end : wEnd,
    });
    cur = shiftISO(wEnd, 1); // next Monday
  }
  return out;
}

/** Each weekday (Mon–Fri) within a range, as single-day buckets. */
export function weekdaysInRange(range: DateRange): DateRange[] {
  const out: DateRange[] = [];
  let cur = range.start;
  while (cur <= range.end) {
    if (isWeekday(toDate(cur))) out.push({ start: cur, end: cur });
    cur = shiftISO(cur, 1);
  }
  return out;
}
