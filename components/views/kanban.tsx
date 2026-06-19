"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { FilterBar } from "../filter-bar";
import { MinusIcon, PlusIcon, ArrowRightIcon, AlertTriangleIcon, ClockIcon } from "../icons";
import { Avatar, IconButton, ProgressBar, Segmented, EmptyState } from "../ui";
import { buildKanban } from "@/lib/derive";
import type { DerivedProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { toast } from "@/lib/toast";
import { C, FONT_NUM, PHASE_COLORS, R, SH, SPRING, STATUS_META, TX } from "@/lib/tokens";
import { FINAL_PHASE_INDEX, PHASES, STATUSES, type Status } from "@/lib/types";

// ── Group-by engine ──────────────────────────────────────────────────────────
// The board generalises beyond the original phase-only layout. Each grouping
// produces ordered columns from `filtered`; only Phase / Statut carry a real
// "move" semantics (setPhase / setStatus) — Responsable / Discipline are read
// lenses (drag disabled, cards stay tap-to-open).

type GroupKey = "phase" | "statut" | "responsable" | "discipline";

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "phase", label: "Phase" },
  { value: "statut", label: "Statut" },
  { value: "responsable", label: "Responsable" },
  { value: "discipline", label: "Discipline" },
];

interface Column {
  /** Stable key for React + collapse persistence. */
  key: string;
  label: string;
  full: string;
  accent: string;
  /** WIP ceiling for this column (per-phase; default elsewhere). */
  limit: number;
  /** Movability + drop target: phase index / status / null for read lenses. */
  movePhase: number | null;
  moveStatus: Status | null;
  cards: DerivedProject[];
}

// Per-phase WIP ceilings (early studies churn more in parallel than execution).
// TODO(derive): promote to a configurable/derived limit once the store exposes one.
const PHASE_WIP = [8, 6, 6, 5, 4, 6, 4];
const DEFAULT_WIP = 6;

const STORAGE_GROUP = "setec.kanban.groupBy";
const STORAGE_COLLAPSED = "setec.kanban.collapsed";

const numTab: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

// Capacity tiers — never colour-only (an icon/label always accompanies the hue).
type WipTier = "ok" | "warn" | "over";
function wipTier(count: number, limit: number): WipTier {
  if (count > limit) return "over";
  if (count >= limit) return "warn"; // exactly at the ceiling
  return "ok";
}
// Within-limit is the quiet default: neutral ink, no fill, mono meter. Colour is
// reserved for the only states that need attention — at (amber) / over (red).
const WIP_STYLE: Record<WipTier, { color: string; bg: string; meter: string }> = {
  ok: { color: C.ink500, bg: "transparent", meter: C.ink350 },
  warn: { color: STATUS_META["à risque"].color, bg: STATUS_META["à risque"].bg, meter: STATUS_META["à risque"].color },
  over: { color: STATUS_META["en retard"].color, bg: STATUS_META["en retard"].bg, meter: STATUS_META["en retard"].color },
};

