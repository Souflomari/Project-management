"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, FlagIcon } from "../icons";
import { Popover } from "../overlay/popover";
import { Button, IconButton, rowProps, Segmented, Toolbar } from "../ui";
import {
  buildTaskSpans,
  eventsInRange,
  buildTaskEvents,
  type TaskEvent,
  type TaskSpan,
  type TaskSpanSegment,
} from "@/lib/derive";
import { weekRangeLabel } from "@/lib/date-labels";
import {
  dueLabel,
  fmtFull,
  isToday,
  monthRange,
  MONS_LONG,
  MONTHS_FULL,
  REFERENCE_DATE,
  daysFromToday,
  shiftISO,
  taskStartForEnd,
  toDate,
  toISO,
  weekRange,
} from "@/lib/format";
import { toast } from "@/lib/toast";
import { useProjects, type CalMode } from "@/lib/store/projects-context";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePointerDrag } from "@/lib/use-pointer-drag";
import { C, num, R, SH, SURFACE, TX, Z } from "@/lib/tokens";
import { PHASES, PHASES_FULL } from "@/lib/types";

const MODE_OPTS: { value: CalMode; label: string }[] = [
  { value: "mois", label: "Mois" },
  { value: "semaine", label: "Semaine" },
  { value: "agenda", label: "Agenda" },
];

// Unambiguous, sentence-case weekday header abbreviations (vs "L M M J V S D",
// where three are 'M'/'J' look-alikes). Index = Monday-first.
const WEEKDAYS_SHORT = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const WEEKDAYS_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const MOBILE_BP = 640;

/** Saturday → Friday, Sunday → Monday; weekdays unchanged. Deadlines fall on
 *  working days only, so a weekend drop snaps to the nearest weekday. */
function snapToWeekday(iso: string): string {
  const dow = toDate(iso).getDay();
  if (dow === 6) return shiftISO(iso, -1);
  if (dow === 0) return shiftISO(iso, 1);
  return iso;
}

function isWeekendISO(iso: string): boolean {
  const dow = toDate(iso).getDay();
  return dow === 0 || dow === 6;
}

/** Forward-rolling relative label: "Aujourd'hui", "Demain", "Dans 3 j",
 *  "N j de retard" for past dates. Reuses the shared `dueLabel` vocabulary. */
function relativeLabel(iso: string): string {
  return dueLabel(daysFromToday(iso));
}

interface Dnd {
  /** Pointer handlers for a span bar (tap opens, drag reschedules). */
  bind: (s: TaskSpan) => ReturnType<ReturnType<typeof usePointerDrag<TaskSpan>>["bind"]>;
  /** ISO of the day cell under the active drag (drop-target highlight). */
  overISO: string | null;
  /** Working-day the drop would actually snap to (drawn distinctly during drag). */
  snapISO: string | null;
  /** subtaskId being dragged, so its source bar can dim. */
  dragId: number | null;
}

