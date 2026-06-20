"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CaretDownIcon, ChevronLeftIcon, ChevronRightIcon, EditIcon, PlusIcon, SearchIcon, TrashIcon } from "../icons";
import { TeamMemberModal } from "../team-member-modal";
import { Avatar, Button, Card, EmptyState, IconButton, Input, rowProps, Segmented, Select, Toolbar, Tooltip } from "../ui";
import { buildTeamLoad, type HeatBucket, type TeamLoad } from "@/lib/derive";
import { fmtEur, isToday, MONS_LONG, MONTHS_FULL, monthRange, REFERENCE_DATE, toDate, weekRange } from "@/lib/format";
import { useProjects, type TeamMode } from "@/lib/store/projects-context";
import { C, chargeColor, DUR, EASE, loadTier, num, R, SP, SURFACE, TX } from "@/lib/tokens";
import type { TeamMember } from "@/lib/types";

const MODE_OPTS: { value: TeamMode; label: string }[] = [
  { value: "semaine", label: "Semaine" },
  { value: "mois", label: "Mois" },
];

// View-wide lens: read the period as workload (% of capacity) or as cost (€).
type Lens = "charge" | "cout";
const LENS_OPTS: { value: Lens; label: string }[] = [
  { value: "charge", label: "Charge" },
  { value: "cout", label: "Coût" },
];

type SortKey = "charge-desc" | "charge-asc" | "free" | "name";
const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: "charge-desc", label: "Charge (haute → basse)" },
  { value: "charge-asc", label: "Charge (basse → haute)" },
  { value: "free", label: "Capacité libre" },
  { value: "name", label: "Nom (A → Z)" },
];

type FilterKey = "all" | "over" | "free" | "under";
const FILTER_OPTS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "over", label: "Surchargés" },
  { value: "under", label: "Sous-utilisés" },
  { value: "free", label: "Disponibles" },
];

// ── derive-bridge ─────────────────────────────────────────────────────────────
// The corrected fractional-allocation charge and per-member cost are being added
// to buildTeamLoad by a concurrent agent. We CONSUME those fields when present
// and otherwise fall back locally so the view is never broken.
// // TODO(derive): drop the fallbacks once they ship.
interface EnrichedLoad {
  load: TeamLoad;
  /** Corrected (non-double-counting) charge, % of capacity. */
  chargePct: number;
  /** Period cost = period days × daily rate, euros. */
  costEur: number;
  /** Free capacity in working days (negative = overbooked). */
  freeDays: number;
  buckets: HeatBucket[];
}

type WithAlloc = TeamLoad & {
  chargeAllocPct?: number;
  costEur?: number;
};

function enrich(load: TeamLoad): EnrichedLoad {
  const w = load as WithAlloc;
  // Corrected charge: prefer the derive-provided fractional allocation; else the
  // (over-counting) raw chargePct as a stopgap.
  const chargePct = w.chargeAllocPct ?? load.chargePct;
  // Per-member cost: prefer derive; else compute from period days × rate.
  const costEur = w.costEur ?? Math.round(load.periodDays * (load.member.costPerDay ?? 0));
  const freeDays = Math.max(-load.capacity * 4, load.capacity - load.periodDays);

  // The heatmap reads as a single calm load gradient per bucket — no per-project
  // split needed, so the buckets pass straight through.
  return { load, chargePct, costEur, freeDays, buckets: load.buckets };
}