export function Kanban() {
  const { filtered, team, setPhase, setStatus, advancePhase, bulkAdvancePhase, openAdd, openProject } = useProjects();

  // ── persisted group-by + collapse ──
  const [groupBy, setGroupBy] = useState<GroupKey>("phase");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const g = localStorage.getItem(STORAGE_GROUP);
      if (g === "phase" || g === "statut" || g === "responsable" || g === "discipline") setGroupBy(g);
      const c = localStorage.getItem(STORAGE_COLLAPSED);
      if (c) {
        const arr = JSON.parse(c);
        if (Array.isArray(arr)) setCollapsed(new Set(arr.map(String)));
      }
    } catch {}
    hydrated.current = true;
  }, []);
  useEffect(() => { if (hydrated.current) try { localStorage.setItem(STORAGE_GROUP, groupBy); } catch {} }, [groupBy]);
  useEffect(() => { if (hydrated.current) try { localStorage.setItem(STORAGE_COLLAPSED, JSON.stringify([...collapsed])); } catch {} }, [collapsed]);

  // ── columns from the chosen grouping ──
  const columns = useMemo<Column[]>(() => {
    if (groupBy === "phase") {
      return buildKanban(filtered).map((col) => ({
        key: `phase-${col.phaseIndex}`,
        label: col.label,
        full: col.full,
        accent: PHASE_COLORS[col.phaseIndex],
        limit: PHASE_WIP[col.phaseIndex] ?? DEFAULT_WIP,
        movePhase: col.phaseIndex,
        moveStatus: null,
        cards: col.cards,
      }));
    }
    if (groupBy === "statut") {
      return STATUSES.map((status) => {
        const meta = STATUS_META[status];
        return {
          key: `statut-${status}`,
          label: meta.label,
          full: "Statut",
          accent: meta.color,
          limit: DEFAULT_WIP,
          movePhase: null,
          moveStatus: status,
          cards: filtered.filter((p) => p.status === status),
        };
      });
    }
    if (groupBy === "responsable") {
      // One column per responsable that actually leads a filtered project.
      const ids = Array.from(new Set(filtered.map((p) => p.responsableId)));
      ids.sort((a, b) => {
        const na = team.find((m) => m.id === a)?.name ?? "";
        const nb = team.find((m) => m.id === b)?.name ?? "";
        return na.localeCompare(nb);
      });
      return ids.map((id) => {
        const m = team.find((x) => x.id === id);
        return {
          key: `resp-${id}`,
          label: m?.name ?? "—",
          full: m?.role ?? "Responsable",
          accent: m?.color ?? C.ink400,
          limit: DEFAULT_WIP,
          movePhase: null,
          moveStatus: null,
          cards: filtered.filter((p) => p.responsableId === id),
        };
      });
    }
    // discipline
    const disciplines = Array.from(new Set(filtered.map((p) => p.discipline))).sort((a, b) => a.localeCompare(b));
    return disciplines.map((d, i) => ({
      key: `disc-${d}`,
      label: d || "—",
      full: "Discipline",
      accent: PHASE_COLORS[i % PHASE_COLORS.length],
      limit: DEFAULT_WIP,
      movePhase: null,
      moveStatus: null,
      cards: filtered.filter((p) => p.discipline === d),
    }));
  }, [groupBy, filtered, team]);

  const movable = groupBy === "phase" || groupBy === "statut";

  const [overKey, setOverKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Cursor-locked drag ghost: a fixed clone that follows the pointer, so a card
  // can travel across a board wider than the viewport (the original couldn't).
  const [ghost, setGhost] = useState<{ card: DerivedProject; x: number; y: number; w: number } | null>(null);

  // Pointer-event drag (works on touch AND mouse). A movement threshold lets a
  // plain tap still open the project. While dragging we (a) follow the pointer
  // with a ghost, (b) resolve the column under the pointer, (c) edge-autoscroll
  // the horizontal board so distant columns become reachable mid-drag.
  const drag = useRef<{
    id: number; card: DerivedProject; startX: number; startY: number;
    offX: number; offY: number; w: number; moved: boolean; overKey: string | null;
  } | null>(null);
  const autoScroll = useRef<number | null>(null);
  const lastPointer = useRef({ x: 0, y: 0 });

  const stopAutoScroll = () => {
    if (autoScroll.current != null) { cancelAnimationFrame(autoScroll.current); autoScroll.current = null; }
  };
  useEffect(() => stopAutoScroll, []);

  const toggleCollapse = (k: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  /** Column key under a viewport point, or null. */
  function keyAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-col-key]");
    return el?.dataset.colKey ?? null;
  }

  /** Apply a drop: phase or status move, with forward/backward awareness. */
  function applyMove(card: DerivedProject, target: Column) {
    if (target.movePhase != null) {
      const from = card.phaseIndex;
      const to = target.movePhase;
      if (to === from) return;
      if (to === from + 1) {
        advancePhase(card.id); // canonical single-step advance
      } else {
        setPhase(card.id, to);
        if (to < from) {
          toast({ message: `« ${card.name} » reculé · ${PHASES[from]} → ${PHASES[to]}`, variant: "info" });
        } else {
          toast({ message: `« ${card.name} » avancé de ${to - from} phases`, variant: "info" });
        }
      }
    } else if (target.moveStatus != null && target.moveStatus !== card.status) {
      setStatus(card.id, target.moveStatus);
    }
  }

  const tick = () => {
    autoScroll.current = null;
    const board = boardRef.current;
    if (!board || !drag.current) return;
    const rect = board.getBoundingClientRect();
    const x = lastPointer.current.x;
    const EDGE = 80;
    let dx = 0;
    if (x < rect.left + EDGE) dx = -Math.ceil((rect.left + EDGE - x) / 6);
    else if (x > rect.right - EDGE) dx = Math.ceil((x - (rect.right - EDGE)) / 6);
    if (dx !== 0) {
      board.scrollLeft += dx;
      const k = keyAtPoint(lastPointer.current.x, lastPointer.current.y);
      drag.current.overKey = k;
      setOverKey(k);
    }
    autoScroll.current = requestAnimationFrame(tick);
  };

  const cardHandlers = (card: DerivedProject) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button != null && e.button !== 0) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      drag.current = {
        id: card.id, card,
        startX: e.clientX, startY: e.clientY,
        offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width,
        moved: false, overKey: null,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== card.id) return;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      if (!d.moved) {
        if (!movable) return; // read lens: no drag, tap still opens
        d.moved = true;
        setDraggingId(card.id);
        setGhost({ card, x: e.clientX - d.offX, y: e.clientY - d.offY, w: d.w });
        if (autoScroll.current == null) autoScroll.current = requestAnimationFrame(tick);
      }
      setGhost((g) => (g ? { ...g, x: e.clientX - d.offX, y: e.clientY - d.offY } : g));
      const k = keyAtPoint(e.clientX, e.clientY);
      d.overKey = k;
      setOverKey(k);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      stopAutoScroll();
      if (!d || d.id !== card.id) return;
      if (d.moved) {
        const k = keyAtPoint(e.clientX, e.clientY) ?? d.overKey;
        const target = columns.find((c) => c.key === k);
        if (target) applyMove(card, target);
      } else {
        openProject(card.id);
      }
      setDraggingId(null);
      setOverKey(null);
      setGhost(null);
    },
    onPointerCancel: () => {
      drag.current = null;
      stopAutoScroll();
      setDraggingId(null);
      setOverKey(null);
      setGhost(null);
    },
    // Keyboard move (a11y): ← / → shift phase, Enter opens.
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProject(card.id); return; }
      if (groupBy === "phase" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const to = e.key === "ArrowRight"
          ? Math.min(card.phaseIndex + 1, FINAL_PHASE_INDEX)
          : Math.max(card.phaseIndex - 1, 0);
        if (to !== card.phaseIndex) {
          const col = columns.find((c) => c.movePhase === to);
          if (col) applyMove(card, col);
        }
      }
    },
  });

  const isEmpty = columns.every((c) => c.cards.length === 0);

  return (
    <>
      <FilterBar
        trailing={
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span style={{ ...TX.caption, color: C.ink500 }}>Grouper&#8239;:</span>
            <Segmented value={groupBy} options={GROUP_OPTIONS} onChange={setGroupBy} />
          </div>
        }
      />
      <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 14px" }} aria-live="polite">
        {movable
          ? "Glissez une carte pour la déplacer · flèches ←/→ au clavier · limite affichée par colonne"
          : "Vue lecture · groupée par " + (groupBy === "responsable" ? "responsable" : "discipline") + " (déplacement désactivé)"}
      </p>

      {isEmpty ? (
        <EmptyState
          title="Aucun projet à afficher"
          hint="Aucun projet ne correspond aux filtres actifs. Ajustez les filtres ou créez un projet."
          icon={<KanbanIconGlyph />}
          action={
            <button onClick={openAdd} className="btn" style={addBtnStyle(true)}>
              <PlusIcon size={14} /> Nouveau projet
            </button>
          }
        />
      ) : (
        <div
          ref={boardRef}
          className="kanban-board enter-stagger"
          role="list"
          style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10, alignItems: "flex-start" }}
        >
          {columns.map((col) => {
            const isOver = movable && overKey === col.key;
            const dimmed = draggingId != null && !isOver; // dim non-target columns
            const tier = wipTier(col.cards.length, col.limit);
            const wip = WIP_STYLE[tier];
            const meterPct = Math.min(100, col.limit ? (col.cards.length / col.limit) * 100 : 0);
            const collapsedCol = collapsed.has(col.key);

            if (collapsedCol) {
              return (
                <button
                  key={col.key}
                  data-col-key={col.key}
                  onClick={() => toggleCollapse(col.key)}
                  title={`${col.full} — déplier`}
                  aria-label={`${col.label} (${col.cards.length}) — déplier la colonne`}
                  className="btn"
                  style={{
                    width: 46, flexShrink: 0, background: C.surface, borderRadius: R.md,
                    border: `1px solid ${isOver ? C.brand : C.line}`,
                    boxShadow: isOver ? `inset 0 0 0 1px ${C.brand}, 0 0 0 3px ${C.brand50}` : undefined,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "10px 0",
                    cursor: "pointer", opacity: dimmed ? 0.45 : 1,
                    transition: "box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard)",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.accent, flexShrink: 0 }} />
                  <span style={{ ...numTab, fontSize: 12, fontWeight: 600, color: wip.color }}>{col.cards.length}</span>
                  <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: C.ink700 }}>{col.label}</span>
                </button>
              );
            }

            return (
              <div
                key={col.key}
                data-col-key={col.key}
                role="listitem"
                style={{
                  width: 268, flexShrink: 0, background: C.surface, borderRadius: R.md,
                  border: `1px solid ${isOver ? C.brand : C.line}`,
                  boxShadow: isOver ? `inset 0 0 0 1px ${C.brand}, 0 0 0 3px ${C.brand50}` : undefined,
                  display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 230px)",
                  opacity: dimmed ? 0.5 : 1,
                  transition: "box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard)",
                }}
              >
                {/* header */}
                <div style={{ padding: "11px 12px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.accent, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 600, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.label}</div>
                        <div style={{ fontSize: 10.5, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.full}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <span
                        title={tier === "over" ? `Limite dépassée (${col.cards.length}/${col.limit})` : tier === "warn" ? `Limite atteinte (${col.cards.length}/${col.limit})` : `Dans la limite (${col.cards.length}/${col.limit})`}
                        style={{ ...numTab, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: wip.color, background: wip.bg, borderRadius: R.xs, padding: tier === "ok" ? "1px 2px" : "1px 8px", transition: "color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard)" }}
                      >
                        {tier === "over" ? <AlertTriangleIcon size={11} /> : null}
                        {col.cards.length} / {col.limit}
                      </span>
                      <IconButton size={28} onClick={() => toggleCollapse(col.key)} title="Replier" aria-label={`Replier la colonne ${col.label}`}><MinusIcon size={14} /></IconButton>
                    </div>
                  </div>
                  {/* capacity meter (non-colour-only: tier icon in the count too) */}
                  <div title={`Capacité ${col.cards.length}/${col.limit}`} style={{ height: 4, borderRadius: R.pill, background: C.subtle, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${meterPct}%`, background: wip.meter, borderRadius: R.pill, transition: "width var(--dur-base) var(--ease-out), background var(--dur-fast) var(--ease-standard)" }} />
                  </div>
                  {/* column quick actions */}
                  {groupBy === "phase" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={openAdd} className="btn" title={`Nouveau projet en ${col.label}`} aria-label={`Nouveau projet en ${col.full}`} style={addBtnStyle(false)}>
                        <PlusIcon size={12} /> Nouveau
                      </button>
                      {col.movePhase != null && col.movePhase < FINAL_PHASE_INDEX && col.cards.length > 0 ? (
                        <button
                          onClick={() => bulkAdvancePhase(col.cards.map((c) => c.id))}
                          className="btn"
                          title={`Avancer tout vers ${PHASES[col.movePhase + 1]}`}
                          aria-label={`Avancer toute la colonne ${col.full}`}
                          style={addBtnStyle(false)}
                        >
                          <ArrowRightIcon size={12} /> Avancer tout
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "2px 8px 12px", overflowY: "auto" }}>
                  <AnimatePresence initial={false}>
                    {col.cards.map((c) => {
                      const isDragged = draggingId === c.id;
                      return (
                        <motion.div
                          key={c.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: isDragged ? 0.35 : 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={SPRING.snappy}
                          {...cardHandlers(c)}
                          role="button"
                          tabIndex={0}
                          aria-label={`${c.name} — ${c.client} · ${c.statusLabel} · ${c.progress}%`}
                          className="lift-hover"
                          style={{
                            background: C.surface,
                            border: `1px solid ${isDragged ? C.lineStrong : C.line}`,
                            borderRadius: R.md, padding: "11px 12px",
                            cursor: movable ? (isDragged ? "grabbing" : "grab") : "pointer",
                            touchAction: "none",
                            boxShadow: isDragged ? SH.sm : undefined,
                          }}
                        >
                          <CardBody c={c} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {/* drop placeholder gap while a card hovers this column */}
                  {isOver && draggingId != null && !col.cards.some((c) => c.id === draggingId) ? (
                    <div style={{ height: 56, border: `1.5px dashed ${C.brand}`, borderRadius: R.md, background: C.brand50, display: "flex", alignItems: "center", justifyContent: "center", ...TX.caption, color: C.brandText }}>
                      Déposer ici
                    </div>
                  ) : null}
                  {col.cards.length === 0 && !isOver ? <div style={{ ...TX.caption, color: C.ink500, textAlign: "center", padding: "16px 0" }}>Aucun projet</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* cursor-locked drag ghost */}
      {ghost ? (
        <div
          style={{
            position: "fixed", left: ghost.x, top: ghost.y, width: ghost.w, zIndex: 90,
            pointerEvents: "none", background: C.surface, border: `1px solid ${C.lineStrong}`,
            borderRadius: R.md, padding: "11px 12px", boxShadow: SH.lg, transform: "rotate(1.5deg) scale(1.03)",
          }}
        >
          <CardBody c={ghost.card} />
        </div>
      ) : null}
    </>
  );
}

// ── card body ────────────────────────────────────────────────────────────────
// Shared by the live card and the drag ghost. MINIMALISM: the project NAME is the
// single focal point. Status is a small coloured dot (carries meaning, doesn't
// shout); client / deadline / budget / progress / rendu are all demoted to quiet
// ink. Colour is reserved for the one thing that needs attention — an overdue
// deadline — so a calm card stays mono.
function CardBody({ c }: { c: DerivedProject }) {
  const overdue = c.deadlineDaysLabel.toLowerCase().includes("retard");
  const extra = Math.max(0, c.members.length - 4);
  const shown = c.members.slice(0, 4);
  return (
    <>
      {/* focal: name, with a quiet status dot — no saturated slab competing */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, minWidth: 0 }}>
        <span
          title={`Statut : ${c.statusLabel}`}
          style={{ width: 7, height: 7, borderRadius: "50%", background: c.statusColor, flexShrink: 0, marginTop: 6 }}
        />
        <div title={c.name} style={{ ...TX.bodyStrong, lineHeight: 1.3, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.name}</div>
      </div>

      {/* secondary metadata — quiet ink, recedes under the name */}
      <div title={c.client} style={{ fontSize: 12, fontWeight: 450, color: C.ink500, marginTop: 4, paddingLeft: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.client}</div>

      {/* progress — mono fill, thin, quiet readout */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }} title={`Avancement ${c.progress}%`}>
        <ProgressBar pct={c.progress} color={C.ink350} height={4} />
        <span style={{ ...numTab, fontSize: 11.5, fontWeight: 600, color: C.ink500, width: 34, textAlign: "right" }}>{c.progress}&#8239;%</span>
      </div>

      {/* deadline + budget — quiet; deadline reddens only when genuinely overdue */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 9 }}>
        <span
          title={`Échéance contractuelle : ${c.deadlineFull}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: overdue ? STATUS_META["en retard"].color : C.ink500, whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          <ClockIcon size={11} />
          {c.deadlineDaysLabel}
        </span>
        <span title={`Honoraires : ${c.budgetFmt}`} style={{ ...numTab, fontSize: 11, fontWeight: 500, color: C.ink500, whiteSpace: "nowrap" }}>{c.budgetFmt}</span>
      </div>

      {/* team avatar group (muted) + next-rendu (quiet) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11, gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center" }} title={`Équipe : ${c.members.map((m) => m.name).join(", ") || "—"}`}>
          {shown.map((m, i) => (
            <span key={m.id} style={{ marginLeft: i === 0 ? 0 : -7, position: "relative", zIndex: shown.length - i }}>
              <Avatar initials={m.initials} color={m.color} size={22} fontSize={9} ring title={`${m.name} · ${m.role}`} />
            </span>
          ))}
          {extra > 0 ? (
            <span style={{ marginLeft: -7, width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: C.ink600, background: C.subtle, border: `2px solid ${C.surface}` }}>+{extra}</span>
          ) : null}
        </div>
        <span title={`Prochain rendu : ${c.renduFull}`} style={{ fontSize: 11, fontWeight: 500, color: C.ink500, whiteSpace: "nowrap" }}>{c.renduDaysLabel}</span>
      </div>
    </>
  );
}

function addBtnStyle(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
    flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
    padding: "5px 8px", borderRadius: R.sm, whiteSpace: "nowrap",
    border: `1px solid ${primary ? C.solid : C.line}`,
    background: primary ? C.solid : C.surface,
    color: primary ? "#fff" : C.ink600,
    transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
  };
}

function KanbanIconGlyph() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="10" rx="1" />
      <rect x="17" y="4" width="4" height="13" rx="1" />
    </svg>
  );
}
