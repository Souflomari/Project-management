"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { FilterBar } from "../../filter-bar";
import { Popover } from "../../overlay/popover";
import { Button, EmptyState, Segmented } from "../../ui";
import { buildGantt } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, SH, SPRING, TX } from "@/lib/tokens";
import { AxisHeader, buildAxis, ChartBackground } from "./axis";
import { DependencyArrows, ProjectBar, SubtaskBar } from "./bars";
import { Legend, ProjectLeftCell, SubtaskLeftCell } from "./cells";
import {
  ALL_COLS,
  HEADER_H,
  MAX_LEFT_W,
  MIN_LEFT_W,
  PROJ_ROW_H,
  SUB_ROW_H,
  ZOOM_PX,
  type ColKey,
  type Zoom,
} from "./constants";

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
