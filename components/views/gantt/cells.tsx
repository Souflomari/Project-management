"use client";

import { ChevronRightIcon } from "../../icons";
import { Avatar, StatusPill } from "../../ui";
import { type GanttBar, type GanttRow } from "@/lib/derive";
import { fmtShort } from "@/lib/format";
import { C, FONT_NUM, R, SURFACE, TX } from "@/lib/tokens";
import { ALL_COLS, BAR_TRACK, CP_RING, PROGRESS, Z_LEFT_COL, type ColKey } from "./constants";

// Left-panel cells (project / task rows) and the legend.

export function Legend() {
  const item = { display: "flex", alignItems: "center", gap: 5 } as const;
  const swatch = { width: 14, height: 8, borderRadius: 6, flexShrink: 0 } as const;
  return (
    <span style={{ ...TX.nano, color: C.ink500, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {/* avancement = the green progress fill on its light neutral track (mirrors a bar). */}
      <span style={item}>
        <span style={{ ...swatch, background: BAR_TRACK, border: `1px solid ${C.line}`, overflow: "hidden", position: "relative" }}>
          <span style={{ position: "absolute", inset: 0, width: "60%", background: PROGRESS }} />
        </span>
        avancement
      </span>
      {/* chemin critique = a neutral bar carried by the ONE ink hairline ring (no fill colour). */}
      <span style={item}>
        <span style={{ ...swatch, background: BAR_TRACK, border: `1.5px solid ${CP_RING}` }} />
        chemin critique
      </span>
      {/* marge = the dashed ghost extension (mirrors the float ghost exactly). */}
      <span style={item}>
        <span style={{ ...swatch, background: `repeating-linear-gradient(90deg, ${C.ink350}55 0 3px, transparent 3px 6px)`, border: `1px dashed ${C.ink350}` }} />
        marge
      </span>
    </span>
  );
}

function colCells(cols: Set<ColKey>, vals: Partial<Record<ColKey, string>>) {
  return ALL_COLS.filter((c) => cols.has(c.key)).map((c) => (
    <span key={c.key} style={{ width: 56, flexShrink: 0, textAlign: "right", fontFamily: FONT_NUM, fontSize: 12, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden" }}>
      {vals[c.key] ?? "—"}
    </span>
  ));
}

export function ProjectLeftCell({ g, isOpen, leftW, cols, cpCount, onToggle }: { g: GanttRow; isOpen: boolean; leftW: number; cols: Set<ColKey>; cpCount: number; onToggle: () => void }) {
  return (
    <div
      style={{
        width: leftW, flexShrink: 0, padding: "8px 12px 8px 14px", position: "sticky", left: 0,
        background: isOpen ? C.subtle : C.surface, borderRight: `1px solid ${C.line}`, minWidth: 0,
        display: "flex", gap: 9, alignItems: "center", zIndex: Z_LEFT_COL,
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={`${g.name} — ${isOpen ? "replier" : "déplier"} les tâches`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="btn"
        style={{ color: C.ink500, display: "flex", flexShrink: 0, padding: 3, margin: -3, border: "none", background: "transparent", borderRadius: R.xs, cursor: "pointer" }}
      >
        <span style={{ display: "flex", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform var(--dur-fast) var(--ease-standard)" }}><ChevronRightIcon size={14} /></span>
      </button>
      <Avatar initials={g.responsableInitials} color={g.responsableColor} size={28} fontSize={12} title={`${g.responsable} · ${g.responsableRole}`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...TX.bodyStrong, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
          {g.name}
          {!isOpen && cpCount > 0 ? (
            // Collapsed CP hint — quiet tinted chip (no second hard border); the
            // bar's ring is the primary CP signal, this just surfaces it on a
            // folded row.
            <span title={`${cpCount} tâche(s) sur le chemin critique`} style={{ ...TX.nano, fontWeight: 600, color: C.ink700, background: C.subtle, boxShadow: `inset 0 0 0 1px ${CP_RING}`, borderRadius: R.xxs, padding: "0 5px", lineHeight: "15px", flexShrink: 0 }}>CC</span>
          ) : null}
        </div>
        <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {g.client} · {g.discipline}
        </div>
      </div>
      {colCells(cols, { debut: fmtShort(g.start), fin: fmtShort(g.deadline), avancement: `${g.progress} %` })}
      <StatusPill color={g.statusColor} bg={g.statusBg} label={g.statusLabel} filled />
    </div>
  );
}

export function SubtaskLeftCell({ s, leftW, cols }: { s: GanttBar; leftW: number; cols: Set<ColKey> }) {
  return (
    <div
      style={{
        width: leftW, flexShrink: 0, padding: "0 12px 0 37px", position: "sticky", left: 0,
        background: SURFACE.container, borderRight: `1px solid ${C.line}`, minWidth: 0,
        display: "flex", alignItems: "center", gap: 7, zIndex: Z_LEFT_COL,
        // Repaint the row's 1px top border ON the sticky layer, so a dependency
        // arrow passing under the column can't show through that seam.
        boxShadow: `0 -1px 0 ${C.subtle}`,
      }}
    >
      <Avatar initials={s.assigneeInitials} color={s.color} size={20} fontSize={12} title={s.assigneeInitials} />
      <span style={{ ...TX.micro, color: s.done ? C.ink400 : C.ink900, textDecoration: s.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
        {s.name}
      </span>
      {colCells(cols, {
        debut: fmtShort(s.start),
        fin: fmtShort(s.end),
        duree: `${s.plannedDays} j`,
        marge: s.onCriticalPath ? "0 j" : `${s.float} j`,
        avancement: s.done ? "100 %" : "—",
      })}
    </div>
  );
}

// ── Chart background (single layer): weekend bands, week lines, today line ─────
