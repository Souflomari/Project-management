"use client";

import { useRef, useState } from "react";

import { FilterBar } from "../filter-bar";
import { Avatar } from "../ui";
import { buildKanban } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

export function Kanban() {
  const { filtered, setPhase, openProject } = useProjects();
  const columns = buildKanban(filtered);
  const dragId = useRef<number | null>(null);
  const [overPhase, setOverPhase] = useState<number | null>(null);

  return (
    <>
      <FilterBar />
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6F6F6F" }}>
        Glissez une carte d&apos;une colonne à l&apos;autre pour faire évoluer la phase d&apos;étude.
      </p>

      <div style={{ display: "flex", gap: 13, overflowX: "auto", paddingBottom: 8 }}>
        {columns.map((col) => {
          const isOver = overPhase === col.phaseIndex;
          return (
            <div
              key={col.phaseIndex}
              onDragOver={(e) => {
                e.preventDefault();
                if (overPhase !== col.phaseIndex) setOverPhase(col.phaseIndex);
              }}
              onDragLeave={() => setOverPhase((cur) => (cur === col.phaseIndex ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId.current != null) {
                  setPhase(dragId.current, col.phaseIndex);
                  dragId.current = null;
                }
                setOverPhase(null);
              }}
              style={{
                width: 230,
                flexShrink: 0,
                background: "#E7EBE4",
                borderRadius: 4,
                padding: 7,
                outline: isOver ? "2px dashed #17823D" : "none",
                outlineOffset: -2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 10px" }}>
                <span
                  style={{
                    fontFamily: FONT_NUM,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: "#3B5560",
                  }}
                >
                  {col.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6F6F6F", background: "#fff", borderRadius: 999, padding: "1px 8px" }}>
                  {col.count}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
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
                    style={{
                      background: "#fff",
                      border: "1px solid #E2E6E0",
                      borderRadius: 3,
                      padding: "9px 10px",
                      cursor: "grab",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}>{c.name}</div>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4, background: c.statusColor }} />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6F6F6F",
                        marginTop: 6,
                        lineHeight: 1.3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.client}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
                      <Avatar initials={c.responsable.initials} color={c.responsable.color} size={28} fontSize={10} />
                      <span style={{ fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, color: "#3B5560" }}>{c.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
