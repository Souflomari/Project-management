"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { FilterBar } from "../filter-bar";
import { ChevronRightIcon } from "../icons";
import { Popover } from "../overlay/popover";
import { Avatar, Button, EmptyState, Segmented, StatusPill } from "../ui";
import { buildGantt, type GanttBar, type GanttRow } from "@/lib/derive";
import { fmtShort, shiftISO, toDate, workingDaysBetween } from "@/lib/format";
import type { SubtaskPatch } from "@/lib/data/repository";
import { useProjects } from "@/lib/store/projects-context";
import { toast } from "@/lib/toast";
import { C, FONT_NUM, R, SH, SPRING, SURFACE, TX } from "@/lib/tokens";

const PROJ_ROW_H = 48;
const SUB_ROW_H = 30;
const HEADER_H = 48; // two-tier sticky header — airy two-row rhythm
const MIN_LEFT_W = 240;
const MAX_LEFT_W = 560;

// ── Calendar-day helpers (DST-proof: dates are built from y/m/d, never from
//    "start + i × 24h", which drifts an hour — or a day — across DST changes).
const dayIndex = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isWeekendISO = (iso: string) => { const g = toDate(iso).getDay(); return g === 0 || g === 6; };

/** Move to the nearest weekday in `dir` when `iso` falls on a weekend. */
function snapWeekday(iso: string, dir: 1 | -1): string {
  let cur = iso;
  while (isWeekendISO(cur)) cur = shiftISO(cur, dir);
  return cur;
}

/** Shift by `n` WORKING days (Sat/Sun skipped). */
function shiftWorkingDays(iso: string, n: number): string {
  const dir = n >= 0 ? 1 : -1;
  let cur = snapWeekday(iso, dir as 1 | -1);
  for (let left = Math.abs(n); left > 0; ) {
    cur = shiftISO(cur, dir);
    if (!isWeekendISO(cur)) left--;
  }
  return cur;
}

/** Signed number of working days from `from` to `to` (0 when equal). */
function workingDayDelta(from: string, to: string): number {
  if (to === from) return 0;
  return to > from ? workingDaysBetween(shiftISO(from, 1), to) : -workingDaysBetween(shiftISO(to, 1), from);
}

// Unified colour system: GREEN (C.brand) is the SINGLE accent — brand + progress
// + active/healthy. Everything else is warm neutral (tracks, structure). Assignee
// identity is carried by the left-cell avatar, so bars stay mono: a light neutral
// track with a green progress fill. No per-person rainbow, no near-black fill.
const BAR_TRACK = "var(--data-track)"; // unfilled remainder / resting track (soft data track, C2)
const PROGRESS = "var(--data-fill)"; // soft data-viz green fill (C2 — repeated bars use the tinted-down green, not full accent)
const DONE_FILL = C.ink300; // "done" recedes to a receded neutral (+ check + hatch)

// Critical-path treatment: criticality is STRUCTURAL, carried by ONE restrained
// ink hairline ring — never by a black fill or a saturated colour. The fill stays
// green/neutral per the rules above (green = active); the ring marks "on the
// critical path" without competing with the green-means-progress language or the
// red-means-late semantics.
const CP_RING = C.ink900;

type Zoom = "fit" | "trimestre" | "mois" | "semaine" | "jour";
type ColKey = "debut" | "fin" | "duree" | "marge" | "avancement";

const ZOOM_PX: Record<Exclude<Zoom, "fit">, number> = {
  trimestre: 2.6,
  mois: 6,
  semaine: 13,
  jour: 34,
};

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "debut", label: "Début" },
  { key: "fin", label: "Fin" },
  { key: "duree", label: "Durée" },
  { key: "marge", label: "Marge" },
  { key: "avancement", label: "Avanc." },
];

// ── Axis tick model ──────────────────────────────────────────────────────────
// derive only hands us month bands (in %). For the two-tier header, weekend
// shading and week labels we recompute calendar ticks locally from windowStart +
// spanDays, mapping every tick to a pixel offset on the timeline.
interface Tick {
  px: number;
  w: number;
  label: string;
  major?: boolean;
}
interface Axis {
  top: Tick[]; // year / quarter
  bottom: Tick[]; // month / week
  weekends: { px: number; w: number }[];
  weekLines: number[];
}

const MONS = ["jan", "fév", "mar", "avr", "mai", "jun", "jui", "aoû", "sep", "oct", "nov", "déc"];

