"use client";

import { type TaskSpan } from "@/lib/derive";
import { weekRangeLabel } from "@/lib/date-labels";
import { dueLabel, daysFromToday, shiftISO, toDate, weekRange } from "@/lib/format";
import { usePointerDrag } from "@/lib/use-pointer-drag";
import { C, TX } from "@/lib/tokens";
import { PHASES, PHASES_FULL } from "@/lib/types";

// Shared calendar vocabulary: weekday labels, weekend snapping, relative
// labels, the drag contract (Dnd) and the phase-letter atom.

// Unambiguous, sentence-case weekday header abbreviations (vs "L M M J V S D",
// where three are 'M'/'J' look-alikes). Index = Monday-first.
export const WEEKDAYS_SHORT = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export const WEEKDAYS_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Saturday → Friday, Sunday → Monday; weekdays unchanged. Deadlines fall on
 *  working days only, so a weekend drop snaps to the nearest weekday. */
export function snapToWeekday(iso: string): string {
  const dow = toDate(iso).getDay();
  if (dow === 6) return shiftISO(iso, -1);
  if (dow === 0) return shiftISO(iso, 1);
  return iso;
}

export function isWeekendISO(iso: string): boolean {
  const dow = toDate(iso).getDay();
  return dow === 0 || dow === 6;
}

/** Forward-rolling relative label: "Aujourd'hui", "Demain", "Dans 3 j",
 *  "N j de retard" for past dates. Reuses the shared `dueLabel` vocabulary. */
export function relativeLabel(iso: string): string {
  return dueLabel(daysFromToday(iso));
}

export interface Dnd {
  /** Pointer handlers for a span bar (tap opens, drag reschedules). */
  bind: (s: TaskSpan) => ReturnType<ReturnType<typeof usePointerDrag<TaskSpan>>["bind"]>;
  /** ISO of the day cell under the active drag (drop-target highlight). */
  overISO: string | null;
  /** Working-day the drop would actually snap to (drawn distinctly during drag). */
  snapISO: string | null;
  /** subtaskId being dragged, so its source bar can dim. */
  dragId: number | null;
}

export function weekLabel(iso: string): string {
  const { start, end } = weekRange(iso);
  return weekRangeLabel(start, end);
}

//
// A span row draws a continuous bar across the days it occupies within a week,
// tinted by phase, with a distinct DEADLINE flag-cap on the end day. Single-day
// tasks collapse to a compact chip (handled by the same component: a 1-day span
// just renders a short bar that is also the deadline).

export function isOverdue(span: TaskSpan): boolean {
  return !span.done && daysFromToday(span.deadline) < 0;
}

/** The single phase-identity atom: a quiet neutral letter badge, rendered
 *  identically in every calendar surface (bars, popover). Phase identity is the
 *  letter code; colour is reserved for status (overdue) and the today accent. */
export function PhaseBadge({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      title={`${PHASES[index]} · ${PHASES_FULL[index]}`}
      style={{ ...TX.nano, fontWeight: 600, fontSize: 12, letterSpacing: ".03em", color: C.ink400, flexShrink: 0 }}
    >
      {PHASES[index]}
    </span>
  );
}
