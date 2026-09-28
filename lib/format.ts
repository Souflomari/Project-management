// Pure formatting, date and working-day helpers.
//
// Dates travel through the app as ISO calendar dates ("yyyy-mm-dd"). All
// calendar arithmetic below works on whole *calendar days* (epoch-day numbers
// computed in UTC), never on millisecond offsets between local midnights — so a
// daylight-saving change (late March / late October in Europe/Paris) can never
// shift a date by a day or produce a 23/25-hour "day".
//
// "Today" (REFERENCE_DATE) is the real current date in Europe/Paris, evaluated
// when the module loads. Set NEXT_PUBLIC_DEMO_DATE=yyyy-mm-dd to freeze it (for
// deterministic demos, screenshots and tests).

// French typographic spaces. NNBSP (U+202F) before % ? ! ; and the "j" unit and
// inside number groups; NBSP (U+00A0) before : and in date ranges/before €.
export const NNBSP = " ";
export const NBSP = " ";

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

// ------------------------------------------------------------ date parsing

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// "2026-09-28T10:12:00+00:00", "2026-09-28 10:12:00.123456+00" (Postgres), "…Z",
// or a floating local timestamp without an offset.
const STAMP_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

let parisFmt: Intl.DateTimeFormat | null = null;

/** The calendar date (ISO) of an instant, as seen in Europe/Paris. */
function parisISO(instant: Date): string {
  parisFmt ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = parisFmt.formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Strict check: a real calendar date written exactly as "yyyy-mm-dd". Rejects
 *  "", timestamps, and impossible dates such as "2026-02-30". */
export function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = DATE_RE.exec(s);
  return !!m && isRealDate(+m[1], +m[2], +m[3]);
}

/** Normalise a date-like string to an ISO calendar date ("yyyy-mm-dd"), or
 *  `null` when it isn't one. Accepts plain dates and full ISO/Postgres
 *  timestamps; a timestamp carrying an offset ("…+00:00", "…Z") resolves to its
 *  calendar date in Europe/Paris (so a comment posted at 23:30 UTC is dated the
 *  next day, as a Paris user saw it). */
export function toISODate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim();
  if (isValidISODate(v)) return v;
  const m = STAMP_RE.exec(v);
  if (!m || !isRealDate(+m[1], +m[2], +m[3])) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[8]) return date; // floating timestamp — its own calendar date
  let off = m[8].toUpperCase();
  if (off !== "Z") off = off.length === 3 ? `${off}:00` : off.length === 5 ? `${off.slice(0, 3)}:${off.slice(3)}` : off;
  const ms = (m[7] ?? "0").padEnd(3, "0").slice(0, 3);
  const instant = new Date(`${date}T${m[4]}:${m[5]}:${m[6] ?? "00"}.${ms}${off}`);
  return Number.isNaN(instant.getTime()) ? null : parisISO(instant);
}

/** Local-midnight Date for an ISO date (or timestamp — see `toISODate`). An
 *  invalid input yields an Invalid Date (check with `isNaN(d.getTime())`). */