export function CalendarView() {
  const {
    allDerived,
    calMode,
    calAnchor,
    calProjectFilter,
    setCalMode,
    calPrev,
    calNext,
    calToday,
    openProject,
    updateSubtask,
  } = useProjects();

  // Phones get the agenda instead of side-scrolling a 640px grid. The hook reads
  // the real viewport on the first client render (no desktop→phone flash).
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BP}px)`);
  // On a phone the month/week grids side-scroll a 640px slab; default to agenda.
  const effectiveMode: CalMode = isMobile ? "agenda" : calMode;

  // ---- facets (local; store only carries a single-project filter) ----
  // Seed from the store's single-project filter so deep links still apply, then
  // let the user multi-select projects + toggle phases via the interactive legend.
  const [projectSel, setProjectSel] = useState<Set<number>>(
    () => (calProjectFilter !== null ? new Set([calProjectFilter]) : new Set()),
  );
  // Adopt a new store filter during render (no setState-in-effect cascade).
  const [seenProjectFilter, setSeenProjectFilter] = useState(calProjectFilter);
  if (seenProjectFilter !== calProjectFilter) {
    setSeenProjectFilter(calProjectFilter);
    if (calProjectFilter !== null) setProjectSel(new Set([calProjectFilter]));
  }
  const [phaseSel, setPhaseSel] = useState<Set<number>>(new Set());

  const toggleSet = (set: Set<number>, v: number) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  };

  const projects = useMemo(() => {
    let r = allDerived;
    if (projectSel.size) r = r.filter((p) => projectSel.has(p.id));
    return r;
  }, [allDerived, projectSel]);

  // Single-day events (agenda + day popover) and multi-day spans (grid bars).
  const events = useMemo(() => {
    const evs = buildTaskEvents(projects);
    return phaseSel.size ? evs.filter((e) => phaseSel.has(e.phaseIndex)) : evs;
  }, [projects, phaseSel]);

  const anchor = toDate(calAnchor);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const label = effectiveMode === "semaine" ? weekLabel(calAnchor) : `${MONS_LONG[month]} ${year}`;

  // Stable identity so the grids' span memos actually hold between renders.
  const spanFilter = useCallback((s: TaskSpan) => !phaseSel.size || phaseSel.has(s.phaseIndex), [phaseSel]);
  const { jumpTo } = useCalAnchorSetter();
  // Phones show the agenda by MONTH whatever the stored mode, so ←/→ step months.
  const prev = isMobile ? () => jumpTo(shiftMonthISO(calAnchor, -1)) : calPrev;
  const next = isMobile ? () => jumpTo(shiftMonthISO(calAnchor, 1)) : calNext;

  // ---- pointer drag (mouse: threshold; touch: long-press) — shared hook ----
  function commitMove(span: TaskSpan, rawISO: string) {
    const target = snapToWeekday(rawISO);
    if (target === span.deadline) return;
    const prevStart = span.start;
    // Optimistic + undo (matches the gantt) — no confirm modal per the audit.
    updateSubtask(span.projectId, span.subtaskId, { start: taskStartForEnd(target, span.plannedDays) });
    toast({
      message: `« ${span.taskName} » déplacé au ${fmtFull(target)}`,
      variant: "success",
      action: {
        label: "Annuler",
        onClick: () => updateSubtask(span.projectId, span.subtaskId, { start: prevStart }),
      },
    });
  }

  const { drag, bind } = usePointerDrag<TaskSpan>({
    targetAt: (x, y) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cal-iso]")?.dataset.calIso ?? null,
    onTap: (s) => openProject(s.projectId),
    // Dropped outside any day cell → cancelled (never the last hovered day).
    onDrop: (s, iso) => commitMove(s, iso),
  });
  const overISO = drag?.over ?? null;
  const dnd: Dnd = {
    bind,
    overISO,
    // The weekend-snap target is computed DURING the move so the highlight
    // tells the truth (audit: the old highlight "lied").
    snapISO: overISO ? snapToWeekday(overISO) : null,
    dragId: drag?.item.subtaskId ?? null,
  };

  // Keyboard reschedule: ±1 working day on the focused span (a11y path).
  function keyboardReschedule(span: TaskSpan, dir: 1 | -1) {
    let target = shiftISO(span.deadline, dir);
    if (isWeekendISO(target)) target = snapToWeekday(shiftISO(target, dir > 0 ? 1 : -1));
    commitMove(span, target);
  }

  return (
    <>
      <Toolbar>
        <IconButton onClick={prev} size={34} aria-label="Période précédente">
          <ChevronLeftIcon />
        </IconButton>
        <MiniMonthTitle label={label} anchorISO={calAnchor} />
        <IconButton onClick={next} size={34} aria-label="Période suivante">
          <ChevronRightIcon />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={calToday}>
          Aujourd&rsquo;hui
        </Button>
        {!isMobile ? (
          <div style={{ marginLeft: 4 }}>
            <Segmented value={calMode} options={MODE_OPTS} onChange={setCalMode} aria-label="Affichage du calendrier" />
          </div>
        ) : (
          <span style={{ ...TX.caption, color: C.ink500, marginLeft: 4 }}>Agenda</span>
        )}
        <div style={{ marginLeft: "auto" }}>
          <ProjectFacet
            projects={allDerived.map((p) => ({ id: p.id, name: p.name }))}
            selected={projectSel}
            onToggle={(id) => setProjectSel((s) => toggleSet(s, id))}
            onClear={() => setProjectSel(new Set())}
          />
        </div>
      </Toolbar>

      {/* Interactive legend doubles as a phase filter (click a phase to focus). */}
      <PhaseLegend selected={phaseSel} onToggle={(i) => setPhaseSel((s) => toggleSet(s, i))} onClear={() => setPhaseSel(new Set())} />

      {effectiveMode === "agenda" ? (
        <AgendaView events={events} anchorISO={calAnchor} onOpen={openProject} />
      ) : (
        <div className="cal-scroll">
          {effectiveMode === "mois" ? (
            <MonthView
              year={year}
              month={month}
              projects={projects}
              spanFilter={spanFilter}
              onOpen={openProject}
              dnd={dnd}
              onKeyReschedule={keyboardReschedule}
            />
          ) : (
            <WeekView
              anchorISO={calAnchor}
              projects={projects}
              events={events}
              spanFilter={spanFilter}
              onOpen={openProject}
              dnd={dnd}
              onKeyReschedule={keyboardReschedule}
            />
          )}
        </div>
      )}

      {drag ? <ChipGhost ghost={{ label: drag.item.taskName, x: drag.x, y: drag.y }} /> : null}
    </>
  );
}

// ─────────────────────────────────────────────────────── title + mini-month

function MiniMonthTitle({ label, anchorISO }: { label: string; anchorISO: string }) {
  const { jumpTo } = useCalAnchorSetter();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        ref={anchorRef}
        type="button"
        className="btn row-hover row-focus"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label} — choisir une date`}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "2px 6px",
          borderRadius: R.sm,
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        <h2 style={{ ...num(20), margin: 0, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</h2>
        <span style={{ color: C.ink400, display: "flex" }}>
          <CalendarIcon size={16} />
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="dialog" label="Choisir une date" width={248} padding={12} maxHeight={400}>
        <MiniMonth
          anchorISO={anchorISO}
          onPick={(iso) => {
            jumpTo(iso);
            setOpen(false);
          }}
        />
      </Popover>
    </div>
  );
}

