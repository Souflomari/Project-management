"use client";

import { useEffect, useRef, useState } from "react";

import { FilterBar } from "../filter-bar";
import { ChevronRightIcon } from "../icons";
import { Avatar, Button, Segmented, StatusPill } from "../ui";
import { buildGantt, type GanttBar, type GanttRow } from "@/lib/derive";
import { fmtShort, shiftISO, toDate, workingDaysBetween } from "@/lib/format";
import type { SubtaskPatch } from "@/lib/data/repository";
import { useProjects } from "@/lib/store/projects-context";
import { toast } from "@/lib/toast";
import { C, FONT_NUM, R, SH, TX } from "@/lib/tokens";

const LEFT_W = 324;
const PROJ_ROW_H = 48;
const SUB_ROW_H = 30;

function Legend() {
  return (
    <span style={{ ...TX.nano, color: C.ink500, display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 9, borderRadius: 2, background: C.ink700, opacity: 0.85 }} />
        avancement
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 9, borderRadius: 2, background: `${C.ink700}14`, border: `1px solid ${C.ink700}40` }} />
        durée planifiée
      </span>
    </span>
  );
}

export function PlanningGantt() {
  const { filtered, openProject, updateSubtask, updateProject } = useProjects();
  const { months, rows, todayLeft, spanDays, windowStart } = buildGantt(filtered);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoom, setZoom] = useState<"trimestre" | "mois" | "semaine">("mois");

  // px-per-day drives the timeline width so weeks become legible (and scrollable).
  const pxPerDay = zoom === "trimestre" ? 2.6 : zoom === "semaine" ? 13 : 6;
  const timelineW = Math.max(900, Math.round(spanDays * pxPerDay));
  const weekPx = 7 * pxPerDay;
  const wsDow = (toDate(windowStart).getDay() + 6) % 7; // 0 = Monday
  const weekOffsetPx = ((7 - wsDow) % 7) * pxPerDay;
  const showWeeks = pxPerDay >= 4;
  // Week gridlines drawn as a single cheap CSS gradient (one Monday line per period).
  const weekGrid: React.CSSProperties = showWeeks
    ? { backgroundImage: `repeating-linear-gradient(90deg, rgba(28,25,23,.045) 0 1px, transparent 1px ${weekPx}px)`, backgroundPosition: `${weekOffsetPx}px 0` }
    : {};

  const scrollToToday = (smooth = true) => {
    const sc = scroller.current;
    if (!sc) return;
    sc.scrollTo({ left: Math.max(0, LEFT_W + (todayLeft / 100) * timelineW - sc.clientWidth / 2), behavior: smooth ? "smooth" : "auto" });
  };

  // Land on "today" (where the active work is) on load and whenever the zoom
  // changes — otherwise a wide timeline opens on empty early history.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToToday(false); }, [zoom]);

  // drag-to-pan
  const scroller = useRef<HTMLDivElement>(null);
  const pan = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  function onMouseDown(e: React.MouseEvent) {
    pan.current = { down: true, startX: e.clientX, startScroll: scroller.current?.scrollLeft ?? 0, moved: false };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!pan.current.down || !scroller.current) return;
    const dx = e.clientX - pan.current.startX;
    if (Math.abs(dx) > 4) pan.current.moved = true;
    scroller.current.scrollLeft = pan.current.startScroll - dx;
  }
  function endPan() {
    pan.current.down = false;
  }
  /** Swallow the click that ends a drag so it doesn't toggle a row. */
  const clickGuard = (fn: () => void) => () => {
    if (pan.current.moved) {
      pan.current.moved = false;
      return;
    }
    fn();
  };

  return (
    <>
      <FilterBar
        trailing={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Legend />
            <Button variant="secondary" size="sm" onClick={() => scrollToToday()}>Aujourd&apos;hui</Button>
            <Segmented
              value={zoom}
              onChange={setZoom}
              options={[
                { value: "trimestre", label: "Trimestre" },
                { value: "mois", label: "Mois" },
                { value: "semaine", label: "Semaine" },
              ]}
            />
          </div>
        }
      />

      <div style={{ position: "relative" }}>
        <div
          ref={scroller}
          className="pan"
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endPan}
          onMouseLeave={endPan}
          style={{
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: R.lg,
            overflow: "auto",
            maxHeight: "calc(100vh - 215px)",
          }}
        >
          <div style={{ minWidth: LEFT_W + timelineW }}>
            {/* month header (sticky) */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: C.subtle, zIndex: 4 }}>
              <div
                style={{
                  width: LEFT_W,
                  flexShrink: 0,
                  padding: "8px 14px",
                  ...TX.overline,
                  color: C.ink400,
                  position: "sticky",
                  left: 0,
                  background: C.subtle,
                  borderRight: `1px solid ${C.line}`,
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                Projet · responsable
              </div>
              <div style={{ flex: 1, position: "relative", height: 28, ...weekGrid }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${m.left}%`,
                      width: `${m.width}%`,
                      borderLeft: `1px solid ${C.lineStrong}`,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 6,
                      fontFamily: FONT_NUM,
                      fontSize: 11,
                      fontWeight: 500,
                      color: C.ink500,
                    }}
                  >
                    {m.label}
                  </div>
                ))}
                <TodayLine left={todayLeft} label />
              </div>
            </div>

            {/* rows */}
            {rows.map((g) => {
              const isOpen = expanded.has(g.id);
              return (
                <div key={g.id}>
                  <div
                    onClick={clickGuard(() => toggle(g.id))}
                    className="row-hover"
                    style={{ display: "flex", borderTop: `1px solid ${C.line}`, cursor: "pointer", background: isOpen ? C.subtle : C.surface }}
                  >
                    <div
                      style={{
                        width: LEFT_W,
                        flexShrink: 0,
                        padding: "8px 14px",
                        position: "sticky",
                        left: 0,
                        background: isOpen ? C.subtle : C.surface,
                        borderRight: `1px solid ${C.line}`,
                        minWidth: 0,
                        display: "flex",
                        gap: 9,
                        alignItems: "center",
                        zIndex: 1,
                      }}
                    >
                      <span style={{ color: C.ink400, display: "flex", flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}><ChevronRightIcon size={14} /></span>
                      <Avatar initials={g.responsableInitials} color={g.responsableColor} size={28} fontSize={11} title={`${g.responsable} · ${g.responsableRole}`} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ ...TX.bodyStrong, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                        <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {g.client} · {g.discipline}
                        </div>
                      </div>
                      <StatusPill color={g.statusColor} bg={g.statusBg} label={g.statusLabel} filled />
                    </div>
                    <div style={{ flex: 1, position: "relative", height: PROJ_ROW_H, ...weekGrid }}>
                      <GridLines months={months} />
                      <TodayLine left={todayLeft} />
                      <ProjectBar g={g} spanDays={spanDays} onCommit={updateProject} />
                    </div>
                  </div>

                  {/* subtasks + dependency arrows */}
                  {isOpen ? (
                    <div style={{ position: "relative" }}>
                      {g.subtasks.map((s, i) => (
                        <div
                          key={s.id}
                          onClick={clickGuard(() => openProject(g.id))}
                          className="soft-hover"
                          style={{ display: "flex", borderTop: `1px solid ${C.subtle}`, cursor: "pointer", background: C.canvas, height: SUB_ROW_H }}
                        >
                          <div
                            style={{
                              width: LEFT_W,
                              flexShrink: 0,
                              padding: "0 14px 0 37px",
                              position: "sticky",
                              left: 0,
                              background: C.canvas,
                              borderRight: `1px solid ${C.line}`,
                              minWidth: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              zIndex: 1,
                            }}
                          >
                            <Avatar initials={s.assigneeInitials} color={s.color} size={18} fontSize={9} title={s.assigneeInitials} />
                            <span style={{ ...TX.micro, color: s.done ? C.ink400 : C.ink900, textDecoration: s.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {s.name}
                            </span>
                          </div>
                          <div style={{ flex: 1, position: "relative", ...weekGrid }}>
                            <GridLines months={months} />
                            <TodayLine left={todayLeft} />
                            <SubtaskBar projectId={g.id} s={s} spanDays={spanDays} onCommit={updateSubtask} />
                          </div>
                        </div>
                      ))}
                      <DependencyArrows subtasks={g.subtasks} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* horizontal scroll cues */}
        <div style={{ position: "absolute", top: 1, right: 1, bottom: 1, width: 36, pointerEvents: "none", background: `linear-gradient(to right, rgba(255,255,255,0), ${C.surface})`, borderRadius: `0 ${R.lg - 1}px ${R.lg - 1}px 0` }} />
        {scrollLeft > 4 ? (
          <div style={{ position: "absolute", top: 1, left: LEFT_W + 1, bottom: 1, width: 28, pointerEvents: "none", background: `linear-gradient(to left, rgba(255,255,255,0), ${C.surface})` }} />
        ) : null}
      </div>
    </>
  );
}

/** SVG overlay drawing Finish-to-Start connectors between a project's tasks. */
function DependencyArrows({ subtasks }: { subtasks: GanttBar[] }) {
  const byId = new Map(subtasks.map((s, i) => [s.id, { s, i }]));
  const links: { x1: number; y1: number; x2: number; y2: number }[] = [];

  subtasks.forEach((succ, si) => {
    if (!succ.visible) return;
    for (const predId of succ.dependsOn) {
      const pred = byId.get(predId);
      if (!pred || !pred.s.visible) continue;
      links.push({
        x1: pred.s.left + pred.s.width, // predecessor finish
        y1: pred.i * SUB_ROW_H + SUB_ROW_H / 2,
        x2: succ.left, // successor start
        y2: si * SUB_ROW_H + SUB_ROW_H / 2,
      });
    }
  });

  if (links.length === 0) return null;

  return (
    <svg
      style={{ position: "absolute", left: LEFT_W, top: 0, width: `calc(100% - ${LEFT_W}px)`, height: subtasks.length * SUB_ROW_H, pointerEvents: "none", zIndex: 2 }}
    >
      <defs>
        <marker id="dep-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={C.ink350} />
        </marker>
      </defs>
      {links.map((l, i) => (
        <g key={i} stroke={C.ink350} strokeWidth={1.2} fill="none">
          <line x1={`${l.x1}%`} y1={l.y1} x2={`${l.x2}%`} y2={l.y1} />
          <line x1={`${l.x2}%`} y1={l.y1} x2={`${l.x2}%`} y2={l.y2} markerEnd="url(#dep-arrow)" />
        </g>
      ))}
    </svg>
  );
}

/** Draggable project bar: drag the body to shift the whole project (start +
 *  deadline together), drag the right edge to move the deadline. */
function ProjectBar({ g, spanDays, onCommit }: { g: GanttRow; spanDays: number; onCommit: (id: number, patch: { start?: string; deadline?: string }) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ mode: "move" | "resize"; startX: number; dxDays: number; dpx: number } | null>(null);
  if (g.width <= 0) return null;

  const pctPerDay = 100 / spanDays;
  const begin = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const w = ref.current?.parentElement?.getBoundingClientRect().width ?? 1;
    ref.current?.setPointerCapture(e.pointerId);
    setDrag({ mode, startX: e.clientX, dxDays: 0, dpx: spanDays / w });
  };
  const onMove = (e: React.PointerEvent) => { if (drag) setDrag({ ...drag, dxDays: Math.round((e.clientX - drag.startX) * drag.dpx) }); };
  const onUp = () => {
    if (!drag) return;
    const { mode, dxDays } = drag;
    setDrag(null);
    if (dxDays === 0) return;
    if (mode === "move") {
      const prev = { start: g.start, deadline: g.deadline };
      onCommit(g.id, { start: shiftISO(g.start, dxDays), deadline: shiftISO(g.deadline, dxDays) });
      toast({ message: `« ${g.name} » déplacé`, action: { label: "Annuler", onClick: () => onCommit(g.id, prev) } });
    } else {
      const minDeadline = shiftISO(g.start, 1);
      const next = shiftISO(g.deadline, dxDays);
      const prev = { deadline: g.deadline };
      onCommit(g.id, { deadline: next < minDeadline ? minDeadline : next });
      toast({ message: `Échéance de « ${g.name} » modifiée`, action: { label: "Annuler", onClick: () => onCommit(g.id, prev) } });
    }
  };
  const left = g.left + (drag?.mode === "move" ? drag.dxDays * pctPerDay : 0);
  const width = Math.max(0.6, g.width + (drag?.mode === "resize" ? drag.dxDays * pctPerDay : 0));
  const pStart = shiftISO(g.start, drag?.mode === "move" ? drag.dxDays : 0);
  const pEnd = shiftISO(g.deadline, drag ? drag.dxDays : 0);

  return (
    <div
      ref={ref}
      className="gantt-bar"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={begin("move")}
      onPointerMove={onMove}
      onPointerUp={onUp}
      title={`${g.name} — glisser pour déplacer · bord droit pour l'échéance`}
      style={{
        position: "absolute", top: (PROJ_ROW_H - 18) / 2, height: 18, borderRadius: R.xs, left: `${left}%`, width: `${width}%`, minWidth: 12,
        background: `${g.color}14`, border: `1px solid ${g.color}40`, overflow: "visible",
        cursor: drag ? "grabbing" : "grab", touchAction: "none", boxShadow: drag ? SH.md : undefined, zIndex: drag ? 5 : undefined,
      }}
    >
      <div style={{ position: "absolute", inset: 0, width: `${g.fill}%`, background: g.color, opacity: 0.9, borderRadius: `${R.xs}px 0 0 ${R.xs}px` }} />
      <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontFamily: FONT_NUM, fontSize: 10.5, fontWeight: 600, color: g.fill > 55 ? "#fff" : C.ink700 }}>
        {g.progress}%
      </span>
      {drag ? <DatePill text={drag.mode === "move" ? `${fmtShort(pStart)} → ${fmtShort(pEnd)}` : fmtShort(pEnd)} /> : null}
      <div onPointerDown={begin("resize")} style={{ position: "absolute", right: -3, top: 0, bottom: 0, width: 14, cursor: "ew-resize" }} />
    </div>
  );
}