export function toDate(iso: string): Date {
  const n = toISODate(iso);
  if (!n) return new Date(NaN);
  const [y, m, d] = n.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** ISO date of a Date's local calendar day; "" for an Invalid Date. */
export function toISO(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ------------------------------------------------ DST-safe day arithmetic

/** Day number of an ISO date (days since 1970-01-01, computed in UTC so it is
 *  immune to DST). NaN when the input isn't a date. */
export function epochDay(iso: string): number {
  const m = DATE_RE.exec(iso);
  if (m && isRealDate(+m[1], +m[2], +m[3])) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS;
  const n = toISODate(iso);
  return n ? epochDay(n) : NaN;
}

/** Inverse of `epochDay`. */
export function fromEpochDay(n: number): string {
  if (!Number.isFinite(n)) return "";
  const d = new Date(Math.round(n) * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Signed number of calendar days from `aIso` to `bIso` (NaN if either is invalid). */
export function daysBetween(aIso: string, bIso: string): number {
  return epochDay(bIso) - epochDay(aIso);
}

/** Day of week, Monday = 0 … Sunday = 6 (1970-01-01 was a Thursday). */
function dowOf(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

/** ISO date shifted by whole calendar days (DST-safe). "" for an invalid date. */
export function shiftISO(iso: string, days: number): string {
  const d = epochDay(iso);
  return Number.isNaN(d) ? "" : fromEpochDay(d + Math.trunc(days));
}

/** Monday-based weekday index (Mon = 0 … Sun = 6) of an ISO date, NaN if invalid. */
export function dayOfWeek(iso: string): number {
  const d = epochDay(iso);
  return Number.isNaN(d) ? NaN : dowOf(d);
}

/** Every calendar day of [startIso, endIso] (inclusive), DST-safe. Empty when
 *  either bound is invalid or the range is reversed. Use this (not `+ 86400000`
 *  steps) to iterate days in grids/axes. */
export function eachDayISO(startIso: string, endIso: string): string[] {
  const a = epochDay(startIso);
  const b = epochDay(endIso);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return [];
  const out: string[] = [];
  for (let d = a; d <= b; d++) out.push(fromEpochDay(d));
  return out;
}

// ---------------------------------------------------------- the app clock

function resolveReferenceDate(): string {
  const demo = process.env.NEXT_PUBLIC_DEMO_DATE?.trim();
  if (demo && isValidISODate(demo)) return demo;
  return parisISO(new Date());
}

/** The app's "today" — the current date in Europe/Paris (the server runs in UTC,
 *  so it's computed with an explicit time zone and SSR/CSR agree), or
 *  NEXT_PUBLIC_DEMO_DATE when set. Evaluated once per module load. */
export const REFERENCE_DATE: string = resolveReferenceDate();

/** Local-midnight timestamp of REFERENCE_DATE. */
export const REFERENCE_TS = toDate(REFERENCE_DATE).getTime();

/** True if an ISO date is the app's "today". One definition, used everywhere. */
export function isToday(iso: string): boolean {
  return iso === REFERENCE_DATE;
}

/** Compact label of the Monday–Sunday week containing `iso`: "15 – 21 juin",
 *  or "28 sept. – 4 oct." across a month boundary. */
export function weekShortLabel(iso: string): string {
  const { start, end } = weekRange(iso);
  if (!start) return "—";
  const a = toDate(start);
  const b = toDate(end);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}${NBSP}–${NBSP}${b.getDate()} ${MONTHS_FULL[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]}${NBSP}–${NBSP}${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** Prose label of the week containing `iso`: "Semaine du 15 au 21 juin 2026". */
export function weekLongLabel(iso: string): string {
  const { start, end } = weekRange(iso);
  if (!start) return "—";
  const a = toDate(start);
  const b = toDate(end);
  const from =
    a.getFullYear() !== b.getFullYear()
      ? `${a.getDate()} ${MONTHS_FULL[a.getMonth()]} ${a.getFullYear()}`
      : a.getMonth() !== b.getMonth()
        ? `${a.getDate()} ${MONTHS_FULL[a.getMonth()]}`
        : `${a.getDate()}`;
  return `Semaine du ${from} au ${b.getDate()} ${MONTHS_FULL[b.getMonth()]} ${b.getFullYear()}`;
}

/** The current week (from REFERENCE_DATE), short and long forms. */
export const WEEK_SHORT = weekShortLabel(REFERENCE_DATE);
export const WEEK_LABEL = weekLongLabel(REFERENCE_DATE);

/** Signed calendar days from today to `iso` (NaN if invalid). */
export function daysFromToday(iso: string): number {
  return daysBetween(REFERENCE_DATE, iso);
}

/** Relative posting label computed from the app clock (REFERENCE_DATE), so a
 *  comment's timestamp reflects how long ago it was posted instead of a frozen
 *  "à l'instant" string. Accepts dates and full timestamps. Future/now →
 *  "à l'instant"; unparseable → "—". */
export function relativeWhen(iso: string): string {
  const days = daysBetween(iso, REFERENCE_DATE);
  if (Number.isNaN(days)) return "—";
  if (days <= 0) return "à l’instant";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days}${NNBSP}j`;
  if (days < 31) return `il y a ${Math.round(days / 7)}${NNBSP}sem.`;
  if (days < 365) return `il y a ${Math.round(days / 30)}${NNBSP}mois`;
  const years = Math.round(days / 365);
  return `il y a ${years}${NNBSP}an${years >= 2 ? "s" : ""}`;
}

export function fmtShort(iso: string): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtFull(iso: string): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

// French plural agreement: singular for 0 and 1, plural for ≥2.
// `1 jour`, `2 jours`; `1 semaine`, `2 semaines`.
function plural(n: number, singular: string): string {
  return Math.abs(n) >= 2 ? `${singular}s` : singular;
}

/** A count followed by a unit, with a NNBSP and correct French pluralization,
 *  e.g. `formatUnit(1, "jour")` → "1 jour", `formatUnit(3, "jour")` → "3 jours". */
export function formatUnit(n: number, singular: string): string {
  return `${n}${NNBSP}${plural(n, singular)}`;
}

/** A working-day count with the long "jour(s)" unit, e.g. 1 → "1 jour". */
export function formatDays(n: number): string {
  return formatUnit(n, "jour");
}

/** A percentage with the French NNBSP before "%", e.g. 42 → "42 %". The one
 *  helper other code should converge on so "%" spacing is uniform. */
export function pct(n: number): string {
  return `${n}${NNBSP}%`;
}

/** A label followed by a French colon with the required NBSP before it, e.g.
 *  `nbspColon("Statut")` → "Statut :". Converge on this so the ` :` is uniform. */
export function nbspColon(label: string): string {
  return `${label}${NBSP}:`;
}

/** French guillemets with the inner NNBSP both sides, e.g.
 *  `quote("texte")` → "« texte »". */
export function quote(inner: string): string {
  return `«${NNBSP}${inner}${NNBSP}»`;
}

/** A date range with an NBSP-padded en-dash between the two formatted dates,
 *  e.g. "15 juin – 21 juin". Pass `full` to use long month names. */
export function dateRange(startIso: string, endIso: string, full = false): string {
  const fmt = full ? fmtFull : fmtShort;
  return `${fmt(startIso)}${NBSP}–${NBSP}${fmt(endIso)}`;
}

// Compact contexts (cells, chips) use "j"; prose (dueLabelFull) uses "jours".
// A non-finite count (invalid date upstream) reads "—", never "Dans NaN j".
export function dueLabel(days: number): string {
  if (!Number.isFinite(days)) return "—";
  if (days < 0) return `${-days}${NNBSP}j de retard`;
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  return `Dans ${days}${NNBSP}j`;
}

export function dueLabelFull(days: number): string {
  if (!Number.isFinite(days)) return "—";
  if (days < 0) return `${-days}${NNBSP}${plural(days, "jour")} de retard`;
  if (days === 0) return "Aujourd’hui";
  return `Dans ${days}${NNBSP}${plural(days, "jour")}`;
}

export function fmtBudget(k: number): string {
  if (!k || !Number.isFinite(k)) return "—";
  return k >= 1000
    ? `${(k / 1000).toFixed(1).replace(".", ",")}${NNBSP}M€`
    : `${k.toLocaleString("fr-FR")}${NNBSP}k€`;
}

/** Format a raw euro amount compactly (€ / k€ / M€, one decimal), e.g.
 *  184500 → "184,5 k€", 1 250 000 → "1,3 M€". The unit is chosen AFTER
 *  rounding, so 999 960 reads "1,0 M€" (not "1000,0 k€"), and a value that
 *  rounds to zero carries no sign ("0 €", not "−0 €"). */
export function fmtEur(eur: number): string {
  if (!Number.isFinite(eur)) return "—";
  const a = Math.abs(eur);
  let body: string;
  let zero: boolean;
  const k = Math.round(a / 100) / 10; // thousands, 1 decimal
  const m = Math.round(a / 100_000) / 10; // millions, 1 decimal
  if (a < 1000) {
    const r = Math.round(a);
    zero = r === 0;
    body = `${r.toLocaleString("fr-FR")}${NNBSP}€`;
  } else if (k < 1000) {
    zero = false;
    body = `${k.toFixed(1).replace(".", ",")}${NNBSP}k€`;
  } else {
    zero = false;
    body = `${m.toFixed(1).replace(".", ",")}${NNBSP}M€`;
  }
  return eur < 0 && !zero ? `−${body}` : body;
}

// ----------------------------------------------------------- working days

export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

/** Planned effort normalised the ONE way every derivation uses it: a whole
 *  number of working days, at least 1 (decimals floored, 0/negative/NaN → 1). */
export function effortDays(plannedDays: number): number {
  return Number.isFinite(plannedDays) ? Math.max(1, Math.floor(plannedDays)) : 1;
}

/** End date (ISO, inclusive) of a task starting at `startIso` lasting `days`
 *  working days (see `effortDays`). A weekend start begins the next Monday.
 *  O(1) — weeks × 5 + remainder. "" for an invalid start. */
export function taskEnd(startIso: string, days: number): string {
  let d = epochDay(startIso);
  if (Number.isNaN(d)) return "";
  const n = effortDays(days);
  let w = dowOf(d);
  if (w >= 5) { d += 7 - w; w = 0; } // weekend → next Monday
  const idx = w + n - 1; // working-day offset from this week's Monday
  return fromEpochDay(d - w + 7 * Math.floor(idx / 5) + (idx % 5));
}

/** Start date (ISO) such that a `days`-working-day task ends on `endIso`
 *  (a weekend end counts back from the preceding Friday). O(1). */
export function taskStartForEnd(endIso: string, days: number): string {
  let d = epochDay(endIso);
  if (Number.isNaN(d)) return "";
  const n = effortDays(days);
  let w = dowOf(d);
  if (w >= 5) { d -= w - 4; w = 4; } // weekend → preceding Friday
  const p = w - (n - 1); // working-day offset from this week's Monday (≤ 4)
  const weeks = Math.floor(p / 5);
  return fromEpochDay(d - w + 7 * weeks + (p - 5 * weeks));
}

/** Weekdays in the half-open day range [anchor Monday, day). */
function weekdaysBefore(day: number): number {
  const rel = day - 4; // 1970-01-05 (day 4) was a Monday
  return 5 * Math.floor(rel / 7) + Math.min(((rel % 7) + 7) % 7, 5);
}

/** Inclusive count of weekdays between two ISO dates (0 if reversed/invalid). O(1). */
export function workingDaysBetween(aIso: string, bIso: string): number {
  const a = epochDay(aIso);
  const b = epochDay(bIso);
  if (Number.isNaN(a) || Number.isNaN(b) || a > b) return 0;
  return weekdaysBefore(b + 1) - weekdaysBefore(a);
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

/** Monday–Sunday range containing the given date ({"", ""} if invalid). */
export function weekRange(iso: string): DateRange {
  const d = epochDay(iso);
  if (Number.isNaN(d)) return { start: "", end: "" };
  const mon = d - dowOf(d);
  return { start: fromEpochDay(mon), end: fromEpochDay(mon + 6) };
}

export function monthRange(year: number, month: number): DateRange {
  return {
    start: toISO(new Date(year, month, 1)),
    end: toISO(new Date(year, month + 1, 0)),
  };
}

function isValidRange(range: DateRange): boolean {
  return isValidISODate(range.start) && isValidISODate(range.end) && range.start <= range.end;
}

/** Monday–Sunday weeks overlapping a range, each clamped to the range. */
export function weeksInRange(range: DateRange): DateRange[] {
  const out: DateRange[] = [];
  if (!isValidRange(range)) return out;
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
  if (!isValidRange(range)) return [];
  return eachDayISO(range.start, range.end)
    .filter((iso) => dayOfWeek(iso) < 5)
    .map((iso) => ({ start: iso, end: iso }));
}
