"use client";

import { useMemo, useRef, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { Button, IconButton, Modal, rowProps, Segmented, Select, Toolbar } from "../ui";
import { buildMonthGrid, buildTaskEvents, eventsInRange, type TaskEvent } from "@/lib/derive";
import { fmtFull, isToday, MONS_LONG, MONTHS_FULL, shiftISO, taskStartForEnd, toDate, WEEKDAYS, monthRange, weekRange } from "@/lib/format";
import { useProjects, type CalMode } from "@/lib/store/projects-context";
import { C, num, PHASE_COLORS, TX } from "@/lib/tokens";
import { PHASES } from "@/lib/types";

const MODE_OPTS: { value: CalMode; label: string }[] = [
  { value: "mois", label: "Mois" },
  { value: "semaine", label: "Semaine" },
  { value: "agenda", label: "Agenda" },
];

interface PendingMove {
  event: TaskEvent;
  date: string;
}

/** Saturday → Friday, Sunday → Monday; weekdays unchanged. */
function snapToWeekday(iso: string): string {
  const dow = toDate(iso).getDay();
  if (dow === 6) return shiftISO(iso, -1);
  if (dow === 0) return shiftISO(iso, 1);
  return iso;
}

export function CalendarView() {
  const { allDerived, calMode, calAnchor, calProjectFilter, setCalMode, calPrev, calNext, calToday, setCalProjectFilter, openProject, updateSubtask } =
    useProjects();

  const [pending, setPending] = useState<PendingMove | null>(null);
  // ISO of the day cell currently under a touch/mouse drag (drop-target highlight).
  const [overISO, setOverISO] = useState<string | null>(null);

  const events = useMemo(() => {
    const projects = calProjectFilter === null ? allDerived : allDerived.filter((p) => p.id === calProjectFilter);
    return buildTaskEvents(projects);
  }, [allDerived, calProjectFilter]);
  const anchor = toDate(calAnchor);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const label = calMode === "semaine" ? weekLabel(calAnchor) : `${MONS_LONG[month]} ${year}`;

  // Pointer-event drag (works on touch AND mouse; HTML5 DnD is dead on touch).
  // The chip captures the pointer; day cells expose data-cal-iso, resolved with
  // elementFromPoint on each move. A movement threshold keeps a tap = open.
  const drag = useRef<{ event: TaskEvent; startX: number; startY: number; moved: boolean; iso: string | null } | null>(null);

  function isoAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cal-iso]");
    return el?.dataset.calIso ?? null;
  }

  function commitDrop(dateISO: string | null, e: TaskEvent) {
    if (!dateISO) return;
    // Deadlines fall on working days only; snap a weekend drop to the nearest
    // weekday so the chip lands where the modal says it will (not the prev Fri).
    const target = snapToWeekday(dateISO);
    if (e.date !== target) setPending({ event: e, date: target });
  }

  const dnd: Dnd = {
    onStart: (e, ev, onOpen) => {
      drag.current = { event: e, startX: ev.clientX, startY: ev.clientY, moved: false, iso: null };
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    },
    onMove: (ev) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 5) return;
      d.moved = true;
      const iso = isoAtPoint(ev.clientX, ev.clientY);
      d.iso = iso;
      setOverISO(iso);
    },
    onUp: (ev, onOpen) => {
      const d = drag.current;
      drag.current = null;
      setOverISO(null);
      if (!d) return;
      if (d.moved) {
        const iso = isoAtPoint(ev.clientX, ev.clientY) ?? d.iso;
        commitDrop(iso, d.event);
      } else {
        onOpen(d.event.projectId);
      }
    },
    onCancel: () => { drag.current = null; setOverISO(null); },
    overISO,
  };

  function confirmMove() {
    if (!pending) return;
    updateSubtask(pending.event.projectId, pending.event.subtaskId, { start: taskStartForEnd(pending.date, pending.event.plannedDays) });
    setPending(null);
  }

  return (
    <>
      <Toolbar>
        <IconButton onClick={calPrev} size={34} aria-label="Précédent"><ChevronLeftIcon /></IconButton>
        <h2 style={{ ...num(21), minWidth: 210 }}>{label}</h2>
        <IconButton onClick={calNext} size={34} aria-label="Suivant"><ChevronRightIcon /></IconButton>
        <Button variant="secondary" size="sm" onClick={calToday}>Aujourd&apos;hui</Button>
        <div style={{ marginLeft: 4 }}>
          <Segmented value={calMode} options={MODE_OPTS} onChange={setCalMode} />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Select
            value={calProjectFilter ?? ""}
            onChange={(e) => setCalProjectFilter(e.target.value ? Number(e.target.value) : null)}
            style={{ width: 240 }}
          >
            <option value="">Tous les projets</option>
            {allDerived.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </Select>
        </div>
      </Toolbar>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 12 }}>
        {PHASES.map((ph, i) => (
          <span key={ph} style={{ display: "inline-flex", alignItems: "center", gap: 5, ...TX.caption, color: C.ink500 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: PHASE_COLORS[i] }} />
            {ph}
          </span>
        ))}
        <span style={{ ...TX.caption, color: C.ink400 }}>· glissez un rendu pour le replanifier</span>
      </div>

      {calMode === "agenda" ? (
        <AgendaView year={year} month={month} events={events} onOpen={openProject} />
      ) : (
        <div className="cal-scroll">
          {calMode === "mois" ? (
            <MonthView year={year} month={month} events={events} onOpen={openProject} dnd={dnd} />
          ) : (
            <WeekView anchorISO={calAnchor} events={events} onOpen={openProject} dnd={dnd} />
          )}
        </div>
      )}

      {pending ? (
        <Modal
          title="Replanifier le rendu"
          width={400}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPending(null)}>Annuler</Button>
              <Button onClick={confirmMove}>Décaler</Button>
            </>
          }
        >
          <p style={{ ...TX.body, color: C.ink700, margin: 0 }}>
            Décaler <strong>{pending.event.taskName}</strong> ({pending.event.projectName}) au{" "}
            <strong>{fmtFull(pending.date)}</strong> ? La durée planifiée ({pending.event.plannedDays} j) est conservée.
          </p>
        </Modal>
      ) : null}
    </>
  );
}