function buildAxis(windowStart: string, spanDays: number, pxPerDay: number, zoom: Zoom): Axis {
  const start = toDate(windowStart);
  const start0 = dayIndex(start);
  const top: Tick[] = [];
  const bottom: Tick[] = [];
  const weekends: { px: number; w: number }[] = [];
  const weekLines: number[] = [];

  const dayPx = (d: Date) => (dayIndex(d) - start0) * pxPerDay;
  const end = addDays(start, spanDays);
  const weekZoom = zoom === "semaine" || zoom === "jour";

  // Weekend bands + week gridlines (calendar Saturdays/Sundays).
  for (let i = 0; i < spanDays; i++) {
    const dow = addDays(start, i).getDay(); // 0 Sun … 6 Sat
    if (dow === 6 || dow === 0) weekends.push({ px: i * pxPerDay, w: pxPerDay });
    if (dow === 1) weekLines.push(i * pxPerDay); // Monday
  }

  const months = (stepMonths: number, first: Date, label: (d: Date) => string, major: (d: Date) => boolean) => {
    const out: Tick[] = [];
    for (let cur = first; cur < end; ) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + stepMonths, 1);
      out.push({ px: dayPx(cur), w: dayPx(next) - dayPx(cur), label: label(cur), major: major(cur) });
      cur = next;
    }
    return out;
  };

  // ── bottom tier ──
  if (weekZoom) {
    // weeks from the first Monday on/after the window start
    const off = (8 - start.getDay()) % 7; // days to next Monday (0 if Monday)
    for (let cur = addDays(start, off); cur < end; cur = addDays(cur, 7)) {
      bottom.push({ px: dayPx(cur), w: 7 * pxPerDay, label: `${cur.getDate()} ${MONS[cur.getMonth()]}` });
    }
  } else {
    bottom.push(...months(1, new Date(start.getFullYear(), start.getMonth(), 1), (d) => MONS[d.getMonth()], () => false));
  }

  // ── top tier ──
  if (weekZoom) {
    top.push(...months(1, new Date(start.getFullYear(), start.getMonth(), 1), (d) => `${MONS[d.getMonth()]} ${d.getFullYear()}`, (d) => d.getMonth() === 0));
  } else {
    top.push(...months(3, new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1), (d) => `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`, (d) => d.getMonth() === 0));
  }

  return { top, bottom, weekends, weekLines };
}