/** Month offset between two ISO dates (calendar months). */
function monthDelta(fromISO: string, toISO_: string): number {
  const a = toDate(fromISO);
  const b = toDate(toISO_);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Same day-of-month `delta` months away (clamped to the month's length). */
function shiftMonthISO(iso: string, delta: number): string {
  const d = toDate(iso);
  const first = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), dim)));
}

/** The store exposes prev/next/today but no absolute anchor setter; jump by
 *  stepping. The store steps WEEKS in "semaine" mode and MONTHS otherwise, so
 *  the step count must be computed in the same unit (the old version always
 *  counted months, landing on the wrong week). */
function useCalAnchorSetter() {
  const { calAnchor, calMode, calPrev, calNext } = useProjects();
  const jumpTo = (targetISO: string) => {
    let delta: number;
    if (calMode === "semaine") {
      const from = toDate(weekRange(calAnchor).start);
      const to = toDate(weekRange(targetISO).start);
      // Calendar-day diff via UTC dates (DST-proof), then whole weeks.
      const days = Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000);
      delta = Math.round(days / 7);
    } else {
      delta = monthDelta(calAnchor, targetISO);
    }
    const step = delta > 0 ? calNext : calPrev;
    for (let i = 0; i < Math.abs(delta); i++) step();
  };
  return { jumpTo };
}

function MiniMonth({ anchorISO, onPick }: { anchorISO: string; onPick: (iso: string) => void }) {
  const [view, setView] = useState(() => {
    const d = toDate(anchorISO);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const first = new Date(view.y, view.m, 1);
  const startW = (first.getDay() + 6) % 7;
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startW; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  const stepMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <IconButton size={28} onClick={() => stepMonth(-1)} aria-label="Mois précédent">
          <ChevronLeftIcon size={14} />
        </IconButton>
        <div style={{ ...TX.bodyStrong, color: C.ink900 }}>
          {MONS_LONG[view.m]} {view.y}
        </div>
        <IconButton size={28} onClick={() => stepMonth(1)} aria-label="Mois suivant">
          <ChevronRightIcon size={14} />
        </IconButton>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} style={{ ...TX.nano, color: C.ink400, textAlign: "center", padding: "2px 0" }}>
            {w[0]}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const today = isToday(iso);
          return (
            <button
              key={i}
              type="button"
              // Non-today days take the hover wash; today keeps its green fill (a
              // wash would erase the accent), so every picker day still reacts.
              className={today ? "btn" : "btn row-hover"}
              onClick={() => onPick(iso)}
              aria-current={today ? "date" : undefined}
              aria-label={fmtFull(iso)}
              style={{
                border: "none",
                cursor: "pointer",
                background: today ? C.brand : "transparent",
                color: today ? C.surface : C.ink700,
                borderRadius: R.xs,
                height: 28,
                ...num(12),
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── facets

function ProjectFacet({
  projects,
  selected,
  onToggle,
  onClear,
}: {
  projects: { id: number; name: string }[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const count = selected.size;
  const labelText = count === 0 ? "Tous les projets" : `${count} projet${count > 1 ? "s" : ""}`;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={anchorRef}
        type="button"
        // btn-secondary supplies the designed hover/active (wash + border lift) so
        // the trigger reacts like every other secondary control (it's the same
        // white-surface look as the "Aujourd'hui" button), not just a 1px nudge.
        className="btn btn-secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 12px",
          border: `1px solid ${count ? C.brand : C.lineStrong}`,
          background: count ? C.brand50 : C.surface,
          color: count ? C.brandText : C.ink700,
          borderRadius: R.sm,
          cursor: "pointer",
          ...TX.caption,
          fontWeight: 600,
        }}
      >
        {labelText}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="dialog" label="Filtrer par projet" width={264} align="end">
          <button
            type="button"
            className="btn row-hover row-focus"
            onClick={onClear}
            style={facetRowStyle(count === 0)}
            aria-pressed={count === 0}
          >
            <span style={{ ...checkboxDot(count === 0) }} />
            Tous les projets
          </button>
          {projects.map((p) => {
            const sel = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className="btn row-hover row-focus"
                aria-pressed={sel}
                onClick={() => onToggle(p.id)}
                style={facetRowStyle(sel)}
              >
                <span style={checkboxDot(sel)} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              </button>
            );
          })}
      </Popover>
    </div>
  );
}

function facetRowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minHeight: 34,
    padding: "6px 8px",
    border: "none",
    background: active ? C.brand50 : "transparent",
    color: C.ink800,
    borderRadius: R.sm,
    cursor: "pointer",
    textAlign: "left",
    ...TX.caption,
  };
}

function checkboxDot(active: boolean): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: R.xxs,
    flexShrink: 0,
    border: active ? `1px solid ${C.brand}` : `1.5px solid ${C.lineStrong}`,
    background: active ? C.brand : C.surface,
    boxShadow: active ? `inset 0 0 0 2px ${C.surface}` : "none",
  };
}

