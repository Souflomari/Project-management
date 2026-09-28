"use client";

import { useLayoutEffect, useMemo, useRef } from "react";

import { FlagIcon } from "../../icons";
import { rowProps } from "../../ui";
import { eventsInRange, type TaskEvent } from "@/lib/derive";
import { isToday, monthRange, MONTHS_FULL, REFERENCE_DATE, daysFromToday, toDate } from "@/lib/format";
import { C, num, SH, TX, Z } from "@/lib/tokens";
import { PHASES } from "@/lib/types";
import { relativeLabel, WEEKDAYS_LONG } from "./shared";

/** Agenda grouped by day with sticky headers, a "today" anchor and relative
 *  labels. It follows the toolbar period (←/→ and the date picker): the
 *  anchored month — from today onwards when that month is the current one, so
 *  the current view stays forward-looking. */
export function AgendaView({ events, anchorISO, onOpen }: { events: TaskEvent[]; anchorISO: string; onOpen: (id: number) => void }) {
  const a = toDate(anchorISO);
  const month = monthRange(a.getFullYear(), a.getMonth());
  const fromToday = REFERENCE_DATE >= month.start && REFERENCE_DATE <= month.end;
  const range = { start: fromToday ? REFERENCE_DATE : month.start, end: month.end };
  const list = eventsInRange(events, range);

  const todayRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    todayRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  // Group by day.
  const groups = useMemo(() => {
    const m = new Map<string, TaskEvent[]>();
    for (const e of list) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);

  return (
    <div className="enter-rise" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", boxShadow: SH.sm }}>
      {groups.length === 0 ? (
        <div style={{ padding: 24, ...TX.body, color: C.ink500 }}>{fromToday ? "Aucune échéance à venir ce mois-ci." : "Aucune échéance ce mois-ci."}</div>
      ) : (
        groups.map(([iso, evs], gi) => {
          const d = toDate(iso);
          const today = isToday(iso);
          const past = daysFromToday(iso) < 0;
          return (
            <div key={iso} ref={today ? todayRef : undefined}>
              {/* Sticky day header */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: Z.sticky,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "8px 16px",
                  background: today ? C.brand50 : C.subtle,
                  borderTop: gi ? `1px solid ${C.line}` : "none",
                  borderBottom: `1px solid ${C.line}`,
                }}
              >
                <span style={{ ...num(14), color: today ? C.brand : C.ink900 }}>{d.getDate()}</span>
                <span style={{ ...TX.overline, color: C.ink600 }}>{WEEKDAYS_LONG[(d.getDay() + 6) % 7]} {MONTHS_FULL[d.getMonth()]}</span>
                <span style={{ marginLeft: "auto", ...TX.nano, fontWeight: 600, color: past ? C.danger : today ? C.brandText : C.ink500 }}>{relativeLabel(iso)}</span>
              </div>
              {evs.map((e, i) => {
                const overdue = !e.done && daysFromToday(e.date) < 0;
                return (
                  <div
                    key={`${e.projectId}-${e.subtaskId}`}
                    {...rowProps(() => onOpen(e.projectId))}
                    className="row-hover row-focus"
                    style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 16px", borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer", minHeight: 44 }}
                  >
                    {/* Rail spends colour only on meaning: red when overdue, else a
                     *  quiet hairline. Phase identity lives in the subtitle letter. */}
                    <div style={{ width: overdue ? 3 : 2, alignSelf: "stretch", borderRadius: 6, background: overdue ? C.danger : C.lineStrong }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Lead with the TASK name; project secondary. */}
                      <div style={{ ...TX.bodyStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: e.done ? "line-through" : "none" }}>{e.taskName}</div>
                      <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.projectName} · {PHASES[e.phaseIndex]}</div>
                    </div>
                    {overdue ? <span style={{ color: C.danger, display: "flex" }} title="En retard"><FlagIcon size={14} /></span> : null}
                    <div title={e.assigneeInitials} style={{ width: 26, height: 26, borderRadius: "50%", background: e.assigneeColor, color: C.surface, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {e.assigneeInitials}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
