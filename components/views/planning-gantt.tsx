"use client";

import { useState } from "react";

import { FilterBar } from "../filter-bar";
import { buildGantt } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

const LEFT_W = 250;

function Legend() {
  return (
    <span style={{ fontSize: 11, color: "#6F6F6F", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 9, borderRadius: 2, background: "#17823D" }} />
        avancement
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 16, height: 9, borderRadius: 2, background: "#17823D22", border: "1px solid #17823D66" }} />
        durée projet
      </span>
      <span style={{ color: "#9AA39B" }}>▸ cliquez un projet pour ses tâches</span>
    </span>
  );
}

export function PlanningGantt() {
  const { filtered, openProject } = useProjects();
  const { months, rows, todayLeft } = buildGantt(filtered);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <>
      <FilterBar trailing={<Legend />} />

      <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 6, overflow: "auto" }}>
        <div style={{ minWidth: 1180 }}>
          {/* month header */}
          <div style={{ display: "flex", borderBottom: "1px solid #E2E6E0", position: "sticky", top: 0, background: "#F6F8F4", zIndex: 2 }}>
            <div
              style={{
                width: LEFT_W,
                flexShrink: 0,
                padding: "7px 14px",
                fontSize: 10,
                letterSpacing: ".07em",
                textTransform: "uppercase",
                color: "#6F6F6F",
                fontWeight: 700,
                position: "sticky",
                left: 0,
                background: "#F6F8F4",
                borderRight: "1px solid #D7DDD3",
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
                    borderLeft: "1px solid #EEF1EC",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 6,
                    fontFamily: FONT_NUM,
                    fontSize: 10.5,
                    fontWeight: 500,
                    color: "#6F6F6F",
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
                  onClick={() => toggle(g.id)}
                  style={{ display: "flex", borderTop: "1px solid #EEF1EC", cursor: "pointer", background: isOpen ? "#F6F9F4" : "#fff" }}
                >
                  <div
                    style={{
                      width: LEFT_W,
                      flexShrink: 0,
                      padding: "8px 14px",
                      position: "sticky",
                      left: 0,
                      background: isOpen ? "#F6F9F4" : "#fff",
                      borderRight: "1px solid #EEF1EC",
                      minWidth: 0,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#9AA39B", fontSize: 10, width: 10, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▸</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                      <div style={{ fontSize: 10.5, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                          border: `1px solid ${g.color}55`,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ position: "absolute", inset: 0, width: `${g.fill}%`, background: g.color, opacity: 0.85, borderRadius: "3px 0 0 3px" }} />
                        <span style={{ position: "absolute", right: 5, top: 1, fontFamily: FONT_NUM, fontSize: 10, fontWeight: 600, color: g.fill > 55 ? "#fff" : "#3B5560" }}>
                          {g.progress}%
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* subtasks */}
                {isOpen
                  ? g.subtasks.map((s) => (
                      <div
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openProject(g.id);
                        }}
                        style={{ display: "flex", borderTop: "1px solid #F4F6F2", cursor: "pointer", background: "#FBFCFA" }}
                      >
                        <div
                          style={{
                            width: LEFT_W,
                            flexShrink: 0,
                            padding: "5px 14px 5px 32px",
                            position: "sticky",
                            left: 0,
                            background: "#FBFCFA",
                            borderRight: "1px solid #EEF1EC",
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span style={{ width: 18, height: 18, borderRadius: "50%", background: s.color, color: "#fff", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {s.assigneeInitials}
                          </span>
                          <span style={{ fontSize: 11.5, color: s.done ? "#9AA39B" : "#233038", textDecoration: s.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.name}
                          </span>
                        </div>
                        <div style={{ flex: 1, position: "relative", height: 26 }}>
                          <GridLines months={months} />
                          <TodayLine left={todayLeft} />
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              height: 10,
                              borderRadius: 3,
                              left: `${s.left}%`,
                              width: `${s.width}%`,
                              background: s.color,
                              opacity: s.done ? 0.5 : 0.95,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function GridLines({ months }: { months: { left: number }[] }) {
  return (
    <>
      {months.map((m, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${m.left}%`, borderLeft: "1px solid #F1F3EF" }} />
      ))}
    </>
  );
}

function TodayLine({ left }: { left: number }) {
  return <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#A42421", left: `${left}%`, zIndex: 1 }} />;
}
