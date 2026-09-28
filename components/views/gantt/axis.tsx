"use client";

import { toDate } from "@/lib/format";
import { C, FONT_NUM, R, SURFACE, TX } from "@/lib/tokens";
import { HEADER_H, type Zoom } from "./constants";
import { addDays, dayIndex } from "./dates";

// ── Axis tick model ──────────────────────────────────────────────────────────
// derive only hands us month bands (in %). For the two-tier header, weekend
// shading and week labels we recompute calendar ticks locally from windowStart +
// spanDays, mapping every tick to a pixel offset on the timeline.
interface Tick {
  px: number;
  w: number;
  label: string;
  major?: boolean;
}

export interface Axis {
  top: Tick[]; // year / quarter
  bottom: Tick[]; // month / week
  weekends: { px: number; w: number }[];
  weekLines: number[];
}

const MONS = ["jan", "fév", "mar", "avr", "mai", "jun", "jui", "aoû", "sep", "oct", "nov", "déc"];

export function buildAxis(windowStart: string, spanDays: number, pxPerDay: number, zoom: Zoom): Axis {
  const start = toDate(windowStart);
  const start0 = dayIndex(start);
  const top: Tick[] = [];
  const bottom: Tick[] = [];
  const weekends: { px: number; w: number }[] = [];
  const weekLines: number[] = [];

  const dayPx = (d: Date) => (dayIndex(d) - start0) * pxPerDay;
  const end = addDays(start, spanDays);
  const weekZoom = zoom === "semaine" || zoom === "jour";

  // Weekend bands + week gridlines (calendar Saturdays/Sundays).
  for (let i = 0; i < spanDays; i++) {
    const dow = addDays(start, i).getDay(); // 0 Sun … 6 Sat
    if (dow === 6 || dow === 0) weekends.push({ px: i * pxPerDay, w: pxPerDay });
    if (dow === 1) weekLines.push(i * pxPerDay); // Monday
  }

  const months = (stepMonths: number, first: Date, label: (d: Date) => string, major: (d: Date) => boolean) => {
    const out: Tick[] = [];
    for (let cur = first; cur < end; ) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + stepMonths, 1);
      out.push({ px: dayPx(cur), w: dayPx(next) - dayPx(cur), label: label(cur), major: major(cur) });
      cur = next;
    }
    return out;
  };

  // ── bottom tier ──
  if (weekZoom) {
    // weeks from the first Monday on/after the window start
    const off = (8 - start.getDay()) % 7; // days to next Monday (0 if Monday)
    for (let cur = addDays(start, off); cur < end; cur = addDays(cur, 7)) {
      bottom.push({ px: dayPx(cur), w: 7 * pxPerDay, label: `${cur.getDate()} ${MONS[cur.getMonth()]}` });
    }
  } else {
    bottom.push(...months(1, new Date(start.getFullYear(), start.getMonth(), 1), (d) => MONS[d.getMonth()], () => false));
  }

  // ── top tier ──
  if (weekZoom) {
    top.push(...months(1, new Date(start.getFullYear(), start.getMonth(), 1), (d) => `${MONS[d.getMonth()]} ${d.getFullYear()}`, (d) => d.getMonth() === 0));
  } else {
    top.push(...months(3, new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1), (d) => `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`, (d) => d.getMonth() === 0));
  }

  return { top, bottom, weekends, weekLines };
}

export function ChartBackground({ leftW, timelineW, axis, todayPx, topOffset }: { leftW: number; timelineW: number; axis: Axis; todayPx: number; topOffset: number }) {
  return (
    <div aria-hidden style={{ position: "absolute", left: leftW, top: topOffset, width: timelineW, bottom: 0, pointerEvents: "none", zIndex: 0 }}>
      {/* Weekend bands — barely-there tint; a quiet rhythm cue, not a stripe.
          Dialled down so weekends read as a whisper, not a stripe pattern. */}
      {axis.weekends.map((b, i) => (
        <div key={`we${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: b.px, width: b.w, background: SURFACE.container, opacity: 0.3 }} />
      ))}
      {/* Period dividers — only the major (year/quarter) lines are drawn, faintly,
          so the field reads as open rather than ruled. Minor month/week lines are
          dropped; the header already carries those labels. */}
      {axis.top.filter((t) => t.major).map((t, i) => (
        <div key={`tl${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: t.px, borderLeft: `1px solid ${C.line}` }} />
      ))}
      {/* Today — ONE quiet brand hairline, full bleed. The header carries the
          labelled marker; in the field it's just a soft locating line. */}
      <div style={{ position: "absolute", top: 0, bottom: 0, width: 1, background: C.brand, opacity: 0.5, left: todayPx }} />
    </div>
  );
}

// ── Two-tier sticky header ────────────────────────────────────────────────────

export function AxisHeader({ leftW, timelineW, axis, todayPx, onResize }: { leftW: number; timelineW: number; axis: Axis; todayPx: number; onResize: (e: React.PointerEvent) => void }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: C.subtle, zIndex: 6, height: HEADER_H }}>
      <div
        style={{
          width: leftW, flexShrink: 0, padding: "8px 14px", ...TX.eyebrow, color: C.ink500, position: "sticky", left: 0,
          background: C.subtle, borderRight: `1px solid ${C.line}`, zIndex: 1, display: "flex", alignItems: "center",
        }}
      >
        Projet · responsable
        {/* resize handle */}
        <div
          onPointerDown={onResize}
          title="Redimensionner le panneau"
          style={{ position: "absolute", right: -3, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 3 }}
        />
      </div>
      <div style={{ flex: 1, position: "relative", width: timelineW }}>
        {/* top tier */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: HEADER_H / 2, borderBottom: `1px solid ${C.line}` }}>
          {axis.top.map((t, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: t.px, width: t.w, borderLeft: `1px solid ${t.major ? C.lineStrong : C.line}`, display: "flex", alignItems: "center", paddingLeft: 6, fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, color: C.ink700, whiteSpace: "nowrap", overflow: "hidden" }}>
              {t.label}
            </div>
          ))}
        </div>
        {/* bottom tier — labels only, no vertical fence. The top tier carries the
            structural dividers; repeating a line under every month/week just rules
            the field. Whitespace + alignment do the grouping. */}
        <div style={{ position: "absolute", top: HEADER_H / 2, left: 0, right: 0, bottom: 0 }}>
          {axis.bottom.map((t, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: t.px, width: t.w, display: "flex", alignItems: "center", paddingLeft: 6, fontFamily: FONT_NUM, fontSize: 12, fontWeight: 500, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden" }}>
              {t.label}
            </div>
          ))}
        </div>
        {/* Today marker — one quiet brand hairline + a tinted (not filled-slab)
            chip, so it locates without shouting. */}
        <div style={{ position: "absolute", top: 0, bottom: 0, width: 1, background: "rgba(21,128,61,.75)", left: todayPx, zIndex: 2 }}>
          {/* full-opacity chip (an opacity on the parent dragged it under AA) */}
          <span style={{ position: "absolute", top: 3, left: 3, ...TX.nano, fontWeight: 600, color: C.brandText, background: C.brand50, borderRadius: R.xxs, padding: "0 4px", whiteSpace: "nowrap" }}>Auj.</span>
        </div>
      </div>
    </div>
  );
}

// ── Dependency arrows: chart-wide overlay, 3-segment orthogonal routing ────────
