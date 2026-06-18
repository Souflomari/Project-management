"use client";

import { buildCalendar } from "@/lib/derive";
import { WEEKDAYS } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

const navBtn: React.CSSProperties = {
  border: "1px solid #E2E6E0",
  background: "#fff",
  cursor: "pointer",
  width: 34,
  height: 34,
  borderRadius: 3,
  fontSize: 16,
  color: "#3B5560",
};

export function CalendarView() {
  const { allDerived, calYear, calMonth, calPrev, calNext, openProject } = useProjects();
  const { cells, label } = buildCalendar(calYear, calMonth, allDerived);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <button onClick={calPrev} style={navBtn} aria-label="Mois précédent">
          ‹
        </button>
        <h2 style={{ margin: 0, fontFamily: FONT_NUM, fontSize: 21, fontWeight: 600, letterSpacing: ".02em", minWidth: 200 }}>
          {label}
        </h2>
        <button onClick={calNext} style={navBtn} aria-label="Mois suivant">
          ›
        </button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#F6F8F4", borderBottom: "1px solid #E2E6E0" }}>
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              style={{
                padding: "9px 12px",
                fontSize: 10.5,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "#6F6F6F",
                fontWeight: 700,
              }}
            >
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {cells.map((c, i) => (
            <div
              key={i}
              style={{
                minHeight: 74,
                borderRight: "1px solid #EEF1EC",
                borderBottom: "1px solid #EEF1EC",
                padding: "5px 7px",
                background: c.day === null ? "#FAFBF9" : c.isToday ? "#E6F1E9" : "#fff",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_NUM,
                  fontSize: 13,
                  fontWeight: c.isToday ? 700 : 500,
                  color: c.day === null ? "transparent" : c.isToday ? "#17823D" : "#3B5560",
                }}
              >
                {c.day ?? "·"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                {c.events.map((e, j) => (
                  <div
                    key={j}
                    onClick={() => openProject(e.projectId)}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: 3,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      background: e.bg,
                      color: e.color,
                    }}
                  >
                    {e.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
