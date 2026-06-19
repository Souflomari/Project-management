"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

import { CaretDownIcon, CheckIcon, CloseIcon } from "./icons";
import { Button, Input, Modal } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, SH, SPRING, STATUS_META, TX, Z } from "@/lib/tokens";
import { PHASES, STATUSES, type Status } from "@/lib/types";
import type { SavedView } from "@/lib/store/projects-context";

/** Multi-select facet state owned by a parent (the table). When supplied,
 *  FilterBar renders honest, multi-select popovers; otherwise it falls back to
 *  the store's single-select facets (kanban / gantt keep their existing UX). */
export interface FacetControls {
  statusSel: Set<Status>;
  toggleStatus: (s: Status) => void;
  clearStatus: () => void;
  respSel: Set<number>;
  toggleResp: (id: number) => void;
  clearResp: () => void;
  phaseSel: Set<number>;
  togglePhase: (i: number) => void;
  clearPhase: () => void;
  /** Honest counts computed against the other active facets. */
  statusCount: (s: Status | "all") => number;
  respCount: (id: number) => number;
  phaseCount: (i: number) => number;
  resetAll: () => void;
  hasAny: boolean;
}

// ───────────────────────────────────────── popover shell

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  return ref;
}

function FacetPopover({
  label,
  badge,
  active,
  children,
}: {
  label: string;
  badge?: number;
  active?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn state-layer"
        style={{
          cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "6px 10px 6px 12px", borderRadius: R.sm,
          display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          // Calm: an active facet reads as neutral-ink with a stronger border, not
          // a green-tinted control — colour is saved for row-level meaning.
          border: `1px solid ${active ? C.lineStrong : C.line}`, background: active ? C.subtle : C.surface, color: active ? C.ink900 : C.ink700,
          transition: "background .12s, border-color .12s",
        }}
      >
        {label}
        {badge ? (
          <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 16, textAlign: "center", padding: "1px 5px", borderRadius: R.xs, background: C.ink800, color: "#fff" }}>{badge}</span>
        ) : null}
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .12s", color: C.ink500 }}>
          <CaretDownIcon size={12} />
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={SPRING.snappy}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: Z.sticky + 1, minWidth: 200, maxHeight: 320, overflowY: "auto",
              background: C.surface, border: `1px solid ${C.lineStrong}`, borderRadius: R.md, boxShadow: SH.overlay, padding: 6,
            }}
          >
            {children(() => setOpen(false))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FacetOption({
  selected, label, count, dot, onToggle,
}: { selected: boolean; label: string; count: number; dot?: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onToggle}
      className="soft-hover"
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", borderRadius: R.xs,
        background: "transparent", border: "none", cursor: "pointer", font: "inherit", textAlign: "left",
        color: count === 0 ? C.ink400 : C.ink800,
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: R.xxs, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: selected ? `1px solid ${C.solid}` : `1.5px solid ${C.lineStrong}`, background: selected ? C.solid : C.surface, color: "#fff" }}>
        {selected ? <CheckIcon size={11} /> : null}
      </span>
      {dot ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} /> : null}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: C.ink400 }}>{count}</span>
    </button>
  );
}

