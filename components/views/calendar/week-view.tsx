"use client";

import { useMemo } from "react";

import { buildTaskSpans, type TaskEvent, type TaskSpan, type TaskSpanSegment } from "@/lib/derive";
import { isToday, toDate, toISO, weekRange } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, SH, TX } from "@/lib/tokens";
import { weekLabel, WEEKDAYS_LONG, WEEKDAYS_SHORT, type Dnd } from "./shared";
import { DayCell, SpanBar } from "./span-bar";

export function WeekView({
  anchorISO,
  projects,
  events,
  spanFilter,
  onOpen,
  dnd,
  onKeyReschedule,
}: {
  anchorISO: string;
  projects: ReturnType<typeof useProjects>["allDerived"];
  events: TaskEvent[];
  spanFilter: (s: TaskSpan) => boolean;
  onOpen: (id: number) => void;
  dnd: Dnd;
  onKeyReschedule: (s: TaskSpan, dir: 1 | -1) => void;
}) {
  const { start, end } = weekRange(anchorISO);
  const startD = toDate(start);
  const days = Array.from({ length: 7 }, (_, i) => new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i));

  const spans = useMemo(
    () => buildTaskSpans(projects, { start, end }).filter(spanFilter),
    [projects, start, end, spanFilter],
  );
  const rows = spans
    .map((s) => {
      const seg = s.segments.find((sg) => sg.end >= start && sg.start <= end);
      return seg ? { span: s, seg } : null;
    })
    .filter((x): x is { span: TaskSpan; seg: TaskSpanSegment } => x != null)
    .sort((a, b) => a.span.start.localeCompare(b.span.start));

  // Per-day load: count of events ending that day (deadlines) for a quick summary.
  const loadByISO = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.date, (m.get(e.date) ?? 0) + 1);
    return m;
  }, [events]);

  return (
    <div className="enter-rise" role="group" aria-label={`Semaine du ${weekLabel(anchorISO)}`} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", minWidth: 640, boxShadow: SH.sm }}>
      {/* Quiet day headers with per-day load summary; today carried by the green date. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        {days.map((d, i) => {
          const iso = toISO(d);
          const today = isToday(iso);
          const weekend = i >= 5;
          const load = loadByISO.get(iso) ?? 0;
          return (
            <div key={iso} aria-current={today ? "date" : undefined} style={{ padding: "8px 10px", borderRight: `1px solid ${C.line}` }}>
              <div title={WEEKDAYS_LONG[i]} style={{ ...TX.nano, fontWeight: weekend ? 500 : 600, color: C.ink400 }}>{WEEKDAYS_SHORT[i]}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                {/* Today is the single accent: a filled green badge (mirrors the month
                 *  grid), so the lane below needs no redundant column tint. */}
                {today ? (
                  <div style={{ ...num(14), width: 26, height: 26, borderRadius: "50%", background: C.brand, color: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>{d.getDate()}</div>
                ) : (
                  <div style={{ ...num(20), color: C.ink900 }}>{d.getDate()}</div>
                )}
                {load > 0 ? <span title={`${load} échéance${load > 1 ? "s" : ""}`} style={{ ...TX.nano, fontWeight: 600, color: C.ink500, background: C.subtle, borderRadius: R.pill, padding: "1px 6px" }}>{load}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drop cells (lanes) */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {days.map((d, i) => {
            const iso = toISO(d);
            const today = isToday(iso);
            const weekend = i >= 5;
            return (
              <DayCell key={iso} iso={iso} dnd={dnd} isToday={today} style={{ borderRight: `1px solid ${C.line}`, minHeight: Math.max(320, rows.length * 26 + 40), background: weekend ? C.subtle : C.surface }}>
                <div />
              </DayCell>
            );
          })}
        </div>
        {/* Work-window lanes across the week */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 8, padding: "0 4px", pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {rows.length === 0 ? (
              <div style={{ ...TX.caption, color: C.ink400, padding: "12px 8px", pointerEvents: "auto" }}>Aucune tâche cette semaine.</div>
            ) : (
              rows.map(({ span, seg }) => (
                <div key={span.subtaskId} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", pointerEvents: "auto" }}>
                  <SpanBar span={span} seg={seg} weekStartISO={start} onOpen={onOpen} dnd={dnd} onKeyReschedule={onKeyReschedule} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
