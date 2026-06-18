"use client";

import { useRef, useState } from "react";

import { FilterBar } from "../filter-bar";
import { MinusIcon } from "../icons";
import { Avatar, IconButton, ProgressBar } from "../ui";
import { buildKanban } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, FONT_NUM, PHASE_COLORS, TX } from "@/lib/tokens";

const WIP_LIMIT = 6;

const numTab: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

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
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (overPhase !== phaseIndex) setOverPhase(phaseIndex); },
    onDragLeave: () => setOverPhase((cur) => (cur === phaseIndex ? null : cur)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId.current != null) { setPhase(dragId.current, phaseIndex); dragId.current = null; }
      setOverPhase(null);
    },
  });

  return (
    <>
      <FilterBar />
      <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 12px" }}>
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
                onClick={() => toggleCollapse(col.phaseIndex)}
                title={`${col.full} — déplier`}
                style={{ width: 46, flexShrink: 0, background: isOver ? C.brand50 : C.subtle, borderRadius: 8, border: `1px solid ${isOver ? C.brand : C.line}`, borderTop: `3px solid ${accent}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}
              >
                <span style={{ ...numTab, fontSize: 12, fontWeight: 600, color: overWip ? "#C2683E" : C.ink700 }}>{col.count}</span>
                <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: C.ink700 }}>{col.label}</span>
              </div>
            );
          }

          return (
            <div
              key={col.phaseIndex}
              {...dropHandlers(col.phaseIndex)}
              style={{ width: 250, flexShrink: 0, background: isOver ? C.brand50 : C.subtle, borderRadius: 8, border: `1px solid ${isOver ? C.brand : C.line}`, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 230px)" }}
            >
              <div style={{ borderTop: `3px solid ${accent}`, borderRadius: "8px 8px 0 0", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 600, letterSpacing: ".04em", color: C.ink900 }}>{col.label}</div>
                  <div style={{ fontSize: 10.5, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.full}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span
                    title={overWip ? `WIP dépassé (${col.count}/${WIP_LIMIT})` : undefined}
                    style={{ ...numTab, fontSize: 12, fontWeight: 600, color: overWip ? "#C2683E" : C.ink700, background: overWip ? "#FBEEDD" : C.surface, borderRadius: 4, padding: "1px 8px" }}
                  >
                    {overWip ? `${col.count}/${WIP_LIMIT}` : col.count}
                  </span>
                  <IconButton size={20} onClick={() => toggleCollapse(col.phaseIndex)} title="Replier"><MinusIcon size={14} /></IconButton>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 8px 10px", overflowY: "auto" }}>
                {col.cards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => { dragId.current = c.id; e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { dragId.current = null; setOverPhase(null); }}
                    onClick={() => openProject(c.id)}
                    className="lift-hover"
                    style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: "10px 11px", cursor: "grab", boxShadow: "0 1px 2px rgba(20,30,25,.05)" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ ...TX.bodyStrong, lineHeight: 1.3, minWidth: 0 }}>{c.name}</div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: 10, fontWeight: 600, color: c.statusColor, background: c.statusBg, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.statusColor }} />
                        {c.statusLabel}
                      </span>
                    </div>
                    <div style={{ ...TX.caption, color: C.ink500, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.client}</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <ProgressBar pct={c.progress} color={c.ring} height={6} />
                      <span style={{ ...numTab, fontSize: 11.5, fontWeight: 600, color: C.ink700, width: 30, textAlign: "right" }}>{c.progress}%</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <Avatar initials={c.responsable.initials} color={c.responsable.color} size={22} fontSize={9} title={`${c.responsable.name} · ${c.responsable.role}`} />
                        <span style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.responsable.name}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: c.renduDueColor, whiteSpace: "nowrap" }}>{c.renduDaysLabel}</span>
                    </div>
                  </div>
                ))}
                {col.cards.length === 0 ? <div style={{ ...TX.caption, color: C.ink400, textAlign: "center", padding: "14px 0" }}>—</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