export function FilterBar({ trailing, showViews, facets }: { trailing?: ReactNode; showViews?: boolean; facets?: FacetControls }) {
  const {
    filters, setFilter, filter,
    team, respFilter, setRespFilter, phaseFilter, setPhaseFilter, resetFilters,
    savedViews, saveView, applyView, deleteView,
  } = useProjects();

  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<SavedView | null>(null);
  const [renameName, setRenameName] = useState("");

  const submitSave = () => { const n = viewName.trim(); if (n) saveView(n); setSaveOpen(false); setViewName(""); };
  const submitRename = () => {
    const n = renameName.trim();
    if (renameTarget && n) { deleteView(renameTarget.id); applyView(renameTarget); saveView(n); }
    setRenameTarget(null);
  };

  const hasFacets = facets ? facets.hasAny : filter !== "all" || respFilter != null || phaseFilter != null;
  const reset = facets ? facets.resetAll : resetFilters;

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      {facets ? (
        <>
          {/* honest, multi-select status popover */}
          <FacetPopover label="Statut" badge={facets.statusSel.size} active={facets.statusSel.size > 0}>
            {() => (
              <>
                {STATUSES.map((s) => (
                  <FacetOption
                    key={s}
                    selected={facets.statusSel.has(s)}
                    label={STATUS_META[s].label}
                    count={facets.statusCount(s)}
                    dot={STATUS_META[s].color}
                    onToggle={() => facets.toggleStatus(s)}
                  />
                ))}
                {facets.statusSel.size > 0 ? (
                  <button type="button" onClick={facets.clearStatus} style={clearBtn}>Effacer</button>
                ) : null}
              </>
            )}
          </FacetPopover>

          <FacetPopover label="Phase" badge={facets.phaseSel.size} active={facets.phaseSel.size > 0}>
            {() => (
              <>
                {PHASES.map((ph, i) => (
                  <FacetOption key={ph} selected={facets.phaseSel.has(i)} label={ph} count={facets.phaseCount(i)} onToggle={() => facets.togglePhase(i)} />
                ))}
                {facets.phaseSel.size > 0 ? (
                  <button type="button" onClick={facets.clearPhase} style={clearBtn}>Effacer</button>
                ) : null}
              </>
            )}
          </FacetPopover>

          <FacetPopover label="Responsable" badge={facets.respSel.size} active={facets.respSel.size > 0}>
            {() => (
              <>
                {team.map((m) => (
                  <FacetOption key={m.id} selected={facets.respSel.has(m.id)} label={m.name} count={facets.respCount(m.id)} dot={m.color} onToggle={() => facets.toggleResp(m.id)} />
                ))}
                {facets.respSel.size > 0 ? (
                  <button type="button" onClick={facets.clearResp} style={clearBtn}>Effacer</button>
                ) : null}
              </>
            )}
          </FacetPopover>
        </>
      ) : (
        <>
          {/* legacy store-backed single-select (kanban / gantt) */}
          {filters.map((f) => {
            const a = f.active;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`btn state-layer${a ? " state-on-light" : ""}`}
                style={{
                  cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: R.sm,
                  display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                  border: `1px solid ${a ? C.solid : C.line}`, background: a ? C.solid : C.surface, color: a ? "#fff" : C.ink700,
                  transition: "background .12s, border-color .12s",
                }}
              >
                {f.label}
                <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "1px 6px", borderRadius: R.xs, background: a ? "rgba(255,255,255,.20)" : C.subtle, color: a ? "#fff" : C.ink500 }}>
                  {f.count}
                </span>
              </button>
            );
          })}

          <div style={{ width: 1, height: 22, background: C.line, margin: "0 2px" }} />

          <FacetPopover label="Responsable" active={respFilter != null}>
            {(close) => (
              <>
                <FacetOption selected={respFilter == null} label="Tous" count={0} onToggle={() => { setRespFilter(null); close(); }} />
                {team.map((m) => (
                  <FacetOption key={m.id} selected={respFilter === m.id} label={m.name} count={0} dot={m.color} onToggle={() => { setRespFilter(m.id); close(); }} />
                ))}
              </>
            )}
          </FacetPopover>
          <FacetPopover label="Phase" active={phaseFilter != null}>
            {(close) => (
              <>
                <FacetOption selected={phaseFilter == null} label="Toutes" count={0} onToggle={() => { setPhaseFilter(null); close(); }} />
                {PHASES.map((ph, i) => (
                  <FacetOption key={ph} selected={phaseFilter === i} label={ph} count={0} onToggle={() => { setPhaseFilter(i); close(); }} />
                ))}
              </>
            )}
          </FacetPopover>
        </>
      )}

      {hasFacets ? (
        <button onClick={reset} className="soft-hover" style={{ display: "inline-flex", alignItems: "center", gap: 4, ...TX.caption, color: C.ink500, background: "none", border: "none", borderRadius: R.xs, padding: "4px 6px", cursor: "pointer" }}>
          <CloseIcon size={12} /> Réinitialiser
        </button>
      ) : null}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {trailing}
        {showViews ? (
          <>
            {/* saved-views strip: labelled, active-state chips with rename/delete */}
            {savedViews.map((v) => (
              <span key={v.id} className="state-layer" style={{ display: "inline-flex", alignItems: "center", gap: 2, border: `1px solid ${C.line}`, borderRadius: R.sm, background: C.surface, paddingLeft: 2 }}>
                <button
                  onClick={() => applyView(v)}
                  title={`Appliquer « ${v.name} »`}
                  style={{ font: "inherit", fontSize: 12, fontWeight: 600, color: C.ink700, background: "transparent", border: "none", padding: "5px 4px 5px 8px", cursor: "pointer", borderRadius: R.xs }}
                >
                  {v.name}
                </button>
                <button onClick={() => { setRenameTarget(v); setRenameName(v.name); }} title="Renommer" aria-label={`Renommer ${v.name}`} style={iconChip}>
                  <EditPencil />
                </button>
                <button onClick={() => deleteView(v.id)} title="Supprimer" aria-label={`Supprimer ${v.name}`} style={iconChip}>
                  <CloseIcon size={11} />
                </button>
              </span>
            ))}
            <Button size="sm" variant="secondary" onClick={() => { setViewName(""); setSaveOpen(true); }}>
              Enregistrer la vue
            </Button>
          </>
        ) : null}
      </div>

      {saveOpen ? (
        <Modal
          title="Enregistrer la vue"
          subtitle="Conserve les filtres, la recherche et le tri actuels."
          width={420}
          onClose={() => setSaveOpen(false)}
          footer={
            <>
              <Button size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>Annuler</Button>
              <Button size="sm" onClick={submitSave} disabled={!viewName.trim()}>Enregistrer</Button>
            </>
          }
        >
          <Input
            autoFocus
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitSave(); } }}
            placeholder="Nom de la vue"
            aria-label="Nom de la vue"
          />
        </Modal>
      ) : null}

      {renameTarget ? (
        <Modal
          title="Renommer la vue"
          width={420}
          onClose={() => setRenameTarget(null)}
          footer={
            <>
              <Button size="sm" variant="ghost" onClick={() => setRenameTarget(null)}>Annuler</Button>
              <Button size="sm" onClick={submitRename} disabled={!renameName.trim()}>Renommer</Button>
            </>
          }
        >
          <Input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitRename(); } }}
            placeholder="Nom de la vue"
            aria-label="Nouveau nom de la vue"
          />
        </Modal>
      ) : null}
    </div>
  );
}

const clearBtn: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 4, padding: "7px 8px", borderTop: `1px solid ${C.line}`,
  background: "transparent", border: "none", borderTopColor: C.line, color: C.ink500, font: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left",
};

const iconChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 26,
  background: "transparent", border: "none", color: C.ink400, cursor: "pointer", padding: 0,
};

function EditPencil() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
