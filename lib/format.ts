// Pure formatting + date helpers, ported from the design's renderVals().
//
// The design anchors every relative date label ("Dans 3 j", "Retard 2 j", the
// 7-day KPI, the calendar's "today" highlight) to a fixed reference date. We
// keep that single constant so the curated sample data reads exactly as designed.
// Change REFERENCE_DATE in one place to re-anchor everything.

export const REFERENCE_DATE = "2026-06-15";

/** Short relative descriptions of the current week, shown on the dashboard. */
export const WEEK_SHORT = "15 → 21 juin";
export const WEEK_LABEL = "Semaine du 15 au 21 juin 2026";

export const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

export const MONTHS_FULL = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Uppercase short months used by the Gantt + échéancier day cells. */
export const MONS = [
  "JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN",
  "JUIL", "AOÛ", "SEP", "OCT", "NOV", "DÉC",
];

export const MONS_LONG = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/** Week starting Monday, matching the calendar grid. */
export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Parse an ISO `yyyy-mm-dd` string as a local midnight Date. */
export function toDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

export const REFERENCE_TS = toDate(REFERENCE_DATE).getTime();

/** Whole-day difference between an ISO date and the reference "today". */
export function daysFromToday(iso: string): number {
  return Math.round((toDate(iso).getTime() - REFERENCE_TS) / 86_400_000);
}

/** "18 juin" */
export function fmtShort(iso: string): string {
  const d = toDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "18 juin 2026" */
export function fmtFull(iso: string): string {
  const d = toDate(iso);
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

/** Compact due label used in lists/tables. */
export function dueLabel(days: number): string {
  if (days < 0) return `Retard ${-days} j`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} j`;
}

/** Verbose due label used in the drawer. */
export function dueLabelFull(days: number): string {
  if (days < 0) return `Dépassée de ${-days} jours`;
  if (days === 0) return "Aujourd'hui";
  return `Dans ${days} jours`;
}

/** Fees in k€ → "4,2 M€" / "980 k€" / "—". */
export function fmtBudget(k: number): string {
  if (!k) return "—";
  return k >= 1000
    ? `${(k / 1000).toFixed(1).replace(".", ",")} M€`
    : `${k} k€`;
}
