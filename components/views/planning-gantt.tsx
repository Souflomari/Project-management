"use client";

import { useRef, useState } from "react";

import { FilterBar } from "../filter-bar";
import { buildGantt, type GanttBar } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

const LEFT_W = 250;
const SUB_ROW_H = 28;

function Legend() {
  return (
    <span style={{ fontSize: 11, color: "#5C6571", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 9, background: "#1A7F37" }} />
        avancement
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 9, background: "#1A7F3722", border: "1px solid #1A7F3766" }} />
        durée
      </span>
      <span style={{ color: "#8B95A1" }}>▸ cliquez un projet pour ses tâches & dépendances</span>
    </span>
  );
}

export function PlanningGantt() {
  const { filtered, openProject } = useProjects();
  const { months, rows, todayLeft } = buildGantt(filtered);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [scrollLeft, setScrollLeft] = useState(0);

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
      <FilterBar trailing={<Legend />} />

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
            background: "#fff",
            border: "1px solid #ECEEF1",
            borderRadius: 8,
            overflow: "auto",
            maxHeight: "calc(100vh - 215px)",
          }}
        >
          <div style={{ minWidth: 1180 }}>
            {/* month header (sticky) */}
            <div style={{ display: "flex", borderBottom: "1px solid #DDE1E6", position: "sticky", top: 0, background: "#F1F3F5", zIndex: 4 }}>
              <div
                style={{
                  width: LEFT_W,
                  flexShrink: 0,
                  padding: "7px 14px",
                  fontSize: 10,
                  letterSpacing: ".07em",
                  textTransform: "uppercase",
                  color: "#5C6571",
                  fontWeight: 700,
                  position: "sticky",
                  left: 0,
                  background: "#F1F3F5",
                  borderRight: "1px solid #DDE1E6",
                  zIndex: 1,
                }}
              >
                Projet · responsable
              </div>
              <div style={{ flex: 1, position: "relative", height: 28 }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${m.left}%`,
                      width: `${m.width}%`,
                      borderLeft: "1px solid #DDE1E6",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 6,
                      fontFamily: FONT_NUM,
                      fontSize: 10.5,
                      fontWeight: 500,
                      color: "#5C6571",
                    }}
                  >
                    {m.label}
                  </div>
                ))}
                <TodayLine left={todayLeft} />
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
                    style={{ display: "flex", borderTop: "1px solid #F1F3F5", cursor: "pointer", background: isOpen ? "#F1F3F5" : "#fff" }}
                  >
                    <div
                      style={{
                        width: LEFT_W,
                        flexShrink: 0,
                        padding: "8px 14px",
                        position: "sticky",
                        left: 0,
                        background: isOpen ? "#F1F3F5" : "#fff",
                        borderRight: "1px solid #F1F3F5",
                        minWidth: 0,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        zIndex: 1,
                      }}
                    >
                      <span style={{ color: "#8B95A1", fontSize: 10, width: 10, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▸</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                        <div style={{ fontSize: 10.5, color: "#5C6571", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {g.responsable} · {g.taskCount} tâches
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, position: "relative", height: 34 }}>
                      <GridLines months={months} />
                      <TodayLine left={todayLeft} />
                      {g.width > 0 ? (
                        <div
                          style={{
                            position: "absolute",
                            top: 9,
                            height: 16,
                            borderRadius: 4,
                            left: `${g.left}%`,
                            width: `${g.width}%`,
                            background: `${g.color}1f`,
                            border: `1px solid ${g.color}66`,
                            overflow: "hidden",
                          }}
                        >
                          <div style={{ position: "absolute", inset: 0, width: `${g.fill}%`, background: g.color, opacity: 0.85 }} />
                          <span style={{ position: "absolute", right: 5, top: 1, fontFamily: FONT_NUM, fontSize: 10, fontWeight: 600, color: g.fill > 55 ? "#fff" : "#3A424D" }}>
                            {g.progress}%
                          </span>
                        </div>
                      ) : null}
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
                          style={{ display: "flex", borderTop: "1px solid #F4F6F2", cursor: "pointer", background: "#FBFCFA", height: SUB_ROW_H }}
                        >
                          <div
                            style={{
                              width: LEFT_W,
                              flexShrink: 0,
                              padding: "0 14px 0 32px",
                              position: "sticky",
                              left: 0,
                              background: "#FBFCFA",
                              borderRight: "1px solid #F1F3F5",
                              minWidth: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              zIndex: 1,
                            }}
                          >
                            <span title={s.assigneeInitials} style={{ width: 18, height: 18, borderRadius: "50%", background: s.color, color: "#fff", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {s.assigneeInitials}
                            </span>
                            <span style={{ fontSize: 11.5, color: s.done ? "#8B95A1" : "#0E1217", textDecoration: s.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {s.name}
                            </span>
                          </div>
                          <div style={{ flex: 1, position: "relative" }}>
                            <GridLines months={months} />
                            <TodayLine left={todayLeft} />
                            {s.visible ? (
                              <div
                                title={s.name}
                                style={{
                                  position: "absolute",
                                  top: SUB_ROW_H / 2 - 5,
                                  height: 10,
                                  borderRadius: 4,
                                  left: `${s.left}%`,
                                  width: `${s.width}%`,
                                  background: s.color,
                                  opacity: s.done ? 0.5 : 0.95,
                                }}
                              />
                            ) : null}
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
        <div style={{ position: "absolute", top: 1, right: 1, bottom: 1, width: 36, pointerEvents: "none", background: "linear-gradient(to right, rgba(255,255,255,0), #fff)", borderRadius: "0 6px 6px 0" }} />
        {scrollLeft > 4 ? (
          <div style={{ position: "absolute", top: 1, left: LEFT_W + 1, bottom: 1, width: 28, pointerEvents: "none", background: "linear-gradient(to left, rgba(255,255,255,0), #fff)" }} />
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
          <path d="M0,0 L6,3 L0,6 Z" fill="#94A391" />
        </marker>
      </defs>
      {links.map((l, i) => (
        <g key={i} stroke="#94A391" strokeWidth={1.2} fill="none">
          <line x1={`${l.x1}%`} y1={l.y1} x2={`${l.x2}%`} y2={l.y1} />
          <line x1={`${l.x2}%`} y1={l.y1} x2={`${l.x2}%`} y2={l.y2} markerEnd="url(#dep-arrow)" />
        </g>
      ))}
    </svg>
  );
}

function GridLines({ months }: { months: { left: number }[] }) {
  return (
    <>
      {months.map((m, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${m.left}%`, borderLeft: "1px solid #ECEEF1" }} />
      ))}
    </>
  );
}

function TodayLine({ left }: { left: number }) {
  return <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#1A7F37", left: `${left}%`, zIndex: 1 }} />;
}
