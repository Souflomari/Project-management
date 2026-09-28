"use client";

import { useRef, useState } from "react";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "../../icons";
import { Popover } from "../../overlay/popover";
import { IconButton } from "../../ui";
import { fmtFull, isToday, MONS_LONG, toDate, toISO, weekRange } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, SURFACE, TX } from "@/lib/tokens";
import { PHASES, PHASES_FULL } from "@/lib/types";
import { WEEKDAYS_SHORT } from "./shared";

// Calendar toolbar pieces: period title + mini-month picker, the project
// facet and the interactive phase legend.

export function MiniMonthTitle({ label, anchorISO }: { label: string; anchorISO: string }) {
  const { jumpTo } = useCalAnchorSetter();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        ref={anchorRef}
        type="button"
        className="btn row-hover row-focus"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label} — choisir une date`}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "2px 6px",
          borderRadius: R.sm,
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        <h2 style={{ ...num(20), margin: 0, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</h2>
        <span style={{ color: C.ink400, display: "flex" }}>
          <CalendarIcon size={16} />
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="dialog" label="Choisir une date" width={248} padding={12} maxHeight={400}>
        <MiniMonth
          anchorISO={anchorISO}
          onPick={(iso) => {
            jumpTo(iso);
            setOpen(false);
          }}
        />
      </Popover>
    </div>
  );
}

/** Month offset between two ISO dates (calendar months). */
function monthDelta(fromISO: string, toISO_: string): number {
  const a = toDate(fromISO);
  const b = toDate(toISO_);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Same day-of-month `delta` months away (clamped to the month's length). */
export function shiftMonthISO(iso: string, delta: number): string {
  const d = toDate(iso);
  const first = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), dim)));
}

/** The store exposes prev/next/today but no absolute anchor setter; jump by
 *  stepping. The store steps WEEKS in "semaine" mode and MONTHS otherwise, so
 *  the step count must be computed in the same unit (the old version always
 *  counted months, landing on the wrong week). */
export function useCalAnchorSetter() {
  const { calAnchor, calMode, calPrev, calNext } = useProjects();
  const jumpTo = (targetISO: string) => {
    let delta: number;
    if (calMode === "semaine") {
      const from = toDate(weekRange(calAnchor).start);
      const to = toDate(weekRange(targetISO).start);
      // Calendar-day diff via UTC dates (DST-proof), then whole weeks.
      const days = Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000);
      delta = Math.round(days / 7);
    } else {
      delta = monthDelta(calAnchor, targetISO);
    }
    const step = delta > 0 ? calNext : calPrev;
    for (let i = 0; i < Math.abs(delta); i++) step();
  };
  return { jumpTo };
}

function MiniMonth({ anchorISO, onPick }: { anchorISO: string; onPick: (iso: string) => void }) {
  const [view, setView] = useState(() => {
    const d = toDate(anchorISO);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const first = new Date(view.y, view.m, 1);
  const startW = (first.getDay() + 6) % 7;
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startW; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  const stepMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <IconButton size={28} onClick={() => stepMonth(-1)} aria-label="Mois précédent">
          <ChevronLeftIcon size={14} />
        </IconButton>
        <div style={{ ...TX.bodyStrong, color: C.ink900 }}>
          {MONS_LONG[view.m]} {view.y}
        </div>
        <IconButton size={28} onClick={() => stepMonth(1)} aria-label="Mois suivant">
          <ChevronRightIcon size={14} />
        </IconButton>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} style={{ ...TX.nano, color: C.ink400, textAlign: "center", padding: "2px 0" }}>
            {w[0]}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const today = isToday(iso);
          return (
            <button
              key={i}
              type="button"
              // Non-today days take the hover wash; today keeps its green fill (a
              // wash would erase the accent), so every picker day still reacts.
              className={today ? "btn" : "btn row-hover"}
              onClick={() => onPick(iso)}
              aria-current={today ? "date" : undefined}
              aria-label={fmtFull(iso)}
              style={{
                border: "none",
                cursor: "pointer",
                background: today ? C.brand : "transparent",
                color: today ? C.surface : C.ink700,
                borderRadius: R.xs,
                height: 28,
                ...num(12),
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectFacet({
  projects,
  selected,
  onToggle,
  onClear,
}: {
  projects: { id: number; name: string }[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const count = selected.size;
  const labelText = count === 0 ? "Tous les projets" : `${count} projet${count > 1 ? "s" : ""}`;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={anchorRef}
        type="button"
        // btn-secondary supplies the designed hover/active (wash + border lift) so
        // the trigger reacts like every other secondary control (it's the same
        // white-surface look as the "Aujourd'hui" button), not just a 1px nudge.
        className="btn btn-secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 12px",
          border: `1px solid ${count ? C.brand : C.lineStrong}`,
          background: count ? C.brand50 : C.surface,
          color: count ? C.brandText : C.ink700,
          borderRadius: R.sm,
          cursor: "pointer",
          ...TX.caption,
          fontWeight: 600,
        }}
      >
        {labelText}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} role="dialog" label="Filtrer par projet" width={264} align="end">
          <button
            type="button"
            className="btn row-hover row-focus"
            onClick={onClear}
            style={facetRowStyle(count === 0)}
            aria-pressed={count === 0}
          >
            <span style={{ ...checkboxDot(count === 0) }} />
            Tous les projets
          </button>
          {projects.map((p) => {
            const sel = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className="btn row-hover row-focus"
                aria-pressed={sel}
                onClick={() => onToggle(p.id)}
                style={facetRowStyle(sel)}
              >
                <span style={checkboxDot(sel)} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              </button>
            );
          })}
      </Popover>
    </div>
  );
}

function facetRowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minHeight: 34,
    padding: "6px 8px",
    border: "none",
    background: active ? C.brand50 : "transparent",
    color: C.ink800,
    borderRadius: R.sm,
    cursor: "pointer",
    textAlign: "left",
    ...TX.caption,
  };
}

function checkboxDot(active: boolean): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: R.xxs,
    flexShrink: 0,
    border: active ? `1px solid ${C.brand}` : `1.5px solid ${C.lineStrong}`,
    background: active ? C.brand : C.surface,
    boxShadow: active ? `inset 0 0 0 2px ${C.surface}` : "none",
  };
}

export function PhaseLegend({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<number>;
  onToggle: (i: number) => void;
  onClear: () => void;
}) {
  // One compact, quiet legend line: the phase letters double as filter chips.
  // No coloured swatches — phase identity is the letter; the active filter is a
  // neutral slate emphasis (selection, not decoration).
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 4px", alignItems: "center", marginBottom: 12 }}>
      <span style={{ ...TX.nano, color: C.ink400, marginRight: 4 }}>Phase&nbsp;:</span>
      {PHASES.map((ph, i) => {
        const on = selected.size === 0 || selected.has(i);
        const explicit = selected.has(i);
        return (
          <button
            key={ph}
            type="button"
            // row-hover adds the visible brand-tinted hover wash (a 1px .btn lift
            // alone was too faint on these transparent chips); row-focus = ring.
            className="btn row-hover row-focus"
            aria-pressed={explicit}
            title={`${ph} · ${PHASES_FULL[i]}${explicit ? " (filtre actif)" : ""}`}
            onClick={() => onToggle(i)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 24,
              padding: "2px 8px",
              borderRadius: R.sm,
              border: `1px solid ${explicit ? C.lineStrong : "transparent"}`,
              background: explicit ? SURFACE.containerHigh : "transparent",
              color: explicit ? C.ink800 : C.ink500,
              // Phases filtered OUT read as struck-through (not as faint,
              // illegible text — they are still actionable toggles).
              textDecoration: on ? "none" : "line-through",
              cursor: "pointer",
              ...TX.nano,
              fontWeight: 600,
            }}
          >
            {ph}
          </button>
        );
      })}
      {selected.size ? (
        <button
          type="button"
          className="btn row-hover row-focus"
          onClick={onClear}
          style={{ border: "none", background: "transparent", cursor: "pointer", ...TX.nano, color: C.brandText, padding: "3px 6px", borderRadius: R.sm }}
        >
          Réinitialiser
        </button>
      ) : (
        <span style={{ ...TX.nano, color: C.ink400, marginLeft: 6 }}>· glissez une barre pour replanifier</span>
      )}
    </div>
  );
}
