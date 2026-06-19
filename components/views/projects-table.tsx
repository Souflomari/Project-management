"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

import { FilterBar, type FacetControls } from "../filter-bar";
import { CaretDownIcon, CheckIcon } from "../icons";
import { Avatar, Button, Checkbox, PhaseBadge, ProgressBar, Select, StatusPill } from "../ui";
import { buildBudget, type DerivedProject, type ProjectBudget } from "@/lib/derive";
import { fmtBudget } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, SH, SPRING, STATUS_META, TX, Z } from "@/lib/tokens";
import { PHASES, STATUSES, type Status, type TeamMember } from "@/lib/types";

// ───────────────────────────────────────── columns

type ColKey = "phase" | "rendu" | "echeance" | "progress" | "budget" | "health" | "team" | "resp" | "status";
type SortKey = "name" | ColKey;

interface ColDef { key: ColKey; label: string; sortable: boolean; defaultOn: boolean; align?: "right" | "center" }

const COLUMNS: ColDef[] = [
  { key: "phase", label: "Phase", sortable: true, defaultOn: true },
  { key: "rendu", label: "Prochain rendu", sortable: true, defaultOn: true },
  { key: "echeance", label: "Échéance", sortable: true, defaultOn: false },
  { key: "progress", label: "Avancement", sortable: true, defaultOn: true },
  { key: "budget", label: "Honoraires", sortable: true, defaultOn: true, align: "right" },
  { key: "health", label: "Marge", sortable: true, defaultOn: false, align: "center" },
  { key: "team", label: "Équipe", sortable: false, defaultOn: false, align: "center" },
  { key: "resp", label: "Resp.", sortable: true, defaultOn: true, align: "center" },
  { key: "status", label: "Statut", sortable: true, defaultOn: true },
];

const COL_WIDTH: Record<ColKey, string> = {
  phase: "64px", rendu: "1.4fr", echeance: "1.1fr", progress: "1.2fr", budget: ".9fr",
  health: "70px", team: "96px", resp: "46px", status: "116px",
};

const COLS_KEY = "setec.table.cols";
const GROUP_KEY = "setec.table.group";

type GroupBy = "none" | "status" | "phase" | "resp";

// ───────────────────────────────────────── small hooks

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

function usePersistedSet(key: string, fallback: () => Set<string>): [Set<string>, (s: Set<string>) => void] {
  const [set, setSet] = useState<Set<string>>(fallback);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setSet(new Set(JSON.parse(raw))); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (s: Set<string>) => { setSet(s); try { localStorage.setItem(key, JSON.stringify([...s])); } catch {} };
  return [set, update];
}

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

// ───────────────────────────────────────── sort compare

function compare(a: DerivedProject, b: DerivedProject, key: SortKey, budgets: Map<number, ProjectBudget>): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "phase": return a.phaseIndex - b.phaseIndex;
    case "rendu": return (a.nextTask?.end ?? "9999").localeCompare(b.nextTask?.end ?? "9999");
    case "echeance": return a.deadline.localeCompare(b.deadline);
    case "progress": return a.progress - b.progress;
    case "budget": return a.budget - b.budget;
    case "health": return (budgets.get(a.id)?.marginPct ?? 0) - (budgets.get(b.id)?.marginPct ?? 0);
    case "resp": return a.responsable.name.localeCompare(b.responsable.name);
    case "status": return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
    default: return 0;
  }
}

// ───────────────────────────────────────── generic inline-edit popover

function InlinePopover({
  trigger, children, label,
}: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }} onClick={(e) => e.stopPropagation()}>
      {trigger(open, () => setOpen((o) => !o))}
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={SPRING.snappy}
            style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: Z.sticky + 2, minWidth: 180, maxHeight: 300, overflowY: "auto", background: C.surface, border: `1px solid ${C.lineStrong}`, borderRadius: R.md, boxShadow: SH.overlay, padding: 6 }}
          >
            {children(() => setOpen(false))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

function MenuOption({ selected, label, dot, onSelect }: { selected: boolean; label: string; dot?: string; onSelect: () => void }) {
  return (
    <button
      type="button" role="menuitemradio" aria-checked={selected} onClick={onSelect} className="soft-hover"
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", borderRadius: R.xs, background: "transparent", border: "none", cursor: "pointer", font: "inherit", textAlign: "left", color: C.ink800 }}
    >
      {dot ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} /> : null}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ width: 14, display: "inline-flex", color: C.brandText }}>{selected ? <CheckIcon size={13} /> : null}</span>
    </button>
  );
}

