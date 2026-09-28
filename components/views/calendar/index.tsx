"use client";

import { useCallback, useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "../../icons";
import { Button, IconButton, Segmented, Toolbar } from "../../ui";
import { buildTaskEvents, type TaskSpan } from "@/lib/derive";
import { fmtFull, MONS_LONG, shiftISO, taskStartForEnd, toDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useProjects, type CalMode } from "@/lib/store/projects-context";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePointerDrag } from "@/lib/use-pointer-drag";
import { C, TX } from "@/lib/tokens";
import { AgendaView } from "./agenda-view";
import { MonthView } from "./month-view";
import { isWeekendISO, snapToWeekday, weekLabel, type Dnd } from "./shared";
import { ChipGhost } from "./span-bar";
import { MiniMonthTitle, PhaseLegend, ProjectFacet, shiftMonthISO, useCalAnchorSetter } from "./toolbar";
import { WeekView } from "./week-view";

// Calendrier: month / week grids with draggable task spans, and a phone
// agenda. Split into cohesive modules in this folder.

const MODE_OPTS: { value: CalMode; label: string }[] = [
  { value: "mois", label: "Mois" },
  { value: "semaine", label: "Semaine" },
  { value: "agenda", label: "Agenda" },
];

const MOBILE_BP = 640;

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