function PhaseLegend({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<number>;
  onToggle: (i: number) => void;
  onClear: () => void;
}) {
  // One compact, quiet legend line: the phase letters double as filter chips.
  // No coloured swatches — phase identity is the letter; the active filter is a
  // neutral slate emphasis (selection, not decoration).
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 4px", alignItems: "center", marginBottom: 12 }}>
      <span style={{ ...TX.nano, color: C.ink400, marginRight: 4 }}>Phase&nbsp;:</span>
      {PHASES.map((ph, i) => {
        const on = selected.size === 0 || selected.has(i);
        const explicit = selected.has(i);
        return (
          <button
            key={ph}
            type="button"
            // row-hover adds the visible brand-tinted hover wash (a 1px .btn lift
            // alone was too faint on these transparent chips); row-focus = ring.
            className="btn row-hover row-focus"
            aria-pressed={explicit}
            title={`${ph} · ${PHASES_FULL[i]}${explicit ? " (filtre actif)" : ""}`}
            onClick={() => onToggle(i)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 24,
              padding: "2px 8px",
              borderRadius: R.sm,
              border: `1px solid ${explicit ? C.lineStrong : "transparent"}`,
              background: explicit ? SURFACE.containerHigh : "transparent",
              color: explicit ? C.ink800 : C.ink500,
              // Phases filtered OUT read as struck-through (not as faint,
              // illegible text — they are still actionable toggles).
              textDecoration: on ? "none" : "line-through",
              cursor: "pointer",
              ...TX.nano,
              fontWeight: 600,
            }}
          >
            {ph}
          </button>
        );
      })}
      {selected.size ? (
        <button
          type="button"
          className="btn row-hover row-focus"
          onClick={onClear}
          style={{ border: "none", background: "transparent", cursor: "pointer", ...TX.nano, color: C.brandText, padding: "3px 6px", borderRadius: R.sm }}
        >
          Réinitialiser
        </button>
      ) : (
        <span style={{ ...TX.nano, color: C.ink400, marginLeft: 6 }}>· glissez une barre pour replanifier</span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── ghost

function ChipGhost({ ghost }: { ghost: { label: string; x: number; y: number } }) {
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

function weekLabel(iso: string): string {
  const { start, end } = weekRange(iso);
  return weekRangeLabel(start, end);
}

// ───────────────────────────────────────────────────────────── span bars
//
// A span row draws a continuous bar across the days it occupies within a week,
// tinted by phase, with a distinct DEADLINE flag-cap on the end day. Single-day
// tasks collapse to a compact chip (handled by the same component: a 1-day span
// just renders a short bar that is also the deadline).

function isOverdue(span: TaskSpan): boolean {
  return !span.done && daysFromToday(span.deadline) < 0;
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

function SpanBar({
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

/** The single phase-identity atom: a quiet neutral letter badge, rendered
 *  identically in every calendar surface (bars, popover). Phase identity is the
 *  letter code; colour is reserved for status (overdue) and the today accent. */
function PhaseBadge({ index }: { index: number }) {
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

// ───────────────────────────────────────────────────────────── month grid

function DayCell({
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

function MonthView({
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

// ───────────────────────────────────────────────────────────── week view

function WeekView({
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

// ───────────────────────────────────────────────────────────── agenda

/** Agenda grouped by day with sticky headers, a "today" anchor and relative
 *  labels. It follows the toolbar period (←/→ and the date picker): the
 *  anchored month — from today onwards when that month is the current one, so
 *  the current view stays forward-looking. */
function AgendaView({ events, anchorISO, onOpen }: { events: TaskEvent[]; anchorISO: string; onOpen: (id: number) => void }) {
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
