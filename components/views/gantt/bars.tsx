"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";

import { type GanttBar, type GanttRow } from "@/lib/derive";
import { fmtShort, shiftISO, workingDaysBetween } from "@/lib/format";
import type { SubtaskPatch } from "@/lib/data/repository";
import { toast } from "@/lib/toast";
import { C, FONT_NUM, R, SH, SPRING, TX } from "@/lib/tokens";
import { BAR_TRACK, CP_RING, DONE_FILL, PROGRESS, PROJ_ROW_H, SUB_ROW_H, Z_ARROWS } from "./constants";
import { shiftWorkingDays, snapWeekday, workingDayDelta } from "./dates";

/** SVG overlay drawing Finish-to-Start connectors between a project's tasks with
 *  rounded-elbow 3-segment routing (stub-out / vertical / stub-in). Backward
 *  links (successor starts before predecessor finishes) get a dashed accent path.
 *  Hovering a link dims unrelated bars and highlights the pred/succ pair. */
export function DependencyArrows({ subtasks, leftW, timelineW, hoverDep, onHover }: { subtasks: GanttBar[]; leftW: number; timelineW: number; hoverDep: { pred: number; succ: number } | null; onHover: (link: { pred: number; succ: number } | null) => void }) {
  const byId = new Map(subtasks.map((s, i) => [s.id, { s, i }]));
  const pctToPx = timelineW / 100;
  const STUB = 9;
  const RADIUS = 5;

  type Link = { d: string; backward: boolean; pred: number; succ: number };
  const links: Link[] = [];

  subtasks.forEach((succ, si) => {
    if (!succ.visible) return;
    for (const predId of succ.dependsOn) {
      const pred = byId.get(predId);
      if (!pred || !pred.s.visible) continue;
      const x1 = (pred.s.left + pred.s.width) * pctToPx; // predecessor finish
      const y1 = pred.i * SUB_ROW_H + SUB_ROW_H / 2;
      const x2 = succ.left * pctToPx; // successor start
      const y2 = si * SUB_ROW_H + SUB_ROW_H / 2;
      const backward = x2 < x1 + STUB; // successor overlaps/precedes predecessor finish
      const down = y2 >= y1;
      const r = Math.min(RADIUS, Math.abs(y2 - y1) / 2 || RADIUS);

      let d: string;
      if (!backward) {
        // forward: stub-out → vertical (rounded elbows) → stub-in
        const mx = x2 - STUB;
        d = `M ${x1} ${y1} L ${mx - r} ${y1} Q ${mx} ${y1} ${mx} ${y1 + (down ? r : -r)} L ${mx} ${y2 - (down ? r : -r)} Q ${mx} ${y2} ${mx + r} ${y2} L ${x2} ${y2}`;
      } else {
        // backward: route out the predecessor's right, along the midline, back to the successor's left
        const outX = x1 + STUB;
        const inX = x2 - STUB;
        const my = (y1 + y2) / 2;
        d = `M ${x1} ${y1} L ${outX} ${y1} L ${outX} ${my} L ${inX} ${my} L ${inX} ${y2} L ${x2} ${y2}`;
      }
      links.push({ d, backward, pred: predId, succ: succ.id });
    }
  });

  if (links.length === 0) return null;

  return (
    <svg style={{ position: "absolute", left: leftW, top: 0, width: timelineW, height: subtasks.length * SUB_ROW_H, pointerEvents: "none", zIndex: Z_ARROWS, overflow: "visible" }}>
      <defs>
        {/* Quiet neutral arrowhead; a single slightly-darker head on hover. No red
            marker — a backward link is shown by a dash, not by an alarm colour. */}
        <marker id="dep-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={C.ink350} />
        </marker>
        <marker id="dep-arrow-hot" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={C.ink700} />
        </marker>
      </defs>
      {links.map((l, i) => {
        const hot = hoverDep != null && hoverDep.pred === l.pred && hoverDep.succ === l.succ;
        // Always neutral; hover lifts to a darker ink. Backward links read via the
        // dash pattern, never via colour (red is reserved for genuinely late).
        const stroke = hot ? C.ink700 : C.ink350;
        const marker = hot ? "dep-arrow-hot" : "dep-arrow";
        return (
          <g key={i}>
            {/* fat invisible hit path for hover */}
            <path d={l.d} stroke="transparent" strokeWidth={10} fill="none" style={{ pointerEvents: "stroke" }} onMouseEnter={() => onHover({ pred: l.pred, succ: l.succ })} onMouseLeave={() => onHover(null)} />
            <path d={l.d} stroke={stroke} strokeWidth={hot ? 1.8 : 1.2} strokeDasharray={l.backward ? "4 3" : undefined} fill="none" markerEnd={`url(#${marker})`} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

/** Floating date readout shown above a bar while dragging. */
function DatePill({ text }: { text: string }) {
  return (
    <span style={{ position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", ...TX.nano, fontWeight: 600, color: C.surface, background: C.ink900, borderRadius: R.xs, padding: "2px 7px", whiteSpace: "nowrap", pointerEvents: "none", boxShadow: SH.sm, zIndex: 10 }}>
      {text}
    </span>
  );
}

// ── Project bar ────────────────────────────────────────────────────────────────

export function ProjectBar({ g, spanDays, onCommit, onCommitTask, onLive, cp }: {
  g: GanttRow;
  spanDays: number;
  onCommit: (id: number, patch: { start?: string; deadline?: string }) => void;
  onCommitTask: (projectId: number, subtaskId: number, patch: SubtaskPatch) => void;
  onLive: (m: string) => void;
  cp: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ mode: "move" | "resize"; startX: number; dxDays: number; dpx: number } | null>(null);
  const [focused, setFocused] = useState(false);
  if (g.width <= 0) return null;

  const pctPerDay = 100 / spanDays;
  const begin = (mode: "move" | "resize", e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const w = ref.current?.parentElement?.getBoundingClientRect().width ?? 1;
    ref.current?.setPointerCapture(e.pointerId);
    setDrag({ mode, startX: e.clientX, dxDays: 0, dpx: spanDays / w });
  };
  const onMove = (e: React.PointerEvent) => { if (drag) setDrag({ ...drag, dxDays: Math.round((e.clientX - drag.startX) * drag.dpx) }); };
  const cancel = () => setDrag(null);

  /** Move the project by `dxDays` calendar days AND carry its tasks along by the
   *  same number of WORKING days (so the plan inside the envelope keeps its
   *  shape and never lands on a weekend). One undo restores everything. */
  const commitMove = (dxDays: number) => {
    const prev = { start: g.start, deadline: g.deadline };
    const newStart = shiftISO(g.start, dxDays);
    const wd = workingDayDelta(g.start, newStart);
    const taskPrev = g.subtasks.map((s) => ({ id: s.id, start: s.start }));
    onCommit(g.id, { start: newStart, deadline: shiftISO(g.deadline, dxDays) });
    if (wd !== 0) for (const s of g.subtasks) onCommitTask(g.id, s.id, { start: shiftWorkingDays(s.start, wd) });
    onLive(`« ${g.name} » déplacé au ${fmtShort(newStart)}${wd && g.subtasks.length ? ` · ${g.subtasks.length} tâche(s) décalée(s) de ${wd} j ouvré(s)` : ""}`);
    toast({
      message: `« ${g.name} » déplacé${wd && g.subtasks.length ? " avec ses tâches" : ""}`,
      action: {
        label: "Annuler",
        onClick: () => {
          onCommit(g.id, prev);
          if (wd !== 0) for (const t of taskPrev) onCommitTask(g.id, t.id, { start: t.start });
        },
      },
    });
  };
  const commitResize = (dxDays: number) => {
    const minDeadline = shiftISO(g.start, 1);
    const next = shiftISO(g.deadline, dxDays);
    const prev = { deadline: g.deadline };
    onCommit(g.id, { deadline: next < minDeadline ? minDeadline : next });
    onLive(`Échéance de « ${g.name} » modifiée`);
    toast({ message: `Échéance de « ${g.name} » modifiée`, action: { label: "Annuler", onClick: () => onCommit(g.id, prev) } });
  };

  const onUp = () => {
    if (!drag) return;
    const { mode, dxDays } = drag;
    setDrag(null);
    if (dxDays === 0) return;
    if (mode === "move") commitMove(dxDays); else commitResize(dxDays);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 7 : 1;
    if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); commitMove(step); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); commitMove(-step); }
  };

  const left = g.left + (drag?.mode === "move" ? drag.dxDays * pctPerDay : 0);
  // The floor is in PIXELS (CSS `minWidth` below), never a % of the window —
  // on a multi-year window even 0.6 % is several days wide.
  const width = Math.max(0, g.width + (drag?.mode === "resize" ? drag.dxDays * pctPerDay : 0));
  const pStart = shiftISO(g.start, drag?.mode === "move" ? drag.dxDays : 0);
  const pEnd = shiftISO(g.deadline, drag ? drag.dxDays : 0);

  return (
    <motion.div
      ref={ref}
      className="gantt-bar"
      tabIndex={0}
      role="slider"
      aria-label={`${g.name} — ${fmtShort(g.start)} au ${fmtShort(g.deadline)}. Flèches pour décaler avec ses tâches (Maj = 1 semaine).`}
      aria-valuetext={`${fmtShort(g.start)} → ${fmtShort(g.deadline)}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => begin("move", e)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      title={`${g.name} — glisser pour déplacer (avec ses tâches) · bord droit pour l'échéance`}
      animate={drag ? false : { left: `${left}%`, width: `${width}%` }}
      transition={SPRING.snappy}
      style={{
        // Light neutral track + GREEN progress fill (the one accent). Status is
        // carried by the pill in the left cell, so the bar stays mono otherwise.
        // Critical projects get ONE restrained ink hairline ring (the border) —
        // no black fill, no saturated tint; the ring carries criticality.
        position: "absolute", top: (PROJ_ROW_H - 20) / 2, height: 20, borderRadius: R.xs,
        ...(drag ? { left: `${left}%`, width: `${width}%` } : {}),
        minWidth: 12, background: BAR_TRACK,
        border: cp ? `1.5px solid ${CP_RING}` : `1px solid ${C.line}`, overflow: "visible",
        cursor: drag ? "grabbing" : "grab", touchAction: "none",
        boxShadow: drag ? SH.md : undefined, zIndex: drag ? 5 : 1,
        outline: focused ? `2px solid ${C.brand}` : "none", outlineOffset: 1,
      }}
    >
      <div style={{ position: "absolute", inset: 0, width: `${g.fill}%`, background: PROGRESS, borderRadius: `${R.xs}px 0 0 ${R.xs}px` }} />
      {/* % label: white on the green fill when filled enough to sit on it, ink otherwise. */}
      {/* C2: fill is now the SOFT data-green (light) — keep the % label dark ink
          for legibility on both the fill and the track (white would fail AA). */}
      {/* On a light halo so it stays legible over the (now darker, 3:1) fill. */}
      <span style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, color: C.ink700, background: "rgba(255,255,255,.85)", borderRadius: R.xs, padding: "0 3px", lineHeight: "15px" }}>
        {g.progress}&#8239;%
      </span>
      {drag ? <DatePill text={drag.mode === "move" ? `${fmtShort(pStart)} → ${fmtShort(pEnd)}` : fmtShort(pEnd)} /> : null}
      <div onPointerDown={(e) => begin("resize", e)} style={{ position: "absolute", right: -5, top: -4, bottom: -4, width: 18, cursor: "ew-resize", touchAction: "none" }} />
    </motion.div>
  );
}

// ── Subtask bar ──────────────────────────────────────────────────────────────

/** Smallest rendered task bar, in px — a 1-day task at the widest zoom-out
 *  stays visible and grabbable without overstating its duration. */
const MIN_SUB_BAR_PX = 5;

export function SubtaskBar({ projectId, s, timelineW, spanDays, pxPerDay, onCommit, onLive, dim }: { projectId: number; s: GanttBar; timelineW: number; spanDays: number; pxPerDay: number; onCommit: (projectId: number, subtaskId: number, patch: SubtaskPatch) => void; onLive: (m: string) => void; dim: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ mode: "move" | "resize"; startX: number; dxDays: number; dpx: number } | null>(null);
  const [focused, setFocused] = useState(false);
  if (!s.visible) return null;

  const pctPerDay = 100 / spanDays;

  const begin = (mode: "move" | "resize", e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const w = ref.current?.parentElement?.getBoundingClientRect().width ?? 1;
    ref.current?.setPointerCapture(e.pointerId);
    setDrag({ mode, startX: e.clientX, dxDays: 0, dpx: spanDays / w });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dxDays: Math.round((e.clientX - drag.startX) * drag.dpx) });
  };
  const cancel = () => setDrag(null);

  /** Tasks start on working days: a drag snaps off a weekend in the drag
   *  direction; the keyboard steps in working days. */
  const moveTo = (newStart: string) => {
    if (newStart === s.start) return;
    const prev = { start: s.start };
    onCommit(projectId, s.id, { start: newStart });
    onLive(`« ${s.name} » déplacée au ${fmtShort(newStart)}`);
    toast({ message: `« ${s.name} » déplacée`, action: { label: "Annuler", onClick: () => onCommit(projectId, s.id, prev) } });
  };
  const commitMove = (dxDays: number) => moveTo(snapWeekday(shiftISO(s.start, dxDays), dxDays >= 0 ? 1 : -1));
  const commitResize = (dxDays: number) => {
    const newEnd = shiftISO(s.end, dxDays);
    const prev = { plannedDays: s.plannedDays };
    const days = Math.max(1, workingDaysBetween(s.start, newEnd));
    onCommit(projectId, s.id, { plannedDays: days });
    onLive(`Durée de « ${s.name} » : ${days} jours`);
    toast({ message: `Durée de « ${s.name} » modifiée`, action: { label: "Annuler", onClick: () => onCommit(projectId, s.id, prev) } });
  };

  const onUp = () => {
    if (!drag) return;
    const { mode, dxDays } = drag;
    setDrag(null);
    if (dxDays === 0) return;
    if (mode === "move") commitMove(dxDays); else commitResize(dxDays);
  };

  // ←/→ = 1 working day, Maj = 5 working days (one working week) — never a
  // Saturday/Sunday start.
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); moveTo(shiftWorkingDays(s.start, step)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); moveTo(shiftWorkingDays(s.start, -step)); }
  };

  const left = s.left + (drag?.mode === "move" ? drag.dxDays * pctPerDay : 0);
  // Width = the inclusive working span exactly; only a tiny PIXEL floor
  // (MIN_SUB_BAR_PX, applied as CSS `minWidth`) keeps a sub-day bar grabbable.
  // A %-based floor scaled with the window (0.8 % ≈ 9 days on a 3-year plan).
  const width = Math.max(0, s.width + (drag?.mode === "resize" ? drag.dxDays * pctPerDay : 0));
  const pStart = shiftISO(s.start, drag?.mode === "move" ? drag.dxDays : 0);
  const pDays = Math.max(1, workingDaysBetween(s.start, shiftISO(s.end, drag?.mode === "resize" ? drag.dxDays : 0)));

  // Bar fill follows the unified language: active/not-done = GREEN (the one
  // accent); done = a RECEDED neutral so it sits back (kept legible by the check
  // + hatch). NO near-black fill. Criticality is NOT a fill — it's the one ink
  // hairline ring applied below. NOT danger red — that means "late".
  const critical = s.onCriticalPath && !s.done;
  const barFill = s.done ? DONE_FILL : PROGRESS;
  const critTitle = s.onCriticalPath ? " · chemin critique (marge nulle)" : s.float > 0 ? ` · marge ${s.float} j` : "";
  const labelOutside = left * (timelineW / 100) + Math.max(MIN_SUB_BAR_PX, width * (timelineW / 100)) + 8; // px from timeline start for the trailing name
  const showLabel = pxPerDay >= 4 && !drag;
  const showFloatNum = s.float > 0 && s.floatWidth > 0 && !s.done && pxPerDay >= 5;

  return (
    <div style={{ opacity: dim ? 0.35 : 1, transition: "opacity var(--dur-fast) var(--ease-standard)" }}>
      {/* float ghost — faint trailing extension showing schedule slack */}
      {s.float > 0 && s.floatWidth > 0 && !s.done ? (
        <div
          aria-hidden
          style={{
            position: "absolute", top: SUB_ROW_H / 2 - 7, height: 14, borderRadius: R.xs,
            left: `${s.left + s.width}%`, width: `${s.floatWidth}%`, minWidth: 4,
            background: `repeating-linear-gradient(90deg, ${C.ink350}55 0 3px, transparent 3px 6px)`,
            border: `1px dashed ${C.ink350}`, pointerEvents: "none", opacity: drag ? 0.4 : 0.9,
            display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 3,
          }}
        >
          {showFloatNum ? (
            <span style={{ fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, color: C.ink500 }}>+{s.float}j</span>
          ) : null}
        </div>
      ) : null}

      <motion.div
        ref={ref}
        className="gantt-bar"
        tabIndex={0}
        role="slider"
        aria-label={`${s.name} — ${fmtShort(s.start)}, ${s.plannedDays} jours${critTitle}. Flèches pour décaler d’un jour ouvré (Maj = 5 jours ouvrés).`}
        aria-valuetext={`${fmtShort(s.start)} → ${fmtShort(s.end)}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => begin("move", e)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        title={`${s.name} — glisser pour déplacer · bord droit pour la durée${critTitle}`}
        animate={drag ? false : { left: `${left}%`, width: `${width}%` }}
        transition={SPRING.snappy}
        style={{
          position: "absolute", top: SUB_ROW_H / 2 - 8, height: 16, borderRadius: R.xs,
          ...(drag ? { left: `${left}%`, width: `${width}%` } : {}),
          minWidth: MIN_SUB_BAR_PX, background: barFill, opacity: s.done ? 0.7 : 1,
          // done = diagonal hatch overlay (non-opacity cue, so done recedes without
          // relying on opacity alone); critical = ONE ink hairline ring as a border
          // (NOT a box-shadow — that's reserved for the .gantt-bar:hover ring, which
          // would otherwise be overridden by an inline shadow on critical bars).
          backgroundImage: s.done ? `repeating-linear-gradient(45deg, ${C.surface}99 0 2px, transparent 2px 5px)` : undefined,
          border: critical ? `1.5px solid ${CP_RING}` : undefined,
          boxShadow: drag ? SH.md : undefined,
          cursor: drag ? "grabbing" : "grab", touchAction: "none", zIndex: drag ? 5 : critical ? 3 : 1,
          outline: focused ? `2px solid ${C.brand}` : "none", outlineOffset: 1,
        }}
      >
        {/* done checkmark — ink on the light neutral done fill for legibility */}
        {s.done ? (
          <span style={{ position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)", color: C.ink700, lineHeight: 0 }}>
            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          </span>
        ) : null}
        {drag ? <DatePill text={drag.mode === "move" ? fmtShort(pStart) : `${pDays} j`} /> : null}
        <div onPointerDown={(e) => begin("resize", e)} style={{ position: "absolute", right: -5, top: -4, bottom: -4, width: 18, cursor: "ew-resize", touchAction: "none" }} />
      </motion.div>

      {/* subtask name beside the bar */}
      {showLabel ? (
        <span
          aria-hidden
          style={{
            position: "absolute", top: SUB_ROW_H / 2, transform: "translateY(-50%)", left: labelOutside,
            ...TX.nano, color: critical ? C.ink900 : C.ink500, fontWeight: critical ? 600 : 500,
            whiteSpace: "nowrap", pointerEvents: "none", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {s.name}
        </span>
      ) : null}
    </div>
  );
}
