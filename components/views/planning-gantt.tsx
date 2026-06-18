"use client";

import { FilterBar } from "../filter-bar";
import { buildGantt } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

function Legend() {
  return (
    <span style={{ fontSize: 11, color: "#6F6F6F", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: "#17823D" }} />
        durée
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#1D4459",
            border: "2px solid #fff",
            boxShadow: "0 0 0 1px #1D4459",
          }}
        />
        rendu
      </span>
    </span>
  );
}

export function PlanningGantt() {
  const { filtered, openProject } = useProjects();
  const { months, rows, todayLeft } = buildGantt(filtered);

  return (
    <>
      <FilterBar trailing={<Legend />} />

      <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 4, overflow: "auto" }}>
        <div style={{ minWidth: 1100 }}>
          {/* month header */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #E2E6E0",
              position: "sticky",
              top: 0,
              background: "#F6F8F4",
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 210,
                flexShrink: 0,
                padding: "5px 14px",
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
              Projet
            </div>
            <div style={{ flex: 1, position: "relative", height: 26 }}>
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
                    letterSpacing: ".03em",
                  }}
                >
                  {m.label}
                </div>
              ))}
              <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#A42421", left: `${todayLeft}%` }} />
            </div>
          </div>

          {/* rows */}
          {rows.map((g) => (
            <div
              key={g.id}
              onClick={() => openProject(g.id)}
              style={{ display: "flex", borderTop: "1px solid #EEF1EC", cursor: "pointer" }}
            >
              <div
                style={{
                  width: 210,
                  flexShrink: 0,
                  padding: "6px 14px",
                  position: "sticky",
                  left: 0,
                  background: "#fff",
                  borderRight: "1px solid #EEF1EC",
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 10.5, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {g.responsable}
                </div>
              </div>
              <div style={{ flex: 1, position: "relative", height: 28 }}>
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    height: 12,
                    borderRadius: 2,
                    left: `${g.left}%`,
                    width: `${g.width}%`,
                    background: `${g.color}22`,
                    border: `1px solid ${g.color}66`,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      borderRadius: "2px 0 0 2px",
                      width: `${g.fill}%`,
                      background: g.color,
                      opacity: 0.85,
                    }}
                  />
                </div>
                {g.markerLeft !== null ? (
                  <div
                    style={{
                      position: "absolute",
                      top: 7,
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: "#1D4459",
                      border: "1.5px solid #fff",
                      boxShadow: "0 0 0 1px #1D4459",
                      left: `calc(${g.markerLeft}% - 5px)`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