// ───────────────────────────────────────── inline editors

function StatusCell({ p, setStatus }: { p: DerivedProject; setStatus: (id: number, s: Status) => void }) {
  return (
    <InlinePopover
      label={`Statut de ${p.name}`}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} className="soft-hover" style={editTrigger}>
          <StatusPill color={p.statusColor} bg={p.statusBg} label={p.statusLabel} filled />
        </button>
      )}
    >
      {(close) => STATUSES.map((s) => (
        <MenuOption key={s} selected={p.status === s} label={STATUS_META[s].label} dot={STATUS_META[s].color} onSelect={() => { if (s !== p.status) setStatus(p.id, s); close(); }} />
      ))}
    </InlinePopover>
  );
}

function PhaseCell({ p, setPhase }: { p: DerivedProject; setPhase: (id: number, i: number) => void }) {
  return (
    <InlinePopover
      label={`Phase de ${p.name}`}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} className="soft-hover" style={editTrigger}>
          <PhaseBadge label={p.phaseLabel} />
        </button>
      )}
    >
      {(close) => PHASES.map((ph, i) => (
        <MenuOption key={ph} selected={p.phaseIndex === i} label={`${ph} · ${i + 1}`} onSelect={() => { if (i !== p.phaseIndex) setPhase(p.id, i); close(); }} />
      ))}
    </InlinePopover>
  );
}

function RespCell({ p, team, setResp }: { p: DerivedProject; team: TeamMember[]; setResp: (id: number, rid: number) => void }) {
  return (
    <InlinePopover
      label={`Responsable de ${p.name}`}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} className="soft-hover" style={{ ...editTrigger, borderRadius: "50%" }} title={`${p.responsable.name} · ${p.responsable.role}`}>
          <Avatar initials={p.responsable.initials} color={p.responsable.color} size={30} fontSize={11} />
        </button>
      )}
    >
      {(close) => team.map((m) => (
        <MenuOption key={m.id} selected={p.responsableId === m.id} label={m.name} dot={m.color} onSelect={() => { if (m.id !== p.responsableId) setResp(p.id, m.id); close(); }} />
      ))}
    </InlinePopover>
  );
}

function BudgetCell({ p, updateProject }: { p: DerivedProject; updateProject: (id: number, patch: { budget: number }) => void }) {
  return (
    <InlinePopover
      label={`Honoraires de ${p.name}`}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} className="soft-hover" style={{ ...editTrigger, ...num(14), fontWeight: 500, color: C.ink700 }}>
          {p.budgetFmt}
        </button>
      )}
    >
      {(close) => <BudgetEditor value={p.budget} onCommit={(v) => { if (v !== p.budget) updateProject(p.id, { budget: v }); close(); }} />}
    </InlinePopover>
  );
}

