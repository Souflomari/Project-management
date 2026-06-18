"use client";

import { useRef, useState } from "react";

import { FilterBar } from "../filter-bar";
import { Avatar, ProgressBar } from "../ui";
import { buildKanban } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

const PHASE_COLOR = ["#9AA39B", "#7FA0A3", "#4C8AA3", "#3B7179", "#17823D", "#1D4459", "#6A6557"];

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

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10 }}>
        {columns.map((col) => {
          const isOver = overPhase === col.phaseIndex;
          const accent = PHASE_COLOR[col.phaseIndex];
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
                width: 248,
                flexShrink: 0,
                background: isOver ? "#EAF3EC" : "#EEF1EC",
                borderRadius: 6,
                border: isOver ? "1px dashed #17823D" : "1px solid #E2E6E0",
                display: "flex",
                flexDirection: "column",
                maxHeight: "calc(100vh - 220px)",
              }}
            >
              <div style={{ borderTop: `3px solid ${accent}`, borderRadius: "6px 6px 0 0", padding: "9px 11px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 600, letterSpacing: ".04em", color: "#233038" }}>{col.label}</div>
                  <div style={{ fontSize: 10, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.full}</div>
                </div>
                <span style={{ fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, color: "#3B5560", background: "#fff", borderRadius: 999, padding: "1px 9px" }}>{col.count}</span>
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
                    style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 5, padding: "10px 11px", cursor: "grab", boxShadow: "0 1px 2px rgba(20,30,25,.04)" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}>{c.name}</div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: c.statusColor, background: c.statusBg, padding: "1px 6px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.statusColor }} />
                        {c.statusLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6F6F6F", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.client}</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <ProgressBar pct={c.progress} color={c.ring} />
                      <span style={{ fontFamily: FONT_NUM, fontSize: 11.5, fontWeight: 600, color: "#3B5560", width: 30, textAlign: "right" }}>{c.progress}%</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <Avatar initials={c.responsable.initials} color={c.responsable.color} size={22} fontSize={9} />
                        <span style={{ fontSize: 10.5, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.responsable.name}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c.renduDueColor, whiteSpace: "nowrap" }}>{c.renduDaysLabel}</span>
                    </div>
                  </div>
                ))}
                {col.cards.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#9AA39B", textAlign: "center", padding: "14px 0" }}>—</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
