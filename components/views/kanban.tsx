"use client";

import { useMemo, useRef, useState } from "react";

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
  const columns = useMemo(() => buildKanban(filtered), [filtered]);
  const [overPhase, setOverPhase] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  // Pointer-event drag (works on touch AND mouse; HTML5 DnD is dead on touch).
  // We track the dragged card + the column under the pointer via a data-attr,
  // resolved with elementFromPoint on each move. A movement threshold lets a
  // plain tap still open the project.
  const drag = useRef<{ id: number; startX: number; startY: number; moved: boolean; phase: number | null } | null>(null);

  const toggleCollapse = (i: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  /** Phase index of the kanban column under a viewport point, or null. */
  function phaseAtPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-kanban-phase]");
    if (!el) return null;
    const v = Number(el.dataset.kanbanPhase);
    return Number.isNaN(v) ? null : v;
  }

  const cardHandlers = (cardId: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button != null && e.button !== 0) return;
      drag.current = { id: cardId, startX: e.clientX, startY: e.clientY, moved: false, phase: null };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== cardId) return;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      if (!d.moved) { d.moved = true; setDraggingId(cardId); }
      const phase = phaseAtPoint(e.clientX, e.clientY);
      d.phase = phase;
      setOverPhase(phase);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.id !== cardId) return;
      if (d.moved) {
        const phase = phaseAtPoint(e.clientX, e.clientY) ?? d.phase;
        if (phase != null) setPhase(cardId, phase);
      } else {
        openProject(cardId);
      }
      setDraggingId(null);
      setOverPhase(null);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDraggingId(null);
      setOverPhase(null);
    },
  });

  return (
    <>
      <FilterBar />
      <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 14px" }}>
        Glissez une carte pour changer de phase · limite indicative {WIP_LIMIT}&#8239;/ phase
      </p>

      <div className="enter-stagger" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10, alignItems: "flex-start" }}>
        {columns.map((col) => {
          const isOver = overPhase === col.phaseIndex;
          const accent = PHASE_COLORS[col.phaseIndex];
          const overWip = col.count > WIP_LIMIT;

          if (collapsed.has(col.phaseIndex)) {
            return (
              <div
                key={col.phaseIndex}
                data-kanban-phase={col.phaseIndex}
                onClick={() => toggleCollapse(col.phaseIndex)}
                title={`${col.full} — déplier`}
                style={{ width: 46, flexShrink: 0, background: C.surface, borderRadius: R.md, border: `1px solid ${isOver ? C.brand : C.line}`, boxShadow: isOver ? `inset 0 0 0 1px ${C.brand}, 0 0 0 3px ${C.brand50}` : undefined, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer", transition: "box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)" }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                <span style={{ ...numTab, fontSize: 12, fontWeight: 600, color: overWip ? WIP_COLOR : col.count > 0 ? C.brandText : C.ink500 }}>{col.count}</span>
                <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: C.ink700 }}>{col.label}</span>
              </div>
            );
          }

          return (
            <div
              key={col.phaseIndex}
              data-kanban-phase={col.phaseIndex}
              style={{ width: 256, flexShrink: 0, background: C.surface, borderRadius: R.md, border: `1px solid ${isOver ? C.brand : C.line}`, boxShadow: isOver ? `inset 0 0 0 1px ${C.brand}, 0 0 0 3px ${C.brand50}` : undefined, display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 230px)", transition: "box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)" }}
            >
              <div style={{ padding: "11px 12px 9px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 600, color: C.ink900 }}>{col.label}</div>
                    <div style={{ fontSize: 10.5, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.full}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span
                    title={overWip ? `Limite dépassée (${col.count}/${WIP_LIMIT})` : `Dans la limite (${col.count}/${WIP_LIMIT})`}
                    style={{ ...numTab, fontSize: 12, fontWeight: 600, color: overWip ? WIP_COLOR : col.count > 0 ? C.brandText : C.ink500, background: overWip ? WIP_BG : col.count > 0 ? C.brand50 : C.subtle, borderRadius: R.xs, padding: "1px 8px", transition: "color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard)" }}
                  >
                    {overWip ? `${col.count} / ${WIP_LIMIT}` : col.count}
                  </span>
                  <IconButton size={28} onClick={() => toggleCollapse(col.phaseIndex)} title="Replier" aria-label="Replier la colonne"><MinusIcon size={14} /></IconButton>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 8px 10px", overflowY: "auto" }}>
                {col.cards.map((c) => (
                  <div
                    key={c.id}
                    {...cardHandlers(c.id)}
                    className="lift-hover"
                    style={{ background: C.surface, border: `1px solid ${draggingId === c.id ? C.lineStrong : C.line}`, borderRadius: R.md, padding: "11px 12px", cursor: draggingId === c.id ? "grabbing" : "grab", touchAction: "none", boxShadow: draggingId === c.id ? SH.lg : undefined, transform: draggingId === c.id ? "scale(1.025)" : "none", transition: "transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)" }}
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
                      <span style={{ ...numTab, fontSize: 11.5, fontWeight: 600, color: c.status === "à jour" ? C.brandText : C.ink700, width: 34, textAlign: "right" }}>{c.progress}&#8239;%</span>
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
                {col.cards.length === 0 ? <div style={{ ...TX.caption, color: C.ink500, textAlign: "center", padding: "16px 0" }}>Aucun projet</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