function Legend() {
  const item = { display: "flex", alignItems: "center", gap: 5 } as const;
  const swatch = { width: 14, height: 8, borderRadius: 6, flexShrink: 0 } as const;
  return (
    <span style={{ ...TX.nano, color: C.ink500, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {/* avancement = the green progress fill on its light neutral track (mirrors a bar). */}
      <span style={item}>
        <span style={{ ...swatch, background: BAR_TRACK, border: `1px solid ${C.line}`, overflow: "hidden", position: "relative" }}>
          <span style={{ position: "absolute", inset: 0, width: "60%", background: PROGRESS }} />
        </span>
        avancement
      </span>
      {/* chemin critique = a neutral bar carried by the ONE ink hairline ring (no fill colour). */}
      <span style={item}>
        <span style={{ ...swatch, background: BAR_TRACK, border: `1.5px solid ${CP_RING}` }} />
        chemin critique
      </span>
      {/* marge = the dashed ghost extension (mirrors the float ghost exactly). */}
      <span style={item}>
        <span style={{ ...swatch, background: `repeating-linear-gradient(90deg, ${C.ink350}55 0 3px, transparent 3px 6px)`, border: `1px dashed ${C.ink350}` }} />
        marge
      </span>
    </span>
  );
}

export function PlanningGantt() {
  const { filtered, openProject, updateSubtask, updateProject, resetFilters } = useProjects();
  const { rows, todayLeft, spanDays, windowStart } = useMemo(() => buildGantt(filtered), [filtered]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Only "scrolled past the start?" matters (left fade cue) — a boolean, so a
  // scroll does not re-render every bar on every frame.
  const [scrolledX, setScrolledX] = useState(false);
  const [zoom, setZoom] = useState<Zoom>("mois");
  const [fitPx, setFitPx] = useState(6);
  const [leftW, setLeftW] = useState(324);
  const [cols, setCols] = useState<Set<ColKey>>(new Set<ColKey>(["avancement"]));
  const [colsOpen, setColsOpen] = useState(false);
  const colsBtn = useRef<HTMLButtonElement>(null);
  const [hoverDep, setHoverDep] = useState<{ pred: number; succ: number } | null>(null);
  const [live, setLive] = useState("");

  const scroller = useRef<HTMLDivElement>(null);

  // px-per-day drives the timeline width. "fit" derives it from the visible width
  // so the whole portfolio is shown at once.
  const zoomPx = zoom === "fit" ? fitPx : ZOOM_PX[zoom];
  const timelineW = Math.max(900, Math.round(spanDays * zoomPx));
  // Bars are laid out in % of timelineW; when the 900px floor kicks in the real
  // scale is wider than the zoom's nominal px/day. Derive it from the timeline
  // so the axis, weekend bands and bars share ONE scale (no header drift).
  const pxPerDay = spanDays > 0 ? timelineW / spanDays : zoomPx;
  const todayPx = (todayLeft / 100) * timelineW;

  const axis = useMemo(() => buildAxis(windowStart, spanDays, pxPerDay, zoom), [windowStart, spanDays, pxPerDay, zoom]);

  // ── Fit zoom: recompute pxPerDay from the scroller width ──
  const recomputeFit = useCallback(() => {
    const sc = scroller.current;
    if (!sc || sc.clientWidth <= 0) return;
    const usable = sc.clientWidth - leftW - 24;
    if (usable > 0 && spanDays > 0) setFitPx(Math.max(1.2, usable / spanDays));
  }, [leftW, spanDays]);

  useEffect(() => {
    if (zoom !== "fit") return;
    recomputeFit();
    const ro = new ResizeObserver(recomputeFit);
    if (scroller.current) ro.observe(scroller.current);
    return () => ro.disconnect();
  }, [zoom, recomputeFit]);

  const scrollToToday = useCallback(
    (smooth = true) => {
      const sc = scroller.current;
      if (!sc) return;
      sc.scrollTo({ left: Math.max(0, leftW + todayPx - sc.clientWidth / 2), behavior: smooth ? "smooth" : "auto" });
    },
    [leftW, todayPx],
  );

  // Center on "today" on first paint / when zoom changes (skip for fit — it shows
  // everything). Retry on rAF until the scroller has measured its width.
  const scrollToTodayRef = useRef(scrollToToday);
  useLayoutEffect(() => { scrollToTodayRef.current = scrollToToday; });
  useLayoutEffect(() => {
    if (zoom === "fit") return;
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      const sc = scroller.current;
      if (sc && sc.clientWidth > 0) {
        scrollToTodayRef.current(false);
        return;
      }
      if (tries++ < 20) raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [zoom]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const expandAll = () => setExpanded(new Set(rows.map((r) => r.id)));
  const collapseAll = () => setExpanded(new Set());

  const toggleCol = (k: ColKey) =>
    setCols((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  // ── drag-to-pan ──
  const pan = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
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
  const clickGuard = (fn: () => void) => () => {
    if (pan.current.moved) {
      pan.current.moved = false;
      return;
    }
    fn();
  };

  // ── Ctrl/⌘-scroll to zoom toward cursor ──
  // React's onWheel is PASSIVE, so preventDefault() there can't stop the
  // browser's own page zoom. A native non-passive listener can.
  const wheelState = useRef({ zoom, pxPerDay, leftW, spanDays });
  useLayoutEffect(() => { wheelState.current = { zoom, pxPerDay, leftW, spanDays }; });
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const { zoom: z, pxPerDay: px, leftW: lw, spanDays: span } = wheelState.current;
      const order: Exclude<Zoom, "fit">[] = ["trimestre", "mois", "semaine", "jour"];
      const cur: Exclude<Zoom, "fit"> = z === "fit" ? "mois" : z;
      let i = order.indexOf(cur);
      i = e.deltaY < 0 ? Math.min(order.length - 1, i + 1) : Math.max(0, i - 1);
      const nextZoom = order[i];
      if (nextZoom === z) return;
      // keep the day under the cursor stable after the zoom change
      const rect = sc.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const dayAtCursor = (sc.scrollLeft + cursorX - lw) / px;
      const nextPx = span > 0 ? Math.max(900, Math.round(span * ZOOM_PX[nextZoom])) / span : ZOOM_PX[nextZoom];
      setZoom(nextZoom);
      requestAnimationFrame(() => { sc.scrollLeft = lw + dayAtCursor * nextPx - (cursorX - lw); });
    };
    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => sc.removeEventListener("wheel", onWheel);
  }, [rows.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- (re)bind when the scroller mounts; live values come from wheelState

  // ── left-panel resize ──
  const resizing = useRef(false);
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    resizing.current = true;
    const move = (ev: PointerEvent) => {
      if (!resizing.current || !scroller.current) return;
      const rect = scroller.current.getBoundingClientRect();
      const w = ev.clientX - rect.left + scroller.current.scrollLeft;
      setLeftW(Math.max(MIN_LEFT_W, Math.min(MAX_LEFT_W, w)));
    };
    const up = () => {
      resizing.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const allOpen = rows.length > 0 && rows.every((r) => expanded.has(r.id));

  return (
    <>
      <FilterBar
        trailing={
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Legend />
            <Button variant="secondary" size="sm" onClick={allOpen ? collapseAll : expandAll}>
              {allOpen ? "Tout replier" : "Tout déplier"}
            </Button>
            <div style={{ position: "relative" }}>
              <Button ref={colsBtn} variant="secondary" size="sm" aria-haspopup="dialog" aria-expanded={colsOpen} onClick={() => setColsOpen((o) => !o)}>Colonnes</Button>
              <Popover open={colsOpen} onClose={() => setColsOpen(false)} anchorRef={colsBtn} role="dialog" label="Colonnes affichées" minWidth={160} align="end" padding={8}>
                {ALL_COLS.map((c) => (
                  <label key={c.key} className="soft-hover" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", cursor: "pointer", ...TX.caption, color: C.ink700, borderRadius: R.xs }}>
                    <input type="checkbox" checked={cols.has(c.key)} onChange={() => toggleCol(c.key)} />
                    {c.label}
                  </label>
                ))}
              </Popover>
            </div>
            <Button variant="secondary" size="sm" onClick={() => scrollToToday()}>Aujourd&rsquo;hui</Button>
            {/* hairline chunk-break: view actions | zoom (Hick + Gestalt grouping) */}
            <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: C.line, margin: "2px 0" }} />
            <Segmented
              value={zoom}
              onChange={setZoom}
              aria-label="Échelle du planning"
              options={[
                { value: "fit", label: "Tout afficher" },
                { value: "trimestre", label: "Trimestre" },
                { value: "mois", label: "Mois" },
                { value: "semaine", label: "Semaine" },
                { value: "jour", label: "Jour" },
              ]}
            />
          </div>
        }
      />

      <div aria-live="polite" className="sr-only">{live}</div>

      {rows.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SH.sm }}>
          <EmptyState
            title="Aucun projet à planifier"
            hint="Aucun projet ne correspond aux filtres actifs. Réinitialisez-les pour revoir le portefeuille."
            action={<Button variant="secondary" size="sm" onClick={resetFilters}>Réinitialiser les filtres</Button>}
          />
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div
            ref={scroller}
            className="pan"
            tabIndex={0}
            aria-label="Diagramme de Gantt — défilable. Ctrl + molette pour zoomer."
            onScroll={(e) => setScrolledX(e.currentTarget.scrollLeft > 4)}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={endPan}
            onMouseLeave={endPan}
            style={{
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: R.lg,
              boxShadow: SH.sm,
              overflow: "auto",
              maxHeight: "calc(100dvh - 215px)",
              position: "relative",
            }}
          >
            <div style={{ minWidth: leftW + timelineW, position: "relative" }}>
              {/* Single chart-wide background layer: weekend bands + week/today lines.
                  Drawn once (perf) behind every row instead of per-row gradients. */}
              <ChartBackground leftW={leftW} timelineW={timelineW} axis={axis} todayPx={todayPx} topOffset={HEADER_H} />

              {/* two-tier sticky header */}
              <AxisHeader leftW={leftW} timelineW={timelineW} axis={axis} todayPx={todayPx} onResize={startResize} />

              {/* rows */}
              {rows.map((g) => {
                const isOpen = expanded.has(g.id);
                const cpCount = g.subtasks.filter((s) => s.onCriticalPath && !s.done).length;
                return (
                  <div key={g.id}>
                    {/* The whole row toggles on click (mouse convenience); keyboard
                        and AT use the explicit disclosure button in the left
                        cell — the row itself is NOT a role=button, since it
                        contains focusable bars (no nested interactive). */}
                    <div
                      onClick={clickGuard(() => toggle(g.id))}
                      className="row-hover"
                      style={{ display: "flex", borderTop: `1px solid ${C.line}`, cursor: "pointer", background: isOpen ? `${C.subtle}cc` : "transparent" }}
                    >
                      <ProjectLeftCell g={g} isOpen={isOpen} leftW={leftW} cols={cols} cpCount={cpCount} onToggle={() => toggle(g.id)} />
                      <div style={{ flex: 1, position: "relative", height: PROJ_ROW_H }}>
                        <ProjectBar g={g} spanDays={spanDays} onCommit={updateProject} onCommitTask={updateSubtask} onLive={setLive} cp={cpCount > 0} />
                      </div>
                    </div>

                    {/* subtasks + dependency arrows (animated height) */}
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          key="body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={SPRING.gentle}
                          style={{ position: "relative", overflow: "hidden" }}
                        >
                          {g.subtasks.map((s) => (
                            <div
                              key={s.id}
                              onClick={clickGuard(() => openProject(g.id))}
                              className="soft-hover"
                              style={{ display: "flex", borderTop: `1px solid ${C.subtle}`, cursor: "pointer", height: SUB_ROW_H }}
                            >
                              <SubtaskLeftCell s={s} leftW={leftW} cols={cols} />
                              <div style={{ flex: 1, position: "relative" }}>
                                <SubtaskBar
                                  projectId={g.id}
                                  s={s}
                                  timelineW={timelineW}
                                  spanDays={spanDays}
                                  pxPerDay={pxPerDay}
                                  onCommit={updateSubtask}
                                  onLive={setLive}
                                  // Hovering a link highlights exactly its two ends
                                  // (predecessor + successor) and dims the rest.
                                  dim={hoverDep != null && hoverDep.pred !== s.id && hoverDep.succ !== s.id}
                                />
                              </div>
                            </div>
                          ))}
                          <DependencyArrows subtasks={g.subtasks} leftW={leftW} timelineW={timelineW} hoverDep={hoverDep} onHover={setHoverDep} />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* horizontal scroll cues */}
          <div style={{ position: "absolute", top: 1, right: 1, bottom: 1, width: 36, pointerEvents: "none", background: `linear-gradient(to right, rgba(255,255,255,0), ${C.surface})`, borderRadius: `0 ${R.lg - 1}px ${R.lg - 1}px 0` }} />
          {scrolledX ? (
            <div style={{ position: "absolute", top: 1, left: leftW + 1, bottom: 1, width: 28, pointerEvents: "none", background: `linear-gradient(to left, rgba(255,255,255,0), ${C.surface})` }} />
          ) : null}
        </div>
      )}
    </>
  );
}

// ── Left-panel cells ─────────────────────────────────────────────────────────

function colCells(cols: Set<ColKey>, vals: Partial<Record<ColKey, string>>) {
  return ALL_COLS.filter((c) => cols.has(c.key)).map((c) => (
    <span key={c.key} style={{ width: 56, flexShrink: 0, textAlign: "right", fontFamily: FONT_NUM, fontSize: 12, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden" }}>
      {vals[c.key] ?? "—"}
    </span>
  ));
}

function ProjectLeftCell({ g, isOpen, leftW, cols, cpCount, onToggle }: { g: GanttRow; isOpen: boolean; leftW: number; cols: Set<ColKey>; cpCount: number; onToggle: () => void }) {
  return (
    <div
      style={{
        width: leftW, flexShrink: 0, padding: "8px 12px 8px 14px", position: "sticky", left: 0,
        background: isOpen ? C.subtle : C.surface, borderRight: `1px solid ${C.line}`, minWidth: 0,
        display: "flex", gap: 9, alignItems: "center", zIndex: 2,
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={`${g.name} — ${isOpen ? "replier" : "déplier"} les tâches`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="btn"
        style={{ color: C.ink500, display: "flex", flexShrink: 0, padding: 3, margin: -3, border: "none", background: "transparent", borderRadius: R.xs, cursor: "pointer" }}
      >
        <span style={{ display: "flex", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform var(--dur-fast) var(--ease-standard)" }}><ChevronRightIcon size={14} /></span>
      </button>
      <Avatar initials={g.responsableInitials} color={g.responsableColor} size={28} fontSize={12} title={`${g.responsable} · ${g.responsableRole}`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...TX.bodyStrong, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
          {g.name}
          {!isOpen && cpCount > 0 ? (
            // Collapsed CP hint — quiet tinted chip (no second hard border); the
            // bar's ring is the primary CP signal, this just surfaces it on a
            // folded row.
            <span title={`${cpCount} tâche(s) sur le chemin critique`} style={{ ...TX.nano, fontWeight: 600, color: C.ink700, background: C.subtle, boxShadow: `inset 0 0 0 1px ${CP_RING}`, borderRadius: R.xxs, padding: "0 5px", lineHeight: "15px", flexShrink: 0 }}>CC</span>
          ) : null}
        </div>
        <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {g.client} · {g.discipline}
        </div>
      </div>
      {colCells(cols, { debut: fmtShort(g.start), fin: fmtShort(g.deadline), avancement: `${g.progress} %` })}
      <StatusPill color={g.statusColor} bg={g.statusBg} label={g.statusLabel} filled />
    </div>
  );
}

function SubtaskLeftCell({ s, leftW, cols }: { s: GanttBar; leftW: number; cols: Set<ColKey> }) {
  return (
    <div
      style={{
        width: leftW, flexShrink: 0, padding: "0 12px 0 37px", position: "sticky", left: 0,
        background: SURFACE.container, borderRight: `1px solid ${C.line}`, minWidth: 0,
        display: "flex", alignItems: "center", gap: 7, zIndex: 2,
      }}
    >
      <Avatar initials={s.assigneeInitials} color={s.color} size={20} fontSize={12} title={s.assigneeInitials} />
      <span style={{ ...TX.micro, color: s.done ? C.ink400 : C.ink900, textDecoration: s.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
        {s.name}
      </span>
      {colCells(cols, {
        debut: fmtShort(s.start),
        fin: fmtShort(s.end),
        duree: `${s.plannedDays} j`,
        marge: s.onCriticalPath ? "0 j" : `${s.float} j`,
        avancement: s.done ? "100 %" : "—",
      })}
    </div>
  );
}

// ── Chart background (single layer): weekend bands, week lines, today line ─────

function ChartBackground({ leftW, timelineW, axis, todayPx, topOffset }: { leftW: number; timelineW: number; axis: Axis; todayPx: number; topOffset: number }) {
  return (
    <div aria-hidden style={{ position: "absolute", left: leftW, top: topOffset, width: timelineW, bottom: 0, pointerEvents: "none", zIndex: 0 }}>
      {/* Weekend bands — barely-there tint; a quiet rhythm cue, not a stripe.
          Dialled down so weekends read as a whisper, not a stripe pattern. */}
      {axis.weekends.map((b, i) => (
        <div key={`we${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: b.px, width: b.w, background: SURFACE.container, opacity: 0.3 }} />
      ))}
      {/* Period dividers — only the major (year/quarter) lines are drawn, faintly,
          so the field reads as open rather than ruled. Minor month/week lines are
          dropped; the header already carries those labels. */}
      {axis.top.filter((t) => t.major).map((t, i) => (
        <div key={`tl${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: t.px, borderLeft: `1px solid ${C.line}` }} />
      ))}
      {/* Today — ONE quiet brand hairline, full bleed. The header carries the
          labelled marker; in the field it's just a soft locating line. */}
      <div style={{ position: "absolute", top: 0, bottom: 0, width: 1, background: C.brand, opacity: 0.5, left: todayPx }} />
    </div>
  );
}

// ── Two-tier sticky header ────────────────────────────────────────────────────

function AxisHeader({ leftW, timelineW, axis, todayPx, onResize }: { leftW: number; timelineW: number; axis: Axis; todayPx: number; onResize: (e: React.PointerEvent) => void }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: C.subtle, zIndex: 6, height: HEADER_H }}>
      <div
        style={{
          width: leftW, flexShrink: 0, padding: "8px 14px", ...TX.eyebrow, color: C.ink500, position: "sticky", left: 0,
          background: C.subtle, borderRight: `1px solid ${C.line}`, zIndex: 1, display: "flex", alignItems: "center",
        }}
      >
        Projet · responsable
        {/* resize handle */}
        <div
          onPointerDown={onResize}
          title="Redimensionner le panneau"
          style={{ position: "absolute", right: -3, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 3 }}
        />
      </div>
      <div style={{ flex: 1, position: "relative", width: timelineW }}>
        {/* top tier */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: HEADER_H / 2, borderBottom: `1px solid ${C.line}` }}>
          {axis.top.map((t, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: t.px, width: t.w, borderLeft: `1px solid ${t.major ? C.lineStrong : C.line}`, display: "flex", alignItems: "center", paddingLeft: 6, fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, color: C.ink700, whiteSpace: "nowrap", overflow: "hidden" }}>
              {t.label}
            </div>
          ))}
        </div>
        {/* bottom tier — labels only, no vertical fence. The top tier carries the
            structural dividers; repeating a line under every month/week just rules
            the field. Whitespace + alignment do the grouping. */}
        <div style={{ position: "absolute", top: HEADER_H / 2, left: 0, right: 0, bottom: 0 }}>
          {axis.bottom.map((t, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: t.px, width: t.w, display: "flex", alignItems: "center", paddingLeft: 6, fontFamily: FONT_NUM, fontSize: 12, fontWeight: 500, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden" }}>
              {t.label}
            </div>
          ))}
        </div>
        {/* Today marker — one quiet brand hairline + a tinted (not filled-slab)
            chip, so it locates without shouting. */}
        <div style={{ position: "absolute", top: 0, bottom: 0, width: 1, background: "rgba(21,128,61,.75)", left: todayPx, zIndex: 2 }}>
          {/* full-opacity chip (an opacity on the parent dragged it under AA) */}
          <span style={{ position: "absolute", top: 3, left: 3, ...TX.nano, fontWeight: 600, color: C.brandText, background: C.brand50, borderRadius: R.xxs, padding: "0 4px", whiteSpace: "nowrap" }}>Auj.</span>
        </div>
      </div>
    </div>
  );
}

// ── Dependency arrows: chart-wide overlay, 3-segment orthogonal routing ────────

/** SVG overlay drawing Finish-to-Start connectors between a project's tasks with
 *  rounded-elbow 3-segment routing (stub-out / vertical / stub-in). Backward
 *  links (successor starts before predecessor finishes) get a dashed accent path.
 *  Hovering a link dims unrelated bars and highlights the pred/succ pair. */
function DependencyArrows({ subtasks, leftW, timelineW, hoverDep, onHover }: { subtasks: GanttBar[]; leftW: number; timelineW: number; hoverDep: { pred: number; succ: number } | null; onHover: (link: { pred: number; succ: number } | null) => void }) {
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
    <svg style={{ position: "absolute", left: leftW, top: 0, width: timelineW, height: subtasks.length * SUB_ROW_H, pointerEvents: "none", zIndex: 4, overflow: "visible" }}>
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

function ProjectBar({ g, spanDays, onCommit, onCommitTask, onLive, cp }: {
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
  const width = Math.max(0.6, g.width + (drag?.mode === "resize" ? drag.dxDays * pctPerDay : 0));
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

function SubtaskBar({ projectId, s, timelineW, spanDays, pxPerDay, onCommit, onLive, dim }: { projectId: number; s: GanttBar; timelineW: number; spanDays: number; pxPerDay: number; onCommit: (projectId: number, subtaskId: number, patch: SubtaskPatch) => void; onLive: (m: string) => void; dim: boolean }) {
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
  const width = Math.max(0.8, s.width + (drag?.mode === "resize" ? drag.dxDays * pctPerDay : 0));
  const pStart = shiftISO(s.start, drag?.mode === "move" ? drag.dxDays : 0);
  const pDays = Math.max(1, workingDaysBetween(s.start, shiftISO(s.end, drag?.mode === "resize" ? drag.dxDays : 0)));

  // Bar fill follows the unified language: active/not-done = GREEN (the one
  // accent); done = a RECEDED neutral so it sits back (kept legible by the check
  // + hatch). NO near-black fill. Criticality is NOT a fill — it's the one ink
  // hairline ring applied below. NOT danger red — that means "late".
  const critical = s.onCriticalPath && !s.done;
  const barFill = s.done ? DONE_FILL : PROGRESS;
  const critTitle = s.onCriticalPath ? " · chemin critique (marge nulle)" : s.float > 0 ? ` · marge ${s.float} j` : "";
  const labelOutside = (left + width) * (timelineW / 100) + 8; // px from timeline start for the trailing name
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
          minWidth: 8, background: barFill, opacity: s.done ? 0.7 : 1,
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
