"use client";

import { useRef, useState } from "react";

import { FilterBar } from "../filter-bar";
import { Avatar, ProgressBar } from "../ui";
import { buildKanban } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM, PHASE_COLORS } from "@/lib/tokens";

/** Soft Work-In-Progress limit; columns above this flag a bottleneck. */
const WIP_LIMIT = 6;

export function Kanban() {
  const { filtered, setPhase, openProject } = useProjects();
  const columns = buildKanban(filtered);
  const dragId = useRef<number | null>(null);
  const [overPhase, setOverPhase] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleCollapse = (i: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const dropHandlers = (phaseIndex: number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (overPhase !== phaseIndex) setOverPhase(phaseIndex);
    },
    onDragLeave: () => setOverPhase((cur) => (cur === phaseIndex ? null : cur)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId.current != null) {
        setPhase(dragId.current, phaseIndex);
        dragId.current = null;
      }
      setOverPhase(null);
    },
  });

  return (
    <>
      <FilterBar />
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6F6F6F" }}>
        Glissez une carte pour faire évoluer la phase. Limite WIP indicative : {WIP_LIMIT} projets par phase.
      </p>

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10, alignItems: "flex-start" }}>
        {columns.map((col) => {
          const isOver = overPhase === col.phaseIndex;
          const accent = PHASE_COLORS[col.phaseIndex];
          const overWip = col.count > WIP_LIMIT;

          if (collapsed.has(col.phaseIndex)) {
            return (
              <div
                key={col.phaseIndex}
                {...dropHandlers(col.phaseIndex)}
                style={{
                  width: 46,
                  flexShrink: 0,
                  background: isOver ? "#EAF3EC" : "#EEF1EC",
                  borderRadius: 6,
                  border: isOver ? "1px dashed #17823D" : "1px solid #E2E6E0",
                  borderTop: `3px solid ${accent}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  cursor: "pointer",
                }}
                onClick={() => toggleCollapse(col.phaseIndex)}
                title={`${col.full} — déplier`}
              >
                <span style={{ fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, color: overWip ? "#C2683E" : "#3B5560" }}>{col.count}</span>
                <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: "#3B5560" }}>
                  {col.label}
                </span>
              </div>
            );
          }

          return (
            <div
              key={col.phaseIndex}
              {...dropHandlers(col.phaseIndex)}
              style={{
                width: 250,
                flexShrink: 0,
                background: isOver ? "#EAF3EC" : "#EEF1EC",
                borderRadius: 6,
                border: isOver ? "1px dashed #17823D" : "1px solid #E2E6E0",
                display: "flex",
                flexDirection: "column",
                maxHeight: "calc(100vh - 230px)",
              }}
            >
              <div style={{ borderTop: `3px solid ${accent}`, borderRadius: "6px 6px 0 0", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 600, letterSpacing: ".04em", color: "#233038" }}>{col.label}</div>
                  <div style={{ fontSize: 10, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.full}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span
                    title={overWip ? `WIP dépassé (${col.count}/${WIP_LIMIT})` : undefined}
                    style={{
                      fontFamily: FONT_NUM,
                      fontSize: 12,
                      fontWeight: 600,
                      color: overWip ? "#C2683E" : "#3B5560",
                      background: overWip ? "#FBEEDD" : "#fff",
                      borderRadius: 3,
                      padding: "1px 8px",
                    }}
                  >
                    {overWip ? `${col.count}/${WIP_LIMIT}` : col.count}
                  </span>
                  <button
                    onClick={() => toggleCollapse(col.phaseIndex)}
                    title="Replier"
                    style={{ border: "1px solid #E2E6E0", background: "#fff", cursor: "pointer", borderRadius: 3, width: 20, height: 20, fontSize: 12, lineHeight: 1, color: "#6F6F6F", padding: 0 }}
                  >
                    –
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 8px 10px", overflowY: "auto" }}>
                {col.cards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      dragId.current = c.id;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      dragId.current = null;
                      setOverPhase(null);
                    }}
                    onClick={() => openProject(c.id)}
                    className="lift-hover"
                    style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 4, padding: "10px 11px", cursor: "grab" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}>{c.name}</div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: c.statusColor, background: c.statusBg, padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.statusColor }} />
                        {c.statusLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6F6F6F", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.client}</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <ProgressBar pct={c.progress} color={c.ring} height={6} />
                      <span style={{ fontFamily: FONT_NUM, fontSize: 11.5, fontWeight: 600, color: "#3B5560", width: 30, textAlign: "right" }}>{c.progress}%</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <Avatar initials={c.responsable.initials} color={c.responsable.color} size={22} fontSize={9} title={`${c.responsable.name} · ${c.responsable.role}`} />
                        <span style={{ fontSize: 10.5, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.responsable.name}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c.renduDueColor, whiteSpace: "nowrap" }}>{c.renduDaysLabel}</span>
                    </div>
                  </div>
                ))}
                {col.cards.length === 0 ? <div style={{ fontSize: 11, color: "#9AA39B", textAlign: "center", padding: "14px 0" }}>—</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