function BudgetEditor({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = () => { const n = Math.max(0, Math.round(Number(v) || 0)); onCommit(n); };
  return (
    <div style={{ padding: 4, minWidth: 150 }}>
      <label style={{ ...TX.eyebrow, color: C.ink400, display: "block", marginBottom: 6 }}>Honoraires (k€)</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          ref={ref}
          type="number" min={0} inputMode="numeric"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          aria-label="Honoraires en milliers d’euros"
          style={{ flex: 1, height: 32, padding: "0 10px", border: `1px solid ${C.line}`, borderRadius: R.sm, fontFamily: "inherit", fontSize: 14, color: C.ink900, outline: "none" }}
        />
        <Button size="sm" onClick={commit}>OK</Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── cell renderers (shared table + cards)

function HealthDot({ b }: { b: ProjectBudget | undefined }) {
  if (!b) return <span style={{ color: C.ink400 }}>—</span>;
  const color = b.overBudget ? C.danger : b.marginPct < 15 ? "#9A4708" : C.brand;
  const state = b.overBudget ? "dépassement" : b.marginPct < 15 ? "marge faible" : "marge saine";
  return (
    <span title={`${state} · marge ${b.marginPct}%`} aria-label={`${state}, marge ${b.marginPct}%`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: b.overBudget ? 1 : "50%", background: color, display: "inline-block" }} />
      <span style={{ ...num(12), color }}>{b.marginPct}<span style={{ fontSize: 10 }}>%</span></span>
    </span>
  );
}

function TeamStack({ members }: { members: TeamMember[] }) {
  const show = members.slice(0, 3);
  const extra = members.length - show.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {show.map((m, i) => (
        <span key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: show.length - i }} title={`${m.name} · ${m.role}`}>
          <Avatar initials={m.initials} color={m.color} size={24} fontSize={9} ring />
        </span>
      ))}
      {extra > 0 ? (
        <span style={{ marginLeft: -8, width: 24, height: 24, borderRadius: "50%", border: `2px solid ${C.surface}`, background: C.subtle, color: C.ink600, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>+{extra}</span>
      ) : null}
    </span>
  );
}

function renderCell(key: ColKey, p: DerivedProject, ctx: CellCtx): ReactNode {
  switch (key) {
    case "phase": return <PhaseCell p={p} setPhase={ctx.setPhase} />;
    case "rendu":
      return (
        <div style={{ minWidth: 0 }}>
          <div style={{ ...TX.caption, fontWeight: 540, color: C.ink800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.renduLabel}</div>
          <div style={{ ...TX.caption, color: C.ink500 }}>{p.renduFmt} · <span style={{ color: p.renduDueColor, fontWeight: 600 }}>{p.renduDaysLabel}</span></div>
        </div>
      );
    case "echeance":
      return (
        <div style={{ minWidth: 0 }}>
          <div style={{ ...TX.caption, color: C.ink700, whiteSpace: "nowrap" }}>{p.deadlineFull}</div>
          <div style={{ ...TX.caption, color: C.ink500 }}>{p.deadlineDaysLabel}</div>
        </div>
      );
    case "progress":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ProgressBar pct={p.progress} color={p.ring} />
          <span style={{ ...num(13), width: 38, textAlign: "right", color: p.status === "à jour" ? C.brandText : C.ink700 }}>{p.progress}&#8239;%</span>
        </div>
      );
    case "budget": return <BudgetCell p={p} updateProject={ctx.updateProject} />;
    case "health": return <HealthDot b={ctx.budgets.get(p.id)} />;
    case "team": return <TeamStack members={p.members} />;
    case "resp": return <RespCell p={p} team={ctx.team} setResp={ctx.setResp} />;
    case "status": return <StatusCell p={p} setStatus={ctx.setStatus} />;
  }
}

interface CellCtx {
  team: TeamMember[];
  budgets: Map<number, ProjectBudget>;
  setStatus: (id: number, s: Status) => void;
  setPhase: (id: number, i: number) => void;
  setResp: (id: number, rid: number) => void;
  updateProject: (id: number, patch: { budget: number }) => void;
}

const editTrigger: React.CSSProperties = {
  background: "transparent", border: "none", padding: "2px 4px", borderRadius: R.xs, cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", textAlign: "left",
};

// ───────────────────────────────────────── group helpers

function groupValue(p: DerivedProject, by: GroupBy): { key: string; label: string } {
  switch (by) {
    case "status": return { key: p.status, label: p.statusLabel };
    case "phase": return { key: String(p.phaseIndex), label: `${p.phaseLabel} · ${p.phaseFull}` };
    case "resp": return { key: String(p.responsableId), label: p.responsable.name };
    default: return { key: "all", label: "" };
  }
}

// ───────────────────────────────────────── component

export function ProjectsTable() {
  const {
    searched, team, openProject, openAdd, search, setSearch,
    setStatus, setPhase, updateProject, bulkSetResponsable, bulkSetStatus, bulkAdvancePhase,
    tableSort, setTableSort, selectedIds: sel, toggleSelected, selectAll, clearSelected,
    filter, setFilter, respFilter, setRespFilter, phaseFilter, setPhaseFilter,
  } = useProjects();

  const isMobile = useMediaQuery("(max-width: 720px)");

  // ---- multi-select facets (local; mirror first selection to store for URL/saved-views) ----
  const [statusSel, setStatusSel] = useState<Set<Status>>(filter === "all" ? new Set() : new Set([filter]));
  const [respSel, setRespSel] = useState<Set<number>>(respFilter != null ? new Set([respFilter]) : new Set());
  const [phaseSel, setPhaseSel] = useState<Set<number>>(phaseFilter != null ? new Set([phaseFilter]) : new Set());

  // Keep store single-select roughly in sync (saved-views / URL / cross-view).
  useEffect(() => { setFilter(statusSel.size === 1 ? [...statusSel][0] : "all"); }, [statusSel, setFilter]);
  useEffect(() => { setRespFilter(respSel.size === 1 ? [...respSel][0] : null); }, [respSel, setRespFilter]);
  useEffect(() => { setPhaseFilter(phaseSel.size === 1 ? [...phaseSel][0] : null); }, [phaseSel, setPhaseFilter]);

  // Adopt single-select changes coming from the store (e.g. applying a saved view).
  useEffect(() => {
    if (filter === "all") { if (statusSel.size === 1) setStatusSel(new Set()); }
    else if (!(statusSel.size === 1 && statusSel.has(filter))) setStatusSel(new Set([filter]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);
  useEffect(() => {
    if (respFilter == null) { if (respSel.size === 1) setRespSel(new Set()); }
    else if (!(respSel.size === 1 && respSel.has(respFilter))) setRespSel(new Set([respFilter]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respFilter]);
  useEffect(() => {
    if (phaseFilter == null) { if (phaseSel.size === 1) setPhaseSel(new Set()); }
    else if (!(phaseSel.size === 1 && phaseSel.has(phaseFilter))) setPhaseSel(new Set([phaseFilter]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseFilter]);

  const matches = (p: DerivedProject, opts?: { ignore?: "status" | "resp" | "phase" }) =>
    (opts?.ignore === "status" || statusSel.size === 0 || statusSel.has(p.status)) &&
    (opts?.ignore === "resp" || respSel.size === 0 || respSel.has(p.responsableId)) &&
    (opts?.ignore === "phase" || phaseSel.size === 0 || phaseSel.has(p.phaseIndex));

  const filtered = useMemo(() => searched.filter((p) => matches(p)), [searched, statusSel, respSel, phaseSel]);

  const facets: FacetControls = {
    statusSel, toggleStatus: (s) => setStatusSel((prev) => toggle(prev, s)), clearStatus: () => setStatusSel(new Set()),
    respSel, toggleResp: (id) => setRespSel((prev) => toggle(prev, id)), clearResp: () => setRespSel(new Set()),
    phaseSel, togglePhase: (i) => setPhaseSel((prev) => toggle(prev, i)), clearPhase: () => setPhaseSel(new Set()),
    // honest counts: each facet's option count ignores its own dimension
    statusCount: (s) => searched.filter((p) => matches(p, { ignore: "status" }) && (s === "all" || p.status === s)).length,
    respCount: (id) => searched.filter((p) => matches(p, { ignore: "resp" }) && p.responsableId === id).length,
    phaseCount: (i) => searched.filter((p) => matches(p, { ignore: "phase" }) && p.phaseIndex === i).length,
    resetAll: () => { setStatusSel(new Set()); setRespSel(new Set()); setPhaseSel(new Set()); setSearch(""); },
    hasAny: statusSel.size > 0 || respSel.size > 0 || phaseSel.size > 0,
  };

  // ---- budgets (memoized per portfolio) ----
  const budgets = useMemo(() => {
    const m = new Map<number, ProjectBudget>();
    for (const p of searched) m.set(p.id, buildBudget(p, team));
    return m;
  }, [searched, team]);

  // ---- columns ----
  const [visibleCols, setVisibleCols] = usePersistedSet(COLS_KEY, () => new Set(COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)));
  const cols = COLUMNS.filter((c) => visibleCols.has(c.key));

  // ---- group-by ----
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  useEffect(() => { try { const g = localStorage.getItem(GROUP_KEY) as GroupBy | null; if (g) setGroupBy(g); } catch {} }, []);
  const changeGroup = (g: GroupBy) => { setGroupBy(g); try { localStorage.setItem(GROUP_KEY, g); } catch {} };
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ---- sort ----
  const sort = tableSort as { key: SortKey; dir: 1 | -1 } | null;
  const sorted = useMemo(
    () => (sort ? [...filtered].sort((a, b) => compare(a, b, sort.key, budgets) * sort.dir) : filtered),
    [filtered, sort, budgets],
  );
  const toggleSort = (key: SortKey) =>
    setTableSort(sort && sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 });

  // ---- selection ----
  const selectedIds = sorted.filter((r) => sel.has(r.id)).map((r) => r.id);
  const allOn = sorted.length > 0 && sorted.every((r) => sel.has(r.id));
  const lastClicked = useRef<number | null>(null);
  const toggleOne = (id: number) => { toggleSelected(id); lastClicked.current = id; };
  const rangeSelect = (id: number) => {
    const ids = sorted.map((r) => r.id);
    const anchor = lastClicked.current;
    const from = anchor != null ? ids.indexOf(anchor) : -1;
    const to = ids.indexOf(id);
    if (from === -1 || to === -1) { toggleOne(id); return; }
    const [lo, hi] = from < to ? [from, to] : [to, from];
    const next = new Set(sel);
    for (let i = lo; i <= hi; i++) next.add(ids[i]);
    selectAll([...next]);
    lastClicked.current = id;
  };
  const toggleAll = () => (allOn ? clearSelected() : selectAll(sorted.map((r) => r.id)));

  // ---- grouped layout ----
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", rows: sorted }];
    const map = new Map<string, { label: string; rows: DerivedProject[] }>();
    for (const p of sorted) {
      const { key, label } = groupValue(p, groupBy);
      const g = map.get(key) ?? { label, rows: [] };
      g.rows.push(p);
      map.set(key, g);
    }
    return [...map.entries()].map(([key, g]) => ({ key, label: g.label, rows: g.rows }));
  }, [sorted, groupBy]);

  const cellCtx: CellCtx = {
    team, budgets, setStatus, setPhase,
    setResp: (id, rid) => bulkSetResponsable([id], rid),
    updateProject,
  };

  // keyboard row navigation (up/down move focus between rows)
  const onRowKeyNav = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = Array.from((e.currentTarget.closest("[data-rowgroup]") ?? document).querySelectorAll<HTMLElement>("[data-row]"));
    const i = rows.indexOf(e.currentTarget as HTMLElement);
    const next = rows[i + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); }
  };

  const gridTemplate = `34px 2.4fr ${cols.map((c) => COL_WIDTH[c.key]).join(" ")}`;

  return (
    <>
      <FilterBar showViews facets={facets} trailing={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GroupByControl value={groupBy} onChange={changeGroup} />
          <ColumnsControl columns={COLUMNS} visible={visibleCols} onChange={setVisibleCols} />
        </div>
      } />

      {/* mobile search (header search is hidden ≤640) */}
      {isMobile ? (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un projet…"
          aria-label="Rechercher un projet"
          style={{ width: "100%", height: 38, padding: "0 12px", marginBottom: 12, border: `1px solid ${C.line}`, borderRadius: R.sm, fontFamily: "inherit", fontSize: 15, color: C.ink900, outline: "none" }}
        />
      ) : null}

      {selectedIds.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px 9px 16px", marginBottom: 12, background: C.ink900, color: C.surface, borderRadius: R.md, boxShadow: SH.md, flexWrap: "wrap" }}>
          <span style={{ ...TX.bodyStrong, color: C.surface }}>{selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}</span>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,.16)" }} />
          <Select size="sm" value="" aria-label="Changer le statut" onChange={(e) => { if (e.target.value) { bulkSetStatus(selectedIds, e.target.value as Status); clearSelected(); } }} style={{ width: 150 }}>
            <option value="">Changer le statut…</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
          <Select size="sm" value="" aria-label="Réassigner" onChange={(e) => { if (e.target.value) { bulkSetResponsable(selectedIds, Number(e.target.value)); clearSelected(); } }} style={{ width: 160 }}>
            <option value="">Réassigner à…</option>
            {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => { bulkAdvancePhase(selectedIds); clearSelected(); }}>Avancer la phase</Button>
          <button onClick={clearSelected} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,.7)", ...TX.bodyStrong, cursor: "pointer", padding: "4px 6px" }}>Désélectionner</button>
        </div>
      ) : null}

      {isMobile ? (
        <MobileCards groups={groups} groupBy={groupBy} budgets={budgets} sel={sel} toggleOne={toggleOne} openProject={openProject} cellCtx={cellCtx} empty={searched.length === 0} openAdd={openAdd} />
      ) : (
        <div className="table-scroll">
          <div
            className="enter-rise"
            role="grid"
            aria-label="Projets"
            aria-rowcount={sorted.length}
            style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, overflow: "hidden", minWidth: 760, boxShadow: SH.sm }}
          >
            {/* sticky header */}
            <div
              role="row"
              style={{
                display: "grid", gridTemplateColumns: gridTemplate, gap: 12, padding: "11px 18px",
                borderBottom: `1px solid ${C.line}`, ...TX.overline, color: C.ink500, alignItems: "center",
                position: "sticky", top: 0, zIndex: Z.sticky, background: C.surface, boxShadow: SH.xs,
              }}
            >
              <span role="columnheader" style={{ position: "sticky", left: 0, background: C.surface, zIndex: 1 }}>
                <Checkbox checked={allOn} onChange={toggleAll} label="Tout sélectionner" />
              </span>
              <HeaderCell label="Projet · maître d’ouvrage" sortKey="name" sort={sort} onSort={toggleSort} sticky />
              {cols.map((c) => (
                <HeaderCell key={c.key} label={c.label} sortKey={c.sortable ? c.key : null} sort={sort} onSort={toggleSort} align={c.align} />
              ))}
            </div>

            {groups.map((g) => {
              const isCollapsed = groupBy !== "none" && collapsed.has(g.key);
              return (
                <div key={g.key} data-rowgroup role="rowgroup">
                  {groupBy !== "none" ? (
                    <GroupHeader
                      label={g.label}
                      rows={g.rows}
                      budgets={budgets}
                      collapsed={isCollapsed}
                      onToggle={() => setCollapsed((prev) => toggle(prev, g.key))}
                      cols={cols.length + 2}
                    />
                  ) : null}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && g.rows.map((p) => {
                      const on = sel.has(p.id);
                      return (
                        <motion.div
                          key={p.id}
                          layout
                          data-row
                          role="row"
                          aria-selected={on}
                          tabIndex={0}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={SPRING.gentle}
                          onClick={() => openProject(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProject(p.id); }
                            else onRowKeyNav(e);
                          }}
                          className="row-hover row-focus"
                          style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 12, alignItems: "center", minHeight: 58, padding: "10px 18px", borderTop: `1px solid ${C.line}`, cursor: "pointer", background: on ? C.brand50 : C.surface, boxShadow: on ? `inset 3px 0 0 ${C.brand}` : undefined, outline: "none" }}
                        >
                          <span
                            role="gridcell"
                            onClickCapture={(e) => { if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); rangeSelect(p.id); } }}
                            style={{ display: "inline-flex", position: "sticky", left: 0, zIndex: 1, background: on ? C.brand50 : C.surface }}
                          >
                            <Checkbox checked={on} onChange={() => toggleOne(p.id)} label={`Sélectionner ${p.name}`} />
                          </span>
                          <div role="gridcell" style={{ minWidth: 0, position: "sticky", left: 34, zIndex: 1, background: on ? C.brand50 : C.surface }}>
                            <div style={{ ...TX.bodyStrong, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                            <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.client} · {p.discipline}</div>
                          </div>
                          {cols.map((c) => (
                            <div key={c.key} role="gridcell" style={{ minWidth: 0, display: "flex", justifyContent: c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start" }}>
                              {renderCell(c.key, p, cellCtx)}
                            </div>
                          ))}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}

            {sorted.length === 0 ? (
              <div style={{ padding: "40px 18px", textAlign: "center", borderTop: `1px solid ${C.line}` }}>
                <div style={{ ...TX.caption, color: C.ink500 }}>{searched.length === 0 ? "Aucun projet pour l’instant." : "Aucun projet ne correspond à ce filtre."}</div>
                <div style={{ marginTop: 12 }}>
                  <Button variant="secondary" onClick={openAdd} style={{ margin: "0 auto" }}>Nouveau projet</Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const n = new Set(set);
  if (n.has(v)) n.delete(v); else n.add(v);
  return n;
}

// ───────────────────────────────────────── header cell

function HeaderCell({
  label, sortKey, sort, onSort, align, sticky,
}: { label: string; sortKey: SortKey | null; sort: { key: SortKey; dir: 1 | -1 } | null; onSort: (k: SortKey) => void; align?: "right" | "center"; sticky?: boolean }) {
  const active = sortKey != null && sort?.key === sortKey;
  const justify = align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
  const stickyStyle: React.CSSProperties = sticky ? { position: "sticky", left: 34, background: C.surface, zIndex: 1 } : {};
  if (!sortKey) {
    return <span role="columnheader" style={{ display: "flex", justifyContent: justify, ...TX.overline, color: C.ink500, ...stickyStyle }}>{label}</span>;
  }
  return (
    <span role="columnheader" aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} style={stickyStyle}>
      <button
        className="sortable"
        onClick={() => onSort(sortKey)}
        style={{ display: "flex", alignItems: "center", justifyContent: justify, width: "100%", gap: 3, color: active ? C.brandText : C.ink500, background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", ...TX.overline }}
      >
        {label}
        <span className="sort-caret" style={{ display: "inline-flex", opacity: active ? 1 : 0, transform: active && sort!.dir === -1 ? "rotate(180deg)" : "none", transition: "transform var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard)" }}>
          <CaretDownIcon size={11} />
        </span>
      </button>
    </span>
  );
}

// ───────────────────────────────────────── group header (subtotals)

function GroupHeader({
  label, rows, budgets, collapsed, onToggle, cols,
}: { label: string; rows: DerivedProject[]; budgets: Map<number, ProjectBudget>; collapsed: boolean; onToggle: () => void; cols: number }) {
  const count = rows.length;
  const fees = rows.reduce((s, p) => s + p.budget, 0);
  const avg = count ? Math.round(rows.reduce((s, p) => s + p.progress, 0) / count) : 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 18px", borderTop: `1px solid ${C.line}`, background: C.subtle, border: "none", borderTopColor: C.line, cursor: "pointer", font: "inherit", textAlign: "left" }}
    >
      <span style={{ display: "inline-flex", transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform var(--dur-fast) var(--ease-standard)", color: C.ink500 }}>
        <CaretDownIcon size={13} />
      </span>
      <span style={{ ...TX.bodyStrong, color: C.ink900 }}>{label || "—"}</span>
      <span style={{ ...num(12), color: C.ink500 }}>{count}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 16, ...TX.caption, color: C.ink500 }}>
        <span>Σ <span style={{ ...num(13), color: C.ink700 }}>{fmtBudget(fees)}</span></span>
        <span>moy. <span style={{ ...num(13), color: C.ink700 }}>{avg}&#8239;%</span></span>
      </span>
    </button>
  );
}

// ───────────────────────────────────────── group-by control

function GroupByControl({ value, onChange }: { value: GroupBy; onChange: (g: GroupBy) => void }) {
  const opts: { v: GroupBy; label: string }[] = [
    { v: "none", label: "Aucun" }, { v: "status", label: "Statut" }, { v: "phase", label: "Phase" }, { v: "resp", label: "Responsable" },
  ];
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const active = value !== "none";
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="btn state-layer" style={controlBtn(active)}>
        Grouper{active ? ` : ${opts.find((o) => o.v === value)!.label}` : ""}
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .12s", color: C.ink500 }}><CaretDownIcon size={12} /></span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={SPRING.snappy} style={menuShell}>
            {opts.map((o) => (
              <MenuOption key={o.v} selected={value === o.v} label={o.label} onSelect={() => { onChange(o.v); setOpen(false); }} />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────── columns control

function ColumnsControl({ columns, visible, onChange }: { columns: ColDef[]; visible: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="btn state-layer" style={controlBtn(false)}>
        Colonnes
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .12s", color: C.ink500 }}><CaretDownIcon size={12} /></span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div role="menu" aria-label="Colonnes visibles" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={SPRING.snappy} style={{ ...menuShell, minWidth: 190, right: 0, left: "auto" }}>
            {columns.map((c) => {
              const on = visible.has(c.key);
              const last = on && visible.size === 1;
              return (
                <button
                  key={c.key}
                  type="button" role="menuitemcheckbox" aria-checked={on} disabled={last}
                  onClick={() => onChange(toggle(visible, c.key))}
                  className="soft-hover"
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", borderRadius: R.xs, background: "transparent", border: "none", cursor: last ? "not-allowed" : "pointer", font: "inherit", textAlign: "left", color: last ? C.ink400 : C.ink800 }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: R.xxs, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: on ? `1px solid ${C.solid}` : `1.5px solid ${C.lineStrong}`, background: on ? C.solid : C.surface, color: "#fff" }}>
                    {on ? <CheckIcon size={11} /> : null}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const menuShell: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: Z.sticky + 2, minWidth: 170,
  background: C.surface, border: `1px solid ${C.lineStrong}`, borderRadius: R.md, boxShadow: SH.overlay, padding: 6,
};

function controlBtn(active: boolean): React.CSSProperties {
  return {
    cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "6px 10px 6px 12px", borderRadius: R.sm,
    display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    border: `1px solid ${active ? C.solid : C.line}`, background: active ? C.brand50 : C.surface, color: active ? C.brandText : C.ink700,
    transition: "background .12s, border-color .12s",
  };
}

// ───────────────────────────────────────── mobile card list

function MobileCards({
  groups, groupBy, budgets, sel, toggleOne, openProject, cellCtx, empty, openAdd,
}: {
  groups: { key: string; label: string; rows: DerivedProject[] }[];
  groupBy: GroupBy;
  budgets: Map<number, ProjectBudget>;
  sel: Set<number>;
  toggleOne: (id: number) => void;
  openProject: (id: number) => void;
  cellCtx: CellCtx;
  empty: boolean;
  openAdd: () => void;
}) {
  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  if (total === 0) {
    return (
      <div style={{ padding: "40px 18px", textAlign: "center", border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface }}>
        <div style={{ ...TX.caption, color: C.ink500 }}>{empty ? "Aucun projet pour l’instant." : "Aucun projet ne correspond à ce filtre."}</div>
        <div style={{ marginTop: 12 }}><Button variant="secondary" onClick={openAdd} style={{ margin: "0 auto" }}>Nouveau projet</Button></div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.map((g) => (
        <div key={g.key}>
          {groupBy !== "none" ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 4px", ...TX.bodyStrong, color: C.ink800 }}>
              {g.label || "—"} <span style={{ ...num(12), color: C.ink500 }}>{g.rows.length}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AnimatePresence initial={false}>
              {g.rows.map((p) => {
                const on = sel.has(p.id);
                const b = budgets.get(p.id);
                return (
                  <motion.div
                    key={p.id} layout
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.gentle}
                    {...{ role: "button", tabIndex: 0 }}
                    onClick={() => openProject(p.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProject(p.id); } }}
                    className="row-focus"
                    style={{ border: `1px solid ${on ? C.brand : C.line}`, borderRadius: R.lg, background: C.surface, boxShadow: SH.sm, padding: 14, cursor: "pointer", outline: "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={on} onChange={() => toggleOne(p.id)} label={`Sélectionner ${p.name}`} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...TX.bodyStrong, color: C.ink900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ ...TX.caption, color: C.ink500 }}>{p.client} · {p.discipline}</div>
                      </div>
                      <StatusCell p={p} setStatus={cellCtx.setStatus} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                      <PhaseCell p={p} setPhase={cellCtx.setPhase} />
                      <div style={{ flex: 1 }}><ProgressBar pct={p.progress} color={p.ring} /></div>
                      <span style={{ ...num(13), color: C.ink700 }}>{p.progress}&#8239;%</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, ...TX.caption, color: C.ink500 }}>
                      <span>{p.renduFmt} · <span style={{ color: p.renduDueColor, fontWeight: 600 }}>{p.renduDaysLabel}</span></span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <HealthDot b={b} />
                        <BudgetCell p={p} updateProject={cellCtx.updateProject} />
                        <RespCell p={p} team={cellCtx.team} setResp={cellCtx.setResp} />
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
}