interface Dnd {
  onStart: (e: TaskEvent, ev: React.PointerEvent, onOpen: (id: number) => void) => void;
  onMove: (ev: React.PointerEvent) => void;
  onUp: (ev: React.PointerEvent, onOpen: (id: number) => void) => void;
  onCancel: () => void;
  /** ISO of the day cell under the active drag (drop-target highlight). */
  overISO: string | null;
}

function weekLabel(iso: string): string {
  const { start, end } = weekRange(iso);
  const a = toDate(start);
  const b = toDate(end);
  return `${a.getDate()} – ${b.getDate()} ${MONTHS_FULL[b.getMonth()]} ${b.getFullYear()}`;
}

function EventChip({ e, onOpen, dnd, compact }: { e: TaskEvent; onOpen: (id: number) => void; dnd: Dnd; compact?: boolean }) {
  return (
    <div
      onPointerDown={(ev) => { if (ev.button != null && ev.button !== 0) return; ev.stopPropagation(); dnd.onStart(e, ev, onOpen); }}
      onPointerMove={(ev) => dnd.onMove(ev)}
      onPointerUp={(ev) => { ev.stopPropagation(); dnd.onUp(ev, onOpen); }}
      onPointerCancel={dnd.onCancel}
      title={`${e.projectName} — ${e.taskName} (${PHASES[e.phaseIndex]})`}
      role="button"
      tabIndex={0}
      aria-label={`${e.projectName} — ${e.taskName}`}
      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(e.projectId); } }}
      className="cal-chip"
      style={{ background: C.subtle, borderLeft: `3px solid ${e.color}`, borderRadius: 4, padding: "3px 7px", cursor: "grab", touchAction: "none", overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.projectName}</div>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: e.statusColor, flexShrink: 0 }} />
      </div>
      {!compact ? <div style={{ fontSize: 10.5, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.taskName}</div> : null}
    </div>
  );
}

function DayCell({ iso, dnd, children, style }: { iso: string; dnd: Dnd; children: React.ReactNode; style: React.CSSProperties }) {
  const over = dnd.overISO === iso;
  return (
    <div
      data-cal-iso={iso}
      style={{ ...style, ...(over ? { boxShadow: `inset 0 0 0 2px ${C.brand}`, background: C.brand50 } : null) }}
    >
      {children}
    </div>
  );
}