/** Floating date readout shown above a bar while dragging. */
function DatePill({ text }: { text: string }) {
  return (
    <span style={{ position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", ...TX.nano, fontWeight: 600, color: "#fff", background: C.ink900, borderRadius: R.xs, padding: "2px 7px", whiteSpace: "nowrap", pointerEvents: "none", boxShadow: SH.sm }}>
      {text}
    </span>
  );
}

/** Draggable task bar: drag the body to move the start, drag the right edge to
 *  resize the planned duration. Live %-preview while dragging, commit on release. */
function SubtaskBar({ projectId, s, spanDays, onCommit }: { projectId: number; s: GanttBar; spanDays: number; onCommit: (projectId: number, subtaskId: number, patch: SubtaskPatch) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ mode: "move" | "resize"; startX: number; dxDays: number; dpx: number } | null>(null);
  if (!s.visible) return null;

  const pctPerDay = 100 / spanDays;

  const begin = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const timeline = ref.current?.parentElement;
    const w = timeline?.getBoundingClientRect().width ?? 1;
    ref.current?.setPointerCapture(e.pointerId);
    setDrag({ mode, startX: e.clientX, dxDays: 0, dpx: spanDays / w });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dxDays: Math.round((e.clientX - drag.startX) * drag.dpx) });
  };
  const onUp = () => {
    if (!drag) return;
    const { mode, dxDays } = drag;
    setDrag(null);
    if (dxDays === 0) return;
    if (mode === "move") {
      const prev = { start: s.start };
      onCommit(projectId, s.id, { start: shiftISO(s.start, dxDays) });
      toast({ message: `« ${s.name} » déplacée`, action: { label: "Annuler", onClick: () => onCommit(projectId, s.id, prev) } });
    } else {
      const newEnd = shiftISO(s.end, dxDays);
      const prev = { plannedDays: s.plannedDays };
      onCommit(projectId, s.id, { plannedDays: Math.max(1, workingDaysBetween(s.start, newEnd)) });
      toast({ message: `Durée de « ${s.name} » modifiée`, action: { label: "Annuler", onClick: () => onCommit(projectId, s.id, prev) } });
    }
  };

  const left = s.left + (drag?.mode === "move" ? drag.dxDays * pctPerDay : 0);
  const width = Math.max(0.8, s.width + (drag?.mode === "resize" ? drag.dxDays * pctPerDay : 0));
  const pStart = shiftISO(s.start, drag?.mode === "move" ? drag.dxDays : 0);
  const pDays = Math.max(1, workingDaysBetween(s.start, shiftISO(s.end, drag?.mode === "resize" ? drag.dxDays : 0)));

  return (
    <div
      ref={ref}
      className="gantt-bar"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={begin("move")}
      onPointerMove={onMove}
      onPointerUp={onUp}
      title={`${s.name} — glisser pour déplacer · bord droit pour la durée`}
      style={{
        position: "absolute", top: SUB_ROW_H / 2 - 6, height: 12, borderRadius: R.xs,
        left: `${left}%`, width: `${width}%`, minWidth: 8, background: s.color, opacity: s.done ? 0.5 : 0.95,
        cursor: drag ? "grabbing" : "grab", touchAction: "none", boxShadow: drag ? SH.md : undefined, zIndex: drag ? 5 : undefined,
      }}
    >
      {drag ? <DatePill text={drag.mode === "move" ? fmtShort(pStart) : `${pDays} j`} /> : null}
      <div
        onPointerDown={begin("resize")}
        style={{ position: "absolute", right: -3, top: 0, bottom: 0, width: 14, cursor: "ew-resize" }}
      />
    </div>
  );
}

function GridLines({ months }: { months: { left: number }[] }) {
  return (
    <>
      {months.map((m, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${m.left}%`, borderLeft: `1px solid ${C.line}` }} />
      ))}
    </>
  );
}

function TodayLine({ left, label }: { left: number; label?: boolean }) {
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: C.brand, left: `${left}%`, zIndex: 3, pointerEvents: "none" }}>
      {label ? (
        <span style={{ position: "absolute", top: 4, left: 3, ...TX.nano, fontWeight: 600, color: "#fff", background: C.brand, borderRadius: R.xxs, padding: "0 4px", whiteSpace: "nowrap" }}>Auj.</span>
      ) : null}
    </div>
  );
}
