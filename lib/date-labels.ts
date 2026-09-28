import { MONTHS_FULL, toDate } from "./format";

/** "15 – 21 juin 2026", "29 juin – 5 juillet 2026", "29 déc. 2025 – 4 janvier 2026":
 *  a week label names BOTH months (and years) when the range spans them. */
export function weekRangeLabel(startISO: string, endISO: string, withYear = true): string {
  const a = toDate(startISO);
  const b = toDate(endISO);
  const endPart = `${b.getDate()} ${MONTHS_FULL[b.getMonth()]}${withYear ? ` ${b.getFullYear()}` : ""}`;
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${MONTHS_FULL[a.getMonth()]}${withYear ? ` ${a.getFullYear()}` : ""} – ${endPart}`;
  }
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MONTHS_FULL[a.getMonth()]} – ${endPart}`;
  return `${a.getDate()} – ${endPart}`;
}