function MonthView({ year, month, events, onOpen, dnd }: { year: number; month: number; events: TaskEvent[]; onOpen: (id: number) => void; dnd: Dnd }) {
  const cells = buildMonthGrid(year, month, events);
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", minWidth: 640 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: C.subtle, borderBottom: `1px solid ${C.line}` }}>
        {WEEKDAYS.map((w) => (<div key={w} style={{ padding: "9px 12px", ...TX.eyebrow, color: C.ink500 }}>{w}</div>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {cells.map((c, i) => {
          const weekend = i % 7 >= 5;
          const base: React.CSSProperties = {
            minHeight: 98,
            borderRight: `1px solid ${C.line}`,
            borderBottom: `1px solid ${C.line}`,
            padding: "5px 6px",
            background: c.day === null ? C.subtle : weekend ? C.canvas : C.surface,
          };
          const inner = (
            <>
              {c.day !== null ? (
                c.isToday ? (
                  <div style={{ ...num(13), width: 22, height: 22, borderRadius: "50%", background: C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.day}</div>
                ) : (
                  <div style={{ ...num(13), color: C.ink600, padding: "1px 2px" }}>{c.day}</div>
                )
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                {c.events.slice(0, 3).map((e) => (<EventChip key={`${e.projectId}-${e.subtaskId}`} e={e} onOpen={onOpen} dnd={dnd} />))}
                {c.events.length > 3 ? <div style={{ fontSize: 11, color: C.ink500, fontWeight: 600, paddingLeft: 2 }}>+{c.events.length - 3} autres</div> : null}
              </div>
            </>
          );
          return c.iso ? <DayCell key={i} iso={c.iso} dnd={dnd} style={base}>{inner}</DayCell> : <div key={i} style={base}>{inner}</div>;
        })}
      </div>
    </div>
  );
}

function WeekView({ anchorISO, events, onOpen, dnd }: { anchorISO: string; events: TaskEvent[]; onOpen: (id: number) => void; dnd: Dnd }) {
  const { start } = weekRange(anchorISO);
  const startD = toDate(start);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startD);
    d.setDate(startD.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, dow: WEEKDAYS[i], num: d.getDate(), isToday: isToday(iso), events: events.filter((e) => e.date === iso) };
  });

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(7,1fr)", minWidth: 640 }}>
      {days.map((d) => (
        <DayCell key={d.iso} iso={d.iso} dnd={dnd} style={{ borderRight: `1px solid ${C.line}`, minHeight: 320 }}>
          <div style={{ padding: "9px 10px", background: d.isToday ? C.brand50 : C.subtle, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ ...TX.eyebrow, color: C.ink500 }}>{d.dow}</div>
            <div style={{ ...num(18), color: d.isToday ? C.brand : C.ink900 }}>{d.num}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6 }}>
            {d.events.map((e) => (<EventChip key={`${e.projectId}-${e.subtaskId}`} e={e} onOpen={onOpen} dnd={dnd} />))}
          </div>
        </DayCell>
      ))}
    </div>
  );
}

function AgendaView({ year, month, events, onOpen }: { year: number; month: number; events: TaskEvent[]; onOpen: (id: number) => void }) {
  const list = eventsInRange(events, monthRange(year, month));
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
      {list.length === 0 ? (
        <div style={{ padding: 24, ...TX.body, color: C.ink500 }}>Aucune échéance ce mois-ci.</div>
      ) : (
        list.map((e, i) => {
          const d = toDate(e.date);
          return (
            <div
              key={i}
              {...rowProps(() => onOpen(e.projectId))}
              className="row-hover row-focus"
              style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 16px", borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer" }}
            >
              <div style={{ textAlign: "center", minWidth: 44 }}>
                <div style={num(18)}>{d.getDate()}</div>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", color: C.ink400, letterSpacing: ".06em" }}>{WEEKDAYS[(d.getDay() + 6) % 7]}</div>
              </div>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: e.color }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...TX.bodyStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.projectName}</div>
                <div style={{ ...TX.caption, color: C.ink500 }}>{e.taskName}</div>
              </div>
              <div title={e.assigneeInitials} style={{ width: 26, height: 26, borderRadius: "50%", background: e.assigneeColor, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {e.assigneeInitials}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
