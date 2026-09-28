"use client";

import { createPortal } from "react-dom";

import { FlagIcon } from "../../icons";
import { type TaskSpan, type TaskSpanSegment } from "@/lib/derive";
import { fmtFull, toDate } from "@/lib/format";
import { C, R, SH, SURFACE, TX, Z } from "@/lib/tokens";
import { PHASES, PHASES_FULL } from "@/lib/types";
import { isOverdue, isWeekendISO, PhaseBadge, type Dnd } from "./shared";

// Span bars (continuous task bars across the days of a week), the drop-target
// day cell and the drag ghost.

export function ChipGhost({ ghost }: { ghost: { label: string; x: number; y: number } }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: ghost.x + 12,
        top: ghost.y + 12,
        zIndex: Z.toast + 1,
        pointerEvents: "none",
        maxWidth: 220,
        padding: "5px 10px",
        borderRadius: R.sm,
        background: C.surface,
        // Neutral, matches the now-quiet bars — colour isn't decoration here either.
        border: `1px solid ${C.lineStrong}`,
        boxShadow: SH.overlay,
        ...TX.nano,
        fontWeight: 600,
        color: C.ink900,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {ghost.label}
    </div>,
    document.body,
  );
}

/** Compute, for one week row [weekStart..weekStart+6], the column geometry of a
 *  span segment: which weekday it starts/ends on (Mon=0..Sun=6). */
function segColumns(seg: TaskSpanSegment, weekStartISO: string): { startCol: number; endCol: number } {
  const ws = toDate(weekStartISO);
  const colOf = (iso: string) => {
    const diff = Math.round((toDate(iso).getTime() - ws.getTime()) / 86_400_000);
    return Math.max(0, Math.min(6, diff));
  };
  return { startCol: colOf(seg.start), endCol: colOf(seg.end) };
}

export function SpanBar({
  span,
  seg,
  weekStartISO,
  onOpen,
  dnd,
  onKeyReschedule,
}: {
  span: TaskSpan;
  seg: TaskSpanSegment;
  weekStartISO: string;
  onOpen: (id: number) => void;
  dnd: Dnd;
  onKeyReschedule: (s: TaskSpan, dir: 1 | -1) => void;
}) {
  const { startCol, endCol } = segColumns(seg, weekStartISO);
  const overdue = isOverdue(span);
  const dragging = dnd.dragId === span.subtaskId;

  return (
    <div
      role="button"
      // `.cal-chip` carries the complete pointer affordance (hover wash + grab,
      // and grabbing on :active) so EVERY chip reacts identically — replacing the
      // hand-rolled hover state that only some surfaces wired up. `.row-focus`
      // adds the designed keyboard focus ring (the bar is tab-stop + drag target).
      className="cal-chip row-focus"
      {...dnd.bind(span)}
      tabIndex={0}
      aria-label={`${span.taskName} — ${span.projectName}, ${PHASES_FULL[span.phaseIndex]}, échéance ${fmtFull(span.deadline)}${overdue ? ", en retard" : ""}`}
      title={`${span.projectName} — ${span.taskName} · ${PHASES[span.phaseIndex]} · ${fmtFull(span.deadline)}`}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onOpen(span.projectId);
        } else if (ev.key === "ArrowRight" && (ev.altKey || ev.metaKey)) {
          ev.preventDefault();
          onKeyReschedule(span, 1);
        } else if (ev.key === "ArrowLeft" && (ev.altKey || ev.metaKey)) {
          ev.preventDefault();
          onKeyReschedule(span, -1);
        }
      }}
      style={{
        gridColumn: `${startCol + 1} / ${endCol + 2}`,
        display: "flex",
        alignItems: "center",
        gap: 5,
        minWidth: 0,
        height: 24,
        padding: "0 6px",
        borderRadius: seg.isStart && seg.isEnd ? R.xs : seg.isStart ? "6px 0 0 6px" : seg.isEnd ? "0 6px 6px 0" : 0,
        // Quiet neutral chip — no decorative phase colour. Identity is the letter
        // badge; the bar carries name + (when overdue) the one status cue. Hover
        // is the `.cal-chip` wash, so the resting fill is the neutral well.
        background: C.subtle,
        // A solid hairline all round; a continued segment loses its leading edge so
        // the eye reads it as flowing from the prior week (no noisy dashed border).
        border: `1px solid ${C.line}`,
        borderLeftColor: seg.isStart ? C.line : "transparent",
        borderRightColor: seg.isEnd ? C.line : "transparent",
        // Overdue is the ONE status colour (red ring); everything else stays neutral.
        boxShadow: overdue ? `inset 0 0 0 1.5px ${C.danger}` : "none",
        cursor: "grab",
        // Touch scrolls; a long press starts the drag (usePointerDrag).
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
        userSelect: "none",
        overflow: "hidden",
        // Done bars recede via ink + strike-through (legible), not by fading the text.
        opacity: dragging ? 0.4 : 1,
        // `.cal-chip` transitions background + shadow; add opacity for the drag/done fade.
        transition: "opacity var(--dur-fast) var(--ease-standard)",
      }}
    >
      {/* Phase letter carries identity — a single quiet neutral badge (no colour). */}
      {seg.isStart ? <PhaseBadge index={span.phaseIndex} /> : null}
      <span style={{ flex: 1, minWidth: 0, ...TX.nano, fontWeight: 600, color: span.done ? C.ink500 : C.ink800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: span.done ? "line-through" : "none" }}>
        {span.taskName}
      </span>
      {/* Deadline position (the end day) already conveys the due date, so the flag
       *  is shown ONLY as the overdue status cue — no redundant neutral flag. */}
      {seg.isEnd && overdue ? (
        <span style={{ display: "flex", flexShrink: 0, color: C.danger }} title={`En retard — échéance ${fmtFull(span.deadline)}`}>
          <FlagIcon size={12} />
        </span>
      ) : null}
    </div>
  );
}

export function DayCell({
  iso,
  dnd,
  children,
  style,
  isToday: today,
}: {
  iso: string;
  dnd: Dnd;
  children: React.ReactNode;
  style: React.CSSProperties;
  isToday?: boolean;
}) {
  const over = dnd.overISO === iso;
  const isSnap = dnd.snapISO === iso;
  const weekend = isWeekendISO(iso);
  // During a drag, the cell the pointer is over highlights; but the actual landing
  // (weekday-snapped) cell gets the strong ring so the highlight tells the truth.
  const dropStyle: React.CSSProperties | null = isSnap
    ? { boxShadow: `inset 0 0 0 2px ${C.brand}`, background: C.brand50 }
    : over && weekend
    ? // hovering a weekend cell: mark non-droppable
      { boxShadow: `inset 0 0 0 2px ${C.lineStrong}`, background: SURFACE.containerHigh, cursor: "no-drop" }
    : over
    ? { background: C.brand50 }
    : null;
  return (
    <div data-cal-iso={iso} aria-current={today ? "date" : undefined} style={{ ...style, ...dropStyle }}>
      {children}
    </div>
  );
}
