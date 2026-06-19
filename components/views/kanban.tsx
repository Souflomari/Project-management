"use client";

import { useRef, useState } from "react";

import { FilterBar } from "../filter-bar";
import { MinusIcon } from "../icons";
import { Avatar, IconButton, ProgressBar } from "../ui";
import { buildKanban } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, FONT_NUM, PHASE_COLORS, R, SH, STATUS_META, TX } from "@/lib/tokens";

const WIP_LIMIT = 6;
const WIP_COLOR = STATUS_META["à risque"].color;
const WIP_BG = STATUS_META["à risque"].bg;

const numTab: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export function Kanban() {
  const { filtered, setPhase, openProject } = useProjects();
  const columns = buildKanban(filtered);
  const dragId = useRef<number | null>(null);
  const [overPhase, setOverPhase] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleCollapse = (i: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const dropHandlers = (phaseIndex: number) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (overPhase !== phaseIndex) setOverPhase(phaseIndex); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId.current != null) { setPhase(dragId.current, phaseIndex); dragId.current = null; }
      setOverPhase(null);
    },
  });

  return (
    <>
      <FilterBar />
      <p style={{ ...TX.caption, color: C.ink400, margin: "0 0 14px" }}>
        Glissez une carte pour changer de phase · limite indicative {WIP_LIMIT} / phase
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
                style={{ width: 46, flexShrink: 0, background: C.subtle, borderRadius: R.md, border: `1px solid ${C.line}`, boxShadow: isOver ? `inset 0 0 0 2px ${C.ink900}1f` : undefined, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer", transition: "box-shadow .12s ease" }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                <span style={{ ...numTab, fontSize: 12, fontWeight: 600, color: overWip ? WIP_COLOR : C.ink700 }}>{col.count}</span>
                <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: C.ink700 }}>{col.label}</span>
              </div>
            );
          }

          return (
            <div
              key={col.phaseIndex}
              {...dropHandlers(col.phaseIndex)}
              style={{ width: 256, flexShrink: 0, background: C.subtle, borderRadius: R.md, border: `1px solid ${C.line}`, boxShadow: isOver ? `inset 0 0 0 2px ${C.ink900}1f` : undefined, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 230px)", transition: "box-shadow .12s ease" }}
            >
              <div style={{ padding: "11px 12px 9px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{col.label}</div>
                    <div style={{ fontSize: 10.5, color: C.ink400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.full}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span
                    title={overWip ? `Limite dépassée (${col.count}/${WIP_LIMIT})` : undefined}
                    style={{ ...numTab, fontSize: 12, fontWeight: 600, color: overWip ? WIP_COLOR : C.ink700, background: overWip ? WIP_BG : C.surface, borderRadius: R.xs, padding: "1px 8px" }}
                  >
                    {overWip ? `${col.count}/${WIP_LIMIT}` : col.count}
                  </span>
                  <IconButton size={28} onClick={() => toggleCollapse(col.phaseIndex)} title="Replier" aria-label="Replier la colonne"><MinusIcon size={14} /></IconButton>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 8px 10px", overflowY: "auto" }}>
                {col.cards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => { dragId.current = c.id; setDraggingId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { dragId.current = null; setDraggingId(null); setOverPhase(null); }}
                    onClick={() => openProject(c.id)}
                    className="lift-hover"
                    style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.md, padding: "11px 12px", cursor: "grab", opacity: draggingId === c.id ? 0.4 : 1, boxShadow: draggingId === c.id ? SH.md : undefined, transition: "opacity .12s ease" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ ...TX.bodyStrong, lineHeight: 1.3, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.name}</div>
                      <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, fontSize: 10.5, fontWeight: 540, color: c.statusColor, background: c.statusBg, padding: "2px 7px", borderRadius: R.xs, whiteSpace: "nowrap" }}>
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
                {col.cards.length === 0 ? <div style={{ ...TX.caption, color: C.ink400, textAlign: "center", padding: "16px 0" }}>Aucun projet</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