export function Team() {
  const { allDerived, team, teamMode, teamAnchor, setTeamMode, teamPrev, teamNext, teamToday, deleteTeamMember, openProject, setSearch } = useProjects();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const [lens, setLens] = useState<Lens>("charge");
  const [sort, setSort] = useState<SortKey>("charge-desc");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [groupByDiscipline, setGroupByDiscipline] = useState(false);
  const [query, setQuery] = useState("");

  const showProjectsOf = (m: TeamMember) => { setSearch(m.name); router.push("/projets"); };

  // Members referenced by a project (lead) or task (assignee) can't be deleted.
  const referenced = useMemo(() => {
    const s = new Set<number>();
    for (const p of allDerived) {
      s.add(p.responsableId);
      for (const t of p.subtasks) s.add(t.assigneeId);
    }
    return s;
  }, [allDerived]);

  const anchor = toDate(teamAnchor);
  const range = teamMode === "semaine" ? weekRange(teamAnchor) : monthRange(anchor.getFullYear(), anchor.getMonth());
  const loads = useMemo(
    () => buildTeamLoad(allDerived, team, range, teamMode === "semaine" ? "day" : "week"),
    [allDerived, team, range.start, range.end, teamMode],
  );

  // Previous period — for a period-over-period charge delta per member.
  const prevRange = useMemo(() => {
    if (teamMode === "semaine") {
      const d = toDate(weekRange(teamAnchor).start);
      d.setDate(d.getDate() - 7);
      return weekRange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    const m = anchor.getMonth() - 1;
    const y = m < 0 ? anchor.getFullYear() - 1 : anchor.getFullYear();
    return monthRange(y, (m + 12) % 12);
  }, [teamAnchor, teamMode, anchor]);
  const prevLoads = useMemo(
    () => buildTeamLoad(allDerived, team, prevRange, teamMode === "semaine" ? "day" : "week"),
    [allDerived, team, prevRange.start, prevRange.end, teamMode],
  );
  const prevCharge = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of prevLoads) m.set(l.member.id, enrich(l).chargePct);
    return m;
  }, [prevLoads]);

  const enriched = useMemo(() => loads.map(enrich), [loads]);
  const capacity = loads[0]?.capacity ?? 0;

  // ── toolbar: search → filter → sort ──
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = enriched.filter((e) => {
      if (q && !(e.load.member.name.toLowerCase().includes(q) || e.load.member.role.toLowerCase().includes(q))) return false;
      if (filter === "over") return e.chargePct > 100;
      if (filter === "under") return e.chargePct > 0 && e.chargePct < 60;
      if (filter === "free") return e.freeDays > 0;
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "charge-asc": return a.chargePct - b.chargePct;
        case "free": return b.freeDays - a.freeDays;
        case "name": return a.load.member.name.localeCompare(b.load.member.name);
        default: return b.chargePct - a.chargePct;
      }
    });
    return out;
  }, [enriched, query, filter, sort]);

  // Group by discipline (role) when requested.
  const groups = useMemo(() => {
    if (!groupByDiscipline) return [{ key: "", label: "", items: visible }];
    const map = new Map<string, EnrichedLoad[]>();
    for (const e of visible) {
      const k = e.load.member.role || "Sans discipline";
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({ key, label: key, items }));
  }, [visible, groupByDiscipline]);

  const periodLabel =
    teamMode === "semaine"
      ? `${toDate(weekRange(teamAnchor).start).getDate()} – ${toDate(weekRange(teamAnchor).end).getDate()} ${MONTHS_FULL[toDate(weekRange(teamAnchor).end).getMonth()]}`
      : `${MONS_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (m: TeamMember) => { setEditing(m); setModalOpen(true); };

  const colorsInUse = useMemo(() => team.map((m) => m.color), [team]);

  // Full-view empty state — no team at all.
  if (team.length === 0) {
    return (
      <>
        <EmptyState
          title="Aucun membre dans l’équipe"
          hint="Ajoutez des collaborateurs pour suivre leur charge, leur capacité et leur coût sur la période."
          action={<Button onClick={openAdd} icon={<PlusIcon size={15} />}>Nouveau membre</Button>}
        />
        {modalOpen ? <TeamMemberModal member={editing} colorsInUse={colorsInUse} onClose={() => setModalOpen(false)} /> : null}
      </>
    );
  }

  return (
    <>
      {/* One calm control strip. F-pattern: period + lens (what you're looking at)
          lead on the left; the primary action anchors the right. Refinement
          controls (search / sort / filter / group) sit on a quiet second line so
          the first row never exceeds ~5 simultaneous choices (Hick/Miller). */}
      <Toolbar style={{ marginBottom: SP[4] }}>
        <IconButton onClick={teamPrev} aria-label="Période précédente"><ChevronLeftIcon /></IconButton>
        <h2 style={{ ...num(20), minWidth: 150, textAlign: "center" }}>{periodLabel}</h2>
        <IconButton onClick={teamNext} aria-label="Période suivante"><ChevronRightIcon /></IconButton>
        <Button variant="secondary" size="sm" onClick={teamToday}>Aujourd’hui</Button>
        <Segmented value={teamMode} options={MODE_OPTS} onChange={setTeamMode} />
        <Segmented value={lens} options={LENS_OPTS} onChange={setLens} />
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={openAdd} icon={<PlusIcon size={15} />}>Nouveau membre</Button>
        </div>
      </Toolbar>

      {/* Refinement row — quiet, hairline-free; labels live inside the selects so
          there's no redundant label+icon chrome. */}
      <Toolbar style={{ marginBottom: SP[4], gap: SP[3] }}>
        <span style={{ position: "relative", flex: "0 1 240px", minWidth: 160 }}>
          <span aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.ink400, display: "flex" }}><SearchIcon size={15} /></span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un membre…"
            aria-label="Rechercher un membre"
            style={{ paddingLeft: 32 }}
          />
        </span>
        <Select size="sm" value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)} aria-label="Filtrer les membres">
          {FILTER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.value === "all" ? "Tous les membres" : `Filtre · ${o.label}`}</option>)}
        </Select>
        <Select size="sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Trier les membres">
          {SORT_OPTS.map((o) => <option key={o.value} value={o.value}>{`Tri · ${o.label}`}</option>)}
        </Select>
        <button
          type="button"
          className="btn soft-hover row-focus"
          onClick={() => setGroupByDiscipline((v) => !v)}
          aria-pressed={groupByDiscipline}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px",
            border: `1px solid ${groupByDiscipline ? C.lineStrong : C.line}`, borderRadius: R.sm,
            background: groupByDiscipline ? C.subtle : "transparent",
            color: groupByDiscipline ? C.ink900 : C.ink500,
            ...TX.nano, cursor: "pointer",
          }}
        >
          Grouper par discipline
        </button>
        <p style={{ ...TX.nano, color: C.ink400, margin: 0, marginLeft: "auto", textAlign: "right", maxWidth: 280 }}>
          {lens === "charge"
            ? <>Charge sur {capacity}&#8239;j ouvrés · la barre pleine = 100&#8239;%</>
            : <>Coût = jours travaillés × taux journalier · {capacity}&#8239;j de capacité</>}
        </p>
      </Toolbar>

      {visible.length === 0 ? (
        <EmptyState compact title="Aucun membre ne correspond" hint="Ajustez la recherche ou le filtre." />
      ) : (
        groups.map((g) => (
          <section key={g.key || "all"} style={{ marginBottom: g.label ? 24 : 0 }} aria-label={g.label || undefined}>
            {g.label ? (
              <h3 style={{ ...TX.eyebrow, color: C.ink500, margin: "0 0 10px" }}>
                {g.label} <span style={{ color: C.ink400 }}>· {g.items.length}</span>
              </h3>
            ) : null}
            <div className="enter-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 18 }}>
              {g.items.map((e) => (
                <MemberCard
                  key={e.load.member.id}
                  e={e}
                  lens={lens}
                  mode={teamMode}
                  prevCharge={prevCharge.get(e.load.member.id)}
                  isRef={referenced.has(e.load.member.id)}
                  onProjects={() => showProjectsOf(e.load.member)}
                  onEdit={() => openEdit(e.load.member)}
                  onDelete={() => deleteTeamMember(e.load.member.id)}
                  onOpenProject={openProject}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {modalOpen ? <TeamMemberModal member={editing} colorsInUse={colorsInUse} onClose={() => setModalOpen(false)} /> : null}
    </>
  );
}

function MemberCard({
  e, lens, mode, prevCharge, isRef, onProjects, onEdit, onDelete, onOpenProject,
}: {
  e: EnrichedLoad;
  lens: Lens;
  mode: TeamMode;
  prevCharge: number | undefined;
  isRef: boolean;
  onProjects: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenProject: (id: number) => void;
}) {
  const { load, chargePct, costEur, freeDays } = e;
  const m = load.member;
  const tier = loadTier(chargePct);
  const over = tier === "over" || tier === "crit";
  const high = tier === "high";
  // Minimalism / Von Restorff: the charge headline stays NEUTRAL ink while the
  // member is comfortably within capacity (a calm grid where nothing shouts), and
  // only borrows a semantic hue from chargeColor() for the states that need
  // attention — one amber as load approaches the ceiling (≥85 %), one red over
  // capacity. Painting every healthy card green would re-introduce the rainbow.
  const headColor = over || high ? chargeColor(chargePct) : C.ink900;
  // Over capacity, the raw % balloons — cap the headline at a credible ceiling
  // (v1 overload cap) and carry the real figure as concrete overflow days.
  const shown = over ? Math.min(chargePct, 130) : chargePct;
  const delta = prevCharge != null ? chargePct - prevCharge : null;

  // Progressive disclosure (Tesler): the task list is secondary detail. Show the
  // two heaviest tasks; the rest collapse behind a quiet count so the card's one
  // focal point stays the member + their headline load.
  const PEEK = 2;
  const [expanded, setExpanded] = useState(false);
  const tasks = useMemo(() => [...load.tasks].sort((a, b) => b.daysInPeriod - a.daysInPeriod), [load.tasks]);
  const shownTasks = expanded ? tasks : tasks.slice(0, PEEK);
  const hidden = tasks.length - shownTasks.length;

  return (
    <Card padding={`${SP[6]}px ${SP[6]}px ${SP[5]}px`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: SP[5] }}>
        <button
          {...rowProps(onProjects)}
          className="soft-hover row-focus"
          aria-label={`Voir les projets de ${m.name}`}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "none", border: "none", padding: "4px 6px", margin: "-4px -6px", borderRadius: R.sm, cursor: "pointer", textAlign: "left" }}
        >
          <Avatar initials={m.initials} color={m.color} size={42} fontSize={14} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink900 }}>{m.name}</div>
            <div style={{ ...TX.caption, color: C.ink500 }}>{m.role}</div>
          </div>
        </button>
        <div style={{ display: "flex", gap: 5 }}>
          <IconButton size={28} onClick={onEdit} aria-label={`Modifier ${m.name}`}><EditIcon size={14} /></IconButton>
          <IconButton
            size={28}
            tone="danger"
            disabled={isRef}
            onClick={() => !isRef && onDelete()}
            aria-label={isRef ? `${m.name} est affecté·e à des projets — réaffectez d’abord` : `Supprimer ${m.name}`}
            title={isRef ? "Membre affecté à des projets — réaffectez d’abord" : "Supprimer"}
          >
            <TrashIcon size={14} />
          </IconButton>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: SP[5] }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          {lens === "charge" ? (
            <>
              {/* C5: the concrete ratio (jours engagés / capacité) is the focal
                  number; the capped "%" is demoted to a state-coloured caption. */}
              <span style={{ ...num(20), color: C.ink900 }}>{load.periodDays} / {load.capacity}&#8239;j</span>
              <span style={{ ...TX.caption, color: headColor, fontWeight: 500 }}>{shown}&#8239;%{over ? " +" : ""}</span>
              {over ? (
                <span style={{ ...TX.caption, color: C.danger, fontWeight: 500 }}>· +{load.periodDays - load.capacity}&#8239;j de surcapacité</span>
              ) : freeDays > 0 ? (
                <span style={{ ...TX.caption, color: C.ink500 }}>· {freeDays}&#8239;j libres</span>
              ) : null}
            </>
          ) : (
            <>
              <span style={{ ...num(28), color: C.ink900 }}>{fmtEur(costEur)}</span>
              <span style={{ ...TX.caption, color: C.ink500 }}>
                {fmtEur(m.costPerDay ?? 0)}/j · {load.periodDays}&#8239;j
              </span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {delta != null && delta !== 0 ? (
            <span
              style={{ ...num(12), color: C.ink500, whiteSpace: "nowrap" }}
              title={`Évolution vs période précédente : ${delta > 0 ? "+" : ""}${delta} % de charge`}
            >
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}&#8239;%
            </span>
          ) : null}
          <span style={{ ...TX.caption, color: C.ink500 }}>{load.projectsActive} projet{load.projectsActive > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Heatmap sits directly on the card — no decorative box. A hairline above
          separates it from the headline by Gestalt proximity, not a border. */}
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: SP[5] }}>
        <Heatmap buckets={e.buckets} mode={mode} memberName={m.name} />
      </div>

      {tasks.length === 0 ? (
        <div style={{ marginTop: SP[5] }}>
          <EmptyState compact title="Aucune tâche planifiée" hint="Rien d’affecté à ce membre sur la période." />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: SP[5] }}>
          {shownTasks.map((task, i) => (
            <div
              key={i}
              {...rowProps(() => onOpenProject(task.projectId))}
              className="row-hover row-focus"
              aria-label={`${task.taskName} · ${task.projectName} · ${task.daysInPeriod} jours`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", ...TX.caption, minHeight: 26, padding: "4px 4px", borderRadius: R.xxs }}
            >
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: C.ink400, flexShrink: 0 }} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 500, color: task.done ? C.ink500 : C.ink800 }}>{task.taskName}</span>
                  <span style={{ color: C.ink500 }}> · {task.projectName}</span>
                </span>
              </div>
              <span style={{ ...num(12), color: C.ink700, whiteSpace: "nowrap" }}>{task.daysInPeriod}&#8239;j</span>
            </div>
          ))}
          {hidden > 0 || expanded ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="btn soft-hover row-focus"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start",
                marginTop: 2, padding: "4px 6px", background: "none", border: "none",
                cursor: "pointer", ...TX.nano, color: C.ink500, borderRadius: R.xxs,
              }}
            >
              <span aria-hidden style={{ display: "flex", transform: expanded ? "rotate(180deg)" : "none", transition: `transform ${DUR.fast} ${EASE.standard}` }}>
                <CaretDownIcon size={12} />
              </span>
              {expanded ? "Réduire" : `${hidden} autre${hidden > 1 ? "s" : ""} tâche${hidden > 1 ? "s" : ""}`}
            </button>
          ) : null}
        </div>
      )}
    </Card>
  );
}

// Clear weekday abbreviations, mirroring the calendar (avoids the ambiguous
// L/M/M/J/V/S/D where three letters look alike).
const WD = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

/** ISO-8601 week number ("S24" style), so month-view week labels are meaningful
 *  instead of a bare day-of-month. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - day + 3); // nearest Thursday
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  return 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 86_400_000));
}

/** Workload heatmap: each bar is a SINGLE flat load fill rising toward (and past)
 *  the 100%-capacity line, coloured by tier in the SAME language as project-status
 *  (C9): within capacity → soft green, mild over (≈100–120 %) → amber, severe over
 *  (>≈120 %) → red. No hatching, no terracotta — the height encodes magnitude, the
 *  colour the severity. Exposed as a labelled role=img figure with a per-bucket
 *  data-table fallback for assistive tech. */
function Heatmap({ buckets, mode, memberName }: { buckets: HeatBucket[]; mode: TeamMode; memberName: string }) {
  // Bars grow up from the baseline on mount (reduced-motion → instant full height).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setMounted(true);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (buckets.length === 0) return null;
  const FULL = 32; // px height representing 100% capacity
  const OVER = 10; // headroom above the line for the overflow cap
  const H = FULL + OVER;
  const grow = `height ${DUR.slow} ${EASE.decel}`;

  const summary = `Charge de ${memberName} ${mode === "semaine" ? "par jour" : "par semaine"} : ${buckets
    .map((b) => `${bucketLabel(b, mode)} ${b.pct} %`)
    .join(", ")}.`;

  return (
    <div role="group" aria-label={`Graphique de charge de ${memberName}`}>
      <div aria-hidden style={{ ...TX.nano, color: C.ink400, marginBottom: SP[3] }}>
        Charge {mode === "semaine" ? "par jour" : "par semaine"} <span style={{ color: "var(--text-muted)" }}>· repère = 100&#8239;%</span>
      </div>
      <div role="img" aria-label={summary} style={{ display: "flex", gap: mode === "semaine" ? 5 : 3, alignItems: "flex-end" }}>
        {buckets.map((b, i) => {
          const inThisBucketToday = bucketContainsToday(b, mode);
          const base = (Math.min(b.pct, 100) / 100) * FULL;
          const over = b.pct > 100 ? Math.min((b.pct - 100) / 40, 1) * OVER : 0;
          // C9: ONE flat fill coloured by load tier — within capacity → soft green,
          // mild over (≈100–120 %) → amber, severe over (>≈120 %) → red. No hatch,
          // no terracotta; the bar HEIGHT still encodes the magnitude.
          const fillPx = base + over;
          const cellFill = b.pct <= 0 ? "transparent" : b.pct <= 100 ? "var(--green-soft)" : b.pct <= 120 ? "var(--warning)" : "var(--danger)";
          const overDays = Math.max(0, b.days - b.capacity);
          const lab = bucketLabel(b, mode);
          const delay = `${Math.min(i * 25, 200)}ms`;
          const cellLabel = `${bucketLabel(b, mode, true)} : ${b.days} / ${b.capacity} j · ${b.pct} %${overDays > 0 ? ` · +${overDays} j au-delà` : ""}`;
          return (
            <div key={i} style={{ flex: 1, minWidth: 28, display: "flex", flexDirection: "column" }}>
              {/* the Tooltip wrapper is inline-flex; the column + stretch lets the
                  cell fill the bucket's full width without touching the primitive. */}
              <Tooltip label={cellLabel}>
              <div
                tabIndex={0}
                role="img"
                aria-label={cellLabel}
                className="lift-hover"
                style={{ position: "relative", width: "100%", height: H, borderRadius: R.xs, background: SURFACE.containerHigh, border: `1px solid ${inThisBucketToday ? C.lineStrong : C.line}`, overflow: "hidden", outlineOffset: 1, cursor: "default" }}
              >
                <div style={{ position: "absolute", left: 0, right: 0, top: OVER, borderTop: `1px dashed ${C.line}` }} />
                {/* C9: one flat tier-coloured load fill (no over-cap, no hatching). */}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: mounted ? fillPx : 0, background: cellFill, transition: grow, transitionDelay: delay }} />
                {overDays > 0 ? <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: C.ink900, opacity: mounted ? 1 : 0, transition: `opacity ${DUR.slow} ${EASE.decel}`, transitionDelay: delay }}>+{overDays}&#8239;j</span> : null}
                {/* today marker: a small ink dot (non-colour cue — position + the
                    bold weekday label below), so "today" is found without a heavy ring. */}
                {inThisBucketToday ? <span aria-hidden style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: C.ink700 }} /> : null}
              </div>
              </Tooltip>
              <div style={{ fontSize: 12, fontWeight: inThisBucketToday ? 600 : 400, color: inThisBucketToday ? C.ink900 : C.ink500, textAlign: "center", marginTop: 4 }}>{lab}</div>
            </div>
          );
        })}
      </div>
      {/* Screen-reader data-table fallback */}
      <table style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        <caption>{summary}</caption>
        <thead><tr><th scope="col">{mode === "semaine" ? "Jour" : "Semaine"}</th><th scope="col">Jours</th><th scope="col">Capacité</th><th scope="col">Charge</th></tr></thead>
        <tbody>
          {buckets.map((b, i) => (
            <tr key={i}>
              <th scope="row">{bucketLabel(b, mode, true)}</th>
              <td>{b.days}</td><td>{b.capacity}</td><td>{b.pct}&#8239;%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function bucketLabel(b: HeatBucket, mode: TeamMode, full = false): string {
  const d = toDate(b.start);
  if (mode === "semaine") {
    return full ? `${WD[(d.getDay() + 6) % 7]} ${d.getDate()}` : WD[(d.getDay() + 6) % 7];
  }
  // Month view: label weeks meaningfully — "S24" not a bare day-of-month.
  return full ? `Semaine ${isoWeek(d)} (dès le ${d.getDate()} ${MONTHS_FULL[d.getMonth()]})` : `S${isoWeek(d)}`;
}

function bucketContainsToday(b: HeatBucket, mode: TeamMode): boolean {
  if (mode === "semaine") return isToday(b.start);
  // Month view: the week-bucket spans start..end — "today" (the app's fixed
  // REFERENCE_DATE, not Date.now()) falls inside it.
  return b.start <= REFERENCE_DATE && REFERENCE_DATE <= b.end;
}
