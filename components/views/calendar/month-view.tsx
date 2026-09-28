"use client";

import { useMemo, useRef, useState } from "react";

import { FlagIcon } from "../../icons";
import { Popover } from "../../overlay/popover";
import { buildTaskSpans, type TaskSpan, type TaskSpanSegment } from "@/lib/derive";
import { fmtFull, isToday, MONS_LONG, toISO } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, SH, SURFACE, TX } from "@/lib/tokens";
import { isOverdue, PhaseBadge, WEEKDAYS_LONG, WEEKDAYS_SHORT, type Dnd } from "./shared";
import { DayCell, SpanBar } from "./span-bar";

export function MonthView({
  year,
  month,
  projects,
  spanFilter,
  onOpen,
  dnd,
  onKeyReschedule,
}: {
  year: number;
  month: number;
  projects: ReturnType<typeof useProjects>["allDerived"];
  spanFilter: (s: TaskSpan) => boolean;
  onOpen: (id: number) => void;
  dnd: Dnd;
  onKeyReschedule: (s: TaskSpan, dir: 1 | -1) => void;
}) {
  // Full 6-row grid: always render 42 day cells (incl. faded adjacent-month days).
  const first = new Date(year, month, 1);
  const startW = (first.getDay() + 6) % 7;
  // Calendar-day arithmetic via the Date constructor (DST-safe, no mutation).
  const days = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - startW + i));
  const rangeStart = toISO(new Date(year, month, 1 - startW));
  const rangeEnd = toISO(new Date(year, month, 1 - startW + 41));

  // Spans across the full visible 6-week window, segmented per week.
  const spans = useMemo(
    () => buildTaskSpans(projects, { start: rangeStart, end: rangeEnd }).filter(spanFilter),
    [projects, rangeStart, rangeEnd, spanFilter],
  );

  // Per-week: which spans have a segment in that week.
  const weeks = Array.from({ length: 6 }, (_, w) => {
    const weekStartISO = toISO(days[w * 7]);
    const weekEndISO = toISO(days[w * 7 + 6]);
    const rows = spans
      .map((s) => {
        const seg = s.segments.find((sg) => sg.end >= weekStartISO && sg.start <= weekEndISO);
        return seg ? { span: s, seg } : null;
      })
      .filter((x): x is { span: TaskSpan; seg: TaskSpanSegment } => x != null)
      .sort((a, b) => a.span.start.localeCompare(b.span.start) || a.span.end.localeCompare(b.span.end));
    return { w, weekStartISO, dayObjs: days.slice(w * 7, w * 7 + 7), rows };
  });

  const MAX_VISIBLE = 4; // single-line bars → fit 5-6/day; overflow → popover

  return (
    <div
      className="enter-rise"
      // A labelled group, not an ARIA grid: the continuous span bars overlay the
      // day cells and can't be expressed as grid rows/cells. Each bar is a
      // labelled button; the agenda view is the linear alternative.
      role="group"
      aria-label={`Calendrier ${MONS_LONG[month]} ${year}`}
      style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", minWidth: 640, boxShadow: SH.sm }}
    >
      {/* Quiet weekday header: white field, separation carried by the hairline only. */}
      <div aria-hidden style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        {WEEKDAYS_SHORT.map((wd, i) => (
          <div key={wd} title={WEEKDAYS_LONG[i]} style={{ padding: "8px 12px", ...TX.nano, fontWeight: i >= 5 ? 500 : 600, color: C.ink400 }}>
            {wd}
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week.w} style={{ position: "relative", borderBottom: `1px solid ${C.line}` }}>
          {/* Day-number layer + drop cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {week.dayObjs.map((d) => {
              const iso = toISO(d);
              const inMonth = d.getMonth() === month;
              const today = isToday(iso);
              const weekend = d.getDay() === 0 || d.getDay() === 6;

              return (
                <DayCell
                  key={iso}
                  iso={iso}
                  dnd={dnd}
                  isToday={today}
                  style={{
                    minWidth: 0,
                    minHeight: 124,
                    borderRight: `1px solid ${C.line}`,
                    padding: "5px 6px 6px",
                    // Today is the ONE accent (the green badge below) — no redundant cell
                    // tint. Adjacent-month + weekend simply recede into a quiet well.
                    background: !inMonth ? SURFACE.container : weekend ? C.subtle : C.surface,
                    overflow: "hidden",
                  }}
                >
                  {today ? (
                    <div style={{ ...num(14), width: 22, height: 22, borderRadius: "50%", background: C.brand, color: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>{d.getDate()}</div>
                  ) : (
                    <div style={{ ...num(14), color: inMonth ? C.ink600 : C.ink400, fontWeight: inMonth ? 600 : 400, padding: "1px 2px" }}>{d.getDate()}</div>
                  )}
                  <div aria-hidden style={{ height: week.rows.length ? Math.min(week.rows.length, MAX_VISIBLE) * 27 + (week.rows.length > MAX_VISIBLE ? 18 : 0) : 0 }} />
                </DayCell>
              );
            })}
          </div>

          {/* Span-bar overlay: one grid row of 7 columns per stacked bar. */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 28, padding: "0 4px", pointerEvents: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {week.rows.slice(0, MAX_VISIBLE).map(({ span, seg }) => (
                <div key={`${span.subtaskId}`} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", pointerEvents: "auto" }}>
                  <SpanBar span={span} seg={seg} weekStartISO={week.weekStartISO} onOpen={onOpen} dnd={dnd} onKeyReschedule={onKeyReschedule} />
                </div>
              ))}
            </div>
            {/* Overflow → floating per-day popover (replaces the grid-breaking "+N autres"). */}
            <DayOverflowRow week={week} max={MAX_VISIBLE} onOpen={onOpen} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Per-day "+N" buttons that open a floating popover (rather than expanding the
 *  cell, which broke the grid). The rows hidden in a week are the SAME for every
 *  day of that week (rows beyond MAX_VISIBLE), so a day's "+N" counts exactly
 *  those hidden rows that touch the day; the popover lists every task that day. */
function DayOverflowRow({
  week,
  max,
  onOpen,
}: {
  week: { weekStartISO: string; dayObjs: Date[]; rows: { span: TaskSpan; seg: TaskSpanSegment }[] };
  max: number;
  onOpen: (id: number) => void;
}) {
  const hiddenRows = week.rows.slice(max);
  if (hiddenRows.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginTop: 3, pointerEvents: "auto" }}>
      {week.dayObjs.map((d) => {
        const iso = toISO(d);
        const touches = ({ span }: { span: TaskSpan }) => span.start <= iso && span.end >= iso;
        const hidden = hiddenRows.filter(touches).length;
        if (hidden <= 0) return <div key={iso} />;
        return <DayOverflowButton key={iso} iso={iso} hidden={hidden} spans={week.rows.filter(touches).map((t) => t.span)} onOpen={onOpen} />;
      })}
    </div>
  );
}

function DayOverflowButton({ iso, hidden, spans, onOpen }: { iso: string; hidden: number; spans: TaskSpan[]; onOpen: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button
        ref={anchorRef}
        type="button"
        className="btn row-hover row-focus"
        // Presses on the trigger are not "outside" for the popover, so this
        // toggle really closes it (it used to close on mousedown, then reopen).
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${hidden} autre${hidden > 1 ? "s" : ""} tâche${hidden > 1 ? "s" : ""} le ${fmtFull(iso)}`}
        style={{ appearance: "none", border: "none", background: "transparent", cursor: "pointer", padding: "1px 4px", borderRadius: R.xs, ...TX.nano, fontWeight: 600, color: C.brandText, minHeight: 16 }}
      >
        +{hidden}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="dialog" label={`Tâches du ${fmtFull(iso)}`} width={248} maxHeight={280} padding={10}>
        <DayPopoverList iso={iso} spans={spans} onOpen={(id) => { setOpen(false); onOpen(id); }} />
      </Popover>
    </div>
  );
}

function DayPopoverList({ iso, spans, onOpen }: { iso: string; spans: TaskSpan[]; onOpen: (id: number) => void }) {
  return (
    <>
      <div style={{ ...TX.eyebrow, color: C.ink400, marginBottom: 8 }}>{fmtFull(iso)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {spans.map((s) => (
          <button
            key={s.subtaskId}
            type="button"
            className="btn row-hover row-focus"
            onClick={() => onOpen(s.projectId)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 30, padding: "5px 6px", border: "none", background: "transparent", borderRadius: R.sm, cursor: "pointer", textAlign: "left" }}
          >
            {/* Same neutral phase-letter atom as the bars — one consistent cue. */}
            <PhaseBadge index={s.phaseIndex} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", ...TX.nano, fontWeight: 600, color: C.ink900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.taskName}</span>
              <span style={{ display: "block", ...TX.nano, color: C.ink500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.projectName}</span>
            </span>
            {isOverdue(s) ? <span style={{ color: C.danger, display: "flex" }}><FlagIcon size={11} /></span> : null}
          </button>
        ))}
      </div>
    </>
  );
}
