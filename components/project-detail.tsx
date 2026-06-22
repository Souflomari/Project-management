"use client";

// Shared project-detail sections. The PEEK drawer composes the fast-triage
// pieces (identity, status, next deliverable, margin, quick actions, recent
// comments); the full /projets/[id] PAGE composes the workspace pieces (task
// planning surface, activity feed, properties rail, EVM card). Each section
// reads the store directly so callers just drop them in. `p` is the derived
// project (extends the raw Project).

import { useMemo, useState } from "react";

import { CloseIcon, PlusIcon, TrashIcon } from "./icons";
import { Avatar, Button, Checkbox, IconButton, Input, ProgressBar, Select, Textarea } from "./ui";
import type { SubtaskPatch } from "@/lib/data/repository";
import { buildBudget, type DerivedProject, type DerivedSubtask } from "@/lib/derive";
import { daysFromToday, fmtEur, fmtFull, fmtShort, formatDays, pct, REFERENCE_DATE, REFERENCE_TS, relativeWhen, toDate, workingDaysBetween } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, FONT_DISPLAY, num, R, SURFACE, STATUS_META, TX } from "@/lib/tokens";
import { FINAL_PHASE_INDEX, PHASES, STATUSES, type TeamMember } from "@/lib/types";

// Section headings read as quiet sentence-case overlines (editorial, not robotic
// uppercase). Eyebrow (uppercase, tracked) is reserved for the few true category
// tags — the stat-cell metadata labels below.
const LABEL: React.CSSProperties = { ...TX.overline, color: C.ink700 };

/** Schedule-derived expected progress "as of" today (the avancement we should
 *  have reached if every task ran on plan). Mirrors derive's internal
 *  `progressAsOf`, which isn't exported. // TODO(derive): export progressAsOf so
 *  this fallback can be removed. */
function expectedProgressToday(p: DerivedProject): number {
  let total = 0;
  let done = 0;
  for (const s of p.subtasksD) {
    total += s.plannedDays;
    if (toDate(s.start).getTime() > REFERENCE_TS) continue;
    const upto = s.end <= REFERENCE_DATE ? s.end : REFERENCE_DATE;
    done += Math.min(s.plannedDays, workingDaysBetween(s.start, upto));
  }
  if (total === 0) return p.progress;
  return Math.min(100, Math.round((100 * done) / total));
}

/** Editable name + maître d'ouvrage · discipline. `titleStyle` lets the page
 *  render a larger heading than the drawer. */
export function ProjectIdentity({ p, titleId, titleStyle }: { p: DerivedProject; titleId?: string; titleStyle?: React.CSSProperties }) {
  const { updateProject } = useProjects();
  return (
    <>
      <h2 id={titleId} style={{ margin: "0 0 2px" }}>
        <EditableText
          value={p.name}
          onSave={(v) => updateProject(p.id, { name: v })}
          ariaLabel="Nom du projet"
          style={titleStyle ?? { fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.2, color: C.ink900 }}
        />
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 2, ...TX.caption, color: C.ink500 }}>
        <EditableText value={p.client} onSave={(v) => updateProject(p.id, { client: v })} ariaLabel="Maître d’ouvrage" style={{ color: C.ink500 }} />
        <span style={{ color: C.ink400 }}>·</span>
        <EditableText value={p.discipline} onSave={(v) => updateProject(p.id, { discipline: v })} ariaLabel="Discipline" style={{ color: C.ink500 }} />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────── PEEK (drawer triage)

/** Compact, editable status pills (shared affordance — drawer header + page
 *  rail). Replaces the static StatusPill so status IS the edit control. */
export function StatusPicker({ p, size = "sm" }: { p: DerivedProject; size?: "sm" | "xs" }) {
  const { setStatus } = useProjects();
  const pad = size === "xs" ? "4px 9px" : "6px 11px";
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {STATUSES.map((st) => {
        const m = STATUS_META[st];
        const active = st === p.status;
        // Selection is a neutral state (near-black outline + ink label) — not a
        // coloured slab. The small dot carries status meaning: red only for "en
        // retard", green as the one positive identity ("à jour"); the rest stay
        // grey so colour means something rather than decorating every chip.
        const dot = dotColor(st);
        return (
          <button
            key={st}
            onClick={() => setStatus(p.id, st)}
            aria-pressed={active}
            className="btn"
            style={{
              cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 6, padding: pad, borderRadius: R.sm,
              background: active ? SURFACE.container : C.surface,
              color: active ? C.ink900 : C.ink500,
              border: `1px solid ${active ? C.ink900 : C.line}`,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? dot : C.ink300 }} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/** Status dot — red reserved for late, green for the positive "à jour" identity,
 *  everything else stays a quiet grey. Colour carries meaning, not decoration. */
function dotColor(st: (typeof STATUSES)[number]): string {
  switch (st) {
    case "en retard": return C.danger;
    case "à jour": return C.brand;
    default: return C.ink400;
  }
}

/** Fast-triage summary for the drawer: avancement, next deliverable, margin —
 *  the three numbers you scan before deciding to open the full page. Data-ink:
 *  no boxed stat cells — the two focal numbers sit side by side on open
 *  whitespace, with the next deliverable demoted below a hairline rule (Gestalt:
 *  group by space, separate by a thin line, not by boxes). */
export function ProjectPeekSummary({ p }: { p: DerivedProject }) {
  const { team } = useProjects();
  const b = buildBudget(p, team);
  const doneCount = p.subtasksD.filter((s) => s.done).length;
  const overdue = p.nextTask && p.renduDays !== null && p.renduDays < 0;

  return (
    <div>
      {/* the two decision numbers — open, unboxed, focal */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={{ ...TX.overline, color: C.ink600 }}>Avancement</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 6 }}>
            <span style={{ ...num(28), color: C.brand }}>{pct(p.progress)}</span>
            <span style={{ ...TX.micro, color: C.ink500 }}>{doneCount}/{p.subtasksD.length}</span>
          </div>
          <div style={{ marginTop: 9 }}><ProgressBar pct={p.progress} color={C.brand} height={5} /></div>
        </div>
        <div>
          <div style={{ ...TX.overline, color: C.ink600 }}>Marge prévue</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
            <span style={{ ...num(28), color: b.overBudget ? C.danger : C.ink900 }}>
              {b.marginPct >= 0 ? "+" : ""}{pct(b.marginPct)}
            </span>
            {b.overBudget ? <OverBudgetBadge /> : null}
          </div>
          <div style={{ ...TX.micro, color: C.ink500, marginTop: 7 }}>{fmtEur(b.marginEur)}</div>
        </div>
      </div>

      {/* next deliverable — demoted below a hairline, label/value row */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...TX.overline, color: C.ink600 }}>Prochain rendu</div>
          <div title={p.renduLabel} style={{ ...TX.bodyStrong, color: C.ink900, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.renduLabel}
          </div>
        </div>
        {p.nextTask ? (
          <span style={{ ...TX.caption, fontWeight: 600, color: overdue ? C.danger : C.ink500, whiteSpace: "nowrap", flexShrink: 0 }}>
            {p.renduFmt} · {p.renduDaysLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── PROPERTIES (page rail)

/** Right-rail properties list for the workspace page: responsable, dates,
 *  status, phase, team. Quiet label/value rows rather than the drawer's stat
 *  cards. */
export function ProjectProperties({ p }: { p: DerivedProject }) {
  const { team, updateProject } = useProjects();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PropRow label="Statut">
        <StatusPicker p={p} size="xs" />
      </PropRow>
      <PropRow label="Phase">
        <PhaseStepper p={p} compact />
      </PropRow>
      <PropRow label="Responsable">
        <Select size="sm" aria-label="Responsable" value={p.responsableId} onChange={(e) => updateProject(p.id, { responsableId: Number(e.target.value) })}>
          {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
        </Select>
      </PropRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <PropRow label="Début">
          <Input size="sm" type="date" aria-label="Date de début" value={p.start} onChange={(e) => updateProject(p.id, { start: e.target.value })} />
        </PropRow>
        <PropRow label={`Échéance · ${p.deadlineDaysLabel}`}>
          <Input size="sm" type="date" aria-label="Échéance finale" value={p.deadline} onChange={(e) => updateProject(p.id, { deadline: e.target.value })} />
        </PropRow>
      </div>
      <PropRow label="Équipe">
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 7 }}>
          {p.members.map((m) => (
            <div key={m.id} style={{ marginLeft: -7 }}>
              <Avatar initials={m.initials} color={m.color} size={28} fontSize={12} ring title={`${m.name} · ${m.role}`} />
            </div>
          ))}
        </div>
      </PropRow>
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...TX.overline, color: C.ink600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

/** Phase progress stepper. `compact` shrinks it for the page rail. */
export function PhaseStepper({ p, compact = false }: { p: DerivedProject; compact?: boolean }) {
  const { advancePhase, setPhase } = useProjects();
  const canAdvance = p.phaseIndex < FINAL_PHASE_INDEX;
  const N = PHASES.length;
  return (
    <>
      {!compact ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={LABEL}>Phase d’étude</div>
          <Button size="sm" disabled={!canAdvance} onClick={() => advancePhase(p.id)}>Phase suivante</Button>
        </div>
      ) : null}
      <div style={{ position: "relative", marginBottom: compact ? 0 : 26 }}>
        <div style={{ position: "absolute", top: 6, left: `${50 / N}%`, right: `${50 / N}%`, height: 2, background: C.line }} />
        <div style={{ position: "absolute", top: 6, left: `${50 / N}%`, width: `calc((100% - ${100 / N}%) * ${N > 1 ? p.phaseIndex / (N - 1) : 0})`, height: 2, background: C.brand }} />
        <div style={{ display: "flex", position: "relative" }}>
          {PHASES.map((ph, i) => {
            const isDone = i < p.phaseIndex;
            const cur = i === p.phaseIndex;
            return (
              <button
                key={ph}
                onClick={() => setPhase(p.id, i)}
                title={`Définir la phase : ${ph}`}
                aria-label={`Définir la phase ${ph}`}
                className="btn"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1, background: "none", border: "none", cursor: "pointer", padding: "2px 0", borderRadius: R.sm }}
              >
                <span
                  aria-current={cur ? "step" : undefined}
                  style={{
                    width: 13, height: 13, borderRadius: "50%", position: "relative", zIndex: 1,
                    ...(cur
                      ? { background: C.surface, border: `3px solid ${C.brand}` }
                      : isDone
                        ? { background: C.brand, border: `3px solid ${C.brand}` }
                        : { background: C.surface, border: `3px solid ${C.line}` }),
                  }}
                />
                <span style={{ ...TX.micro, fontSize: compact ? 12 : undefined, color: cur ? C.ink900 : isDone ? C.ink700 : C.ink400, fontWeight: cur ? 600 : 500 }}>{ph}</span>
              </button>
            );
          })}
        </div>
      </div>
      {compact && canAdvance ? (
        <div style={{ marginTop: 10 }}>
          <Button size="sm" onClick={() => advancePhase(p.id)} style={{ width: "100%" }}>Phase suivante</Button>
        </div>
      ) : null}
    </>
  );
}

/** Honoraires + avancement, statut, phase stepper, responsable/dates, équipe.
 *  Retained for back-compat; the drawer now uses the peek pieces and the page
 *  uses ProjectProperties, but this remains a complete stacked overview. */
export function ProjectOverview({ p }: { p: DerivedProject }) {
  const { team, updateProject } = useProjects();
  const doneCount = p.subtasksD.filter((s) => s.done).length;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: SURFACE.container, border: `1px solid ${C.line}`, borderRadius: R.md, padding: "12px 14px" }}>
          <div style={{ ...TX.overline, color: C.ink600 }}>Honoraires</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
            <Input
              size="sm"
              key={p.budget}
              defaultValue={p.budget}
              type="number"
              min={0}
              step={10}
              aria-label="Honoraires en milliers d’euros"
              onBlur={(e) => { const v = Math.max(0, Math.round(Number(e.target.value) || 0)); if (v !== p.budget) updateProject(p.id, { budget: v }); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              trailing={<span style={{ ...TX.caption, color: C.ink500 }}>k€</span>}
              style={{ ...num(20), width: 120, height: 34 }}
            />
          </div>
          <div style={{ ...TX.micro, color: C.ink500, marginTop: 3 }}>{p.budgetFmt}</div>
        </div>
        <Stat
          label="Avancement"
          value={pct(p.progress)}
          valueColor={C.brand}
          hint={`${doneCount} / ${p.subtasksD.length} tâches`}
          title={`Avancement pondéré par la durée des tâches (jours terminés ÷ jours planifiés). Le décompte ${doneCount} / ${p.subtasksD.length} indique le nombre de tâches.`}
        >
          <div style={{ ...TX.micro, color: C.ink500, marginTop: 3 }}>pondéré par durée</div>
          <div style={{ marginTop: 8 }}><AvancementBar p={p} /></div>
        </Stat>
      </div>

      <ProjectBudget p={p} />

      <div style={{ ...LABEL, marginBottom: 9 }}>Statut</div>
      <div style={{ marginBottom: 24 }}><StatusPicker p={p} /></div>

      <PhaseStepper p={p} />

      <div style={{ ...LABEL, marginBottom: 10 }}>Détails</div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Responsable">
          <Select size="sm" aria-label="Responsable" value={p.responsableId} onChange={(e) => updateProject(p.id, { responsableId: Number(e.target.value) })}>
            {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Début">
            <Input size="sm" type="date" aria-label="Date de début" value={p.start} onChange={(e) => updateProject(p.id, { start: e.target.value })} />
          </Field>
          <Field label={`Échéance · ${p.deadlineDaysLabel}`}>
            <Input size="sm" type="date" aria-label="Échéance finale" value={p.deadline} onChange={(e) => updateProject(p.id, { deadline: e.target.value })} />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", paddingLeft: 7 }}>
        {p.members.map((m) => (
          <div key={m.id} style={{ marginLeft: -7 }}>
            <Avatar initials={m.initials} color={m.color} size={28} fontSize={12} ring title={`${m.name} · ${m.role}`} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Avancement bar with the "attendu aujourd'hui" expected-progress marker. */
function AvancementBar({ p, height = 6 }: { p: DerivedProject; height?: number }) {
  const expected = expectedProgressToday(p);
  return (
    <div title={`Avancement réel ${pct(p.progress)} — attendu aujourd’hui ${pct(expected)} selon le planning`}>
      <div style={{ position: "relative" }}>
        <ProgressBar pct={p.progress} color={p.progress + 4 < expected ? C.danger : C.brand} height={height} />
        {/* "attendu aujourd'hui" marker */}
        <div
          aria-hidden
          style={{ position: "absolute", top: -2, bottom: -2, left: `${expected}%`, width: 2, background: C.ink700, transform: "translateX(-1px)", borderRadius: 0 }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", ...TX.micro, color: C.ink500, marginTop: 5 }}>
        <span>réel {pct(p.progress)}</span>
        <span title="Avancement que le planning prévoit à ce jour">attendu {pct(expected)}</span>
      </div>
    </div>
  );
}

/** Over-budget marker — a quiet outlined label, not a filled red slab. Red is
 *  reserved for this one "over" meaning; it carries the word, not colour alone. */
function OverBudgetBadge() {
  return (
    <span
      style={{
        ...TX.eyebrow, fontSize: 12, letterSpacing: ".04em", color: C.danger,
        border: `1px solid ${C.danger}`, padding: "1px 6px", borderRadius: R.xs, whiteSpace: "nowrap",
      }}
    >
      Dépassement
    </span>
  );
}

/** Honoraires vs coût engagé / valeur acquise — earned-value control. Reads the
 *  team from the store so it stays in sync with rate edits. */
export function ProjectBudget({ p }: { p: DerivedProject }) {
  const { team } = useProjects();
  const b = buildBudget(p, team);
  // Burn bar (quiet, monochrome): a neutral track carries the committed cost as a
  // SINGLE restrained ink fill. Earned value is a thin tick on that fill (a
  // marker, not a competing colour). Over-budget is the ONLY case that turns red —
  // the fill past 100% reads as one red accent, reinforced by the label. No
  // second hue, no overflow track, no multi-dot legend.
  const committed = b.committedPct;
  const committedIn = Math.min(100, committed);
  const earned = b.feesEur ? Math.min(100, Math.round((b.earnedValueEur / b.feesEur) * 100)) : 0;
  const fillColor = b.overBudget ? C.danger : C.ink700;

  return (
    <>
      {/* one focal readout for the section: the margin */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ ...num(20), color: b.overBudget ? C.danger : C.ink900 }}>
          {b.marginEur >= 0 ? "marge " : "dépassement "}{fmtEur(Math.abs(b.marginEur))}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...TX.micro, color: b.overBudget ? C.danger : C.ink500 }}>
          {b.marginPct >= 0 ? "+" : ""}{pct(b.marginPct)}
          {b.overBudget ? <OverBudgetBadge /> : null}
        </span>
      </div>

      {/* Single monochrome burn bar with an earned-value tick. Plain-French
          tooltip carries the full figures so the chrome can stay quiet. */}
      <div
        title={`Engagé : ${pct(committed)} des honoraires (${fmtEur(b.plannedCostEur)} sur ${fmtEur(b.feesEur)}). Acquis : ${pct(earned)} (valeur du travail terminé, ${fmtEur(b.earnedValueEur)}). Le repère marque 100 % des honoraires.${b.overBudget ? " Le plan dépasse les honoraires." : ""}`}
        style={{ position: "relative", height: 8, borderRadius: R.pill, background: SURFACE.container, border: `1px solid ${C.line}`, overflow: "hidden", marginBottom: 7 }}
      >
        <div className="anim-bar" style={{ position: "absolute", insetBlock: 0, left: 0, width: `${committedIn}%`, ["--fill" as string]: `${committedIn}%`, background: fillColor }} />
        {/* earned-value tick — a quiet position marker on the fill, not a slab */}
        {earned > 0 ? (
          <div aria-hidden style={{ position: "absolute", top: 1, bottom: 1, left: `${earned}%`, width: 2, background: C.surface, transform: "translateX(-1px)", opacity: 0.9 }} />
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", ...TX.micro, color: C.ink500, marginBottom: 14 }}>
        <span>engagé {pct(committed)}</span>
        <span title="Valeur du travail terminé">acquis {pct(earned)}</span>
      </div>

      {/* secondary detail, demoted: the three EVM figures as quiet label/value rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <BudgetRow label="Honoraires" value={fmtEur(b.feesEur)} />
        <BudgetRow label="Coût engagé" value={fmtEur(b.plannedCostEur)} />
        <BudgetRow label="Valeur acquise" value={fmtEur(b.earnedValueEur)} />
      </div>
    </>
  );
}

function BudgetRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ ...TX.caption, color: C.ink500 }}>{label}</span>
      <span style={{ ...num(14), color: C.ink900 }}>{value}</span>
    </div>
  );
}

/** Task list (planning surface) + add-task form. Rows collapse to one scannable
 *  line and expand to edit. */
export function ProjectTasks({ p }: { p: DerivedProject }) {
  const { team, addSubtask, updateSubtask, deleteSubtask } = useProjects();
  const [ntName, setNtName] = useState("");
  const [ntAssignee, setNtAssignee] = useState<number | null>(null);
  const [ntStart, setNtStart] = useState(REFERENCE_DATE);
  const [ntDays, setNtDays] = useState(5);
  const assigneeDefault = ntAssignee ?? p.responsableId;
  const doneCount = p.subtasksD.filter((s) => s.done).length;

  // Planning surface: sort by start date (the order work actually happens).
  const ordered = useMemo(
    () => [...p.subtasksD].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)),
    [p.subtasksD],
  );

  function handleAdd() {
    if (!ntName.trim()) return;
    addSubtask(p.id, { name: ntName, assigneeId: assigneeDefault, start: ntStart, plannedDays: ntDays });
    setNtName("");
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={LABEL}>Tâches et planning</div>
        <span style={{ ...TX.micro, color: C.ink500 }}>{doneCount} / {p.subtasksD.length} · {p.doneDays} / {p.totalDays} j</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        {ordered.length === 0 ? (
          <div style={{ ...TX.caption, color: C.ink500, padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
            Aucune tâche. Ajoutez la première ci-dessous.
          </div>
        ) : (
          ordered.map((s) => (
            <SubtaskRow key={s.id} projectId={p.id} subtask={s} siblings={ordered} team={team} onUpdate={updateSubtask} onDelete={deleteSubtask} />
          ))
        )}
      </div>

      {/* add-task: grouped by a single hairline + whitespace, not a filled box
          (data-ink: one separator, not a competing card). */}
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
        <div style={{ ...LABEL, marginBottom: 8 }}>Nouvelle tâche</div>
        <Input
          size="sm"
          value={ntName}
          onChange={(e) => setNtName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Intitulé de la tâche"
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 8, alignItems: "center" }}>
          <Select size="sm" aria-label="Responsable" value={assigneeDefault} onChange={(e) => setNtAssignee(Number(e.target.value))}>
            {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </Select>
          <Input size="sm" type="date" aria-label="Date de début" value={ntStart} onChange={(e) => setNtStart(e.target.value)} style={{ width: 150 }} />
          <Input size="sm" type="number" min={1} aria-label="Jours planifiés" value={ntDays} onChange={(e) => setNtDays(Number(e.target.value))} style={{ width: 64 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <Button size="sm" variant="secondary" icon={<PlusIcon size={14} />} onClick={handleAdd} disabled={!ntName.trim()}>Ajouter</Button>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────── ACTIVITY / COMMENTS

const MENTION_RE = /@([\p{L}\p{M}'’-]+(?:\s+[\p{L}\p{M}'’-]+)?)/gu;

/** Activity feed: richer comment thread — multiline composer (Shift+Enter for a
 *  newline), @mentions of team members, relative timestamps, delete-own. */
export function ProjectComments({ p }: { p: DerivedProject }) {
  const { team, addComment, commentDraft, setCommentDraft } = useProjects();
  const [mentionOpen, setMentionOpen] = useState(false);

  const teamFirstNames = useMemo(() => new Set(team.map((m) => m.name.split(" ")[0].toLowerCase())), [team]);
  const mentionMatches = useMemo(() => {
    const m = commentDraft.match(/@([\p{L}\p{M}'’-]*)$/u);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return team.filter((tm) => tm.name.toLowerCase().includes(q)).slice(0, 5);
  }, [commentDraft, team]);

  // A real activity timeline derived from the project's OWN data (no event store
  // needed): every delivered task becomes a "rendu livré" milestone, plus the
  // project opening — so Activité is never an empty placeholder, even before
  // anyone comments.
  const history = useMemo(() => {
    const items: { kind: "rendu" | "open"; text: string; date: string; who?: TeamMember }[] = [];
    for (const s of p.subtasksD) if (s.done) items.push({ kind: "rendu", text: s.name, date: s.end, who: s.assignee });
    items.sort((a, b) => b.date.localeCompare(a.date));
    items.push({ kind: "open", text: "Projet ouvert", date: p.start });
    return items;
  }, [p]);

  function submit() {
    if (!commentDraft.trim()) return;
    addComment(p.id);
    setMentionOpen(false);
  }

  function applyMention(name: string) {
    const next = commentDraft.replace(/@([\p{L}\p{M}'’-]*)$/u, `@${name.split(" ")[0]} `);
    setCommentDraft(next);
    setMentionOpen(false);
    document.getElementById("comment-composer")?.focus();
  }

  return (
    <>
      {p.comments.map((cm, i) => (
        <CommentItem key={i} cm={cm} teamFirstNames={teamFirstNames} />
      ))}

      <div style={{ marginTop: 12, position: "relative" }}>
        <Textarea
          id="comment-composer"
          rows={2}
          value={commentDraft}
          onChange={(e) => { setCommentDraft(e.target.value); setMentionOpen(/@[\p{L}\p{M}'’-]*$/u.test(e.target.value)); }}
          onKeyDown={(e) => {
            // Enter submits; Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === "Escape") setMentionOpen(false);
          }}
          placeholder="Ajouter à l’activité…  (@ pour mentionner · Maj+Entrée pour un retour à la ligne)"
          style={{ minHeight: 60 }}
        />
        {mentionOpen && mentionMatches.length > 0 ? (
          <div
            role="listbox"
            aria-label="Mentionner un membre"
            style={{ position: "absolute", left: 0, bottom: "100%", marginBottom: 4, background: C.surface, border: `1px solid ${C.lineStrong}`, borderRadius: R.md, boxShadow: "0 8px 16px -6px rgba(28,25,23,.18)", padding: 4, zIndex: 5, minWidth: 200 }}
          >
            {mentionMatches.map((tm) => (
              <button
                key={tm.id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); applyMention(tm.name); }}
                className="btn soft-hover"
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "transparent", borderRadius: R.sm, padding: "6px 8px", cursor: "pointer", textAlign: "left" }}
              >
                <Avatar initials={tm.initials} color={tm.color} size={22} fontSize={12} />
                <span style={{ ...TX.caption, color: C.ink900 }}>{tm.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="secondary" onClick={submit} disabled={!commentDraft.trim()}>Publier</Button>
        </div>
      </div>

      {/* Derived activity timeline — delivered rendus (real task dates) + the
          project opening. Always present, so the feed reads as a real history
          rather than an empty placeholder. */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
        <div style={{ ...TX.overline, color: C.ink600, marginBottom: 10 }}>Historique du projet</div>
        {history.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", marginBottom: i === history.length - 1 ? 0 : 11 }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, transform: "translateY(5px)", background: a.kind === "rendu" ? C.brand : C.ink300 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...TX.caption, color: C.ink900 }}>
                {a.kind === "rendu" ? <>Rendu livré · <span style={{ fontWeight: 600 }}>{a.text}</span></> : a.text}
              </div>
              <div style={{ ...TX.nano, color: C.ink500, marginTop: 1 }}>
                {a.who ? `${a.who.name} · ` : ""}{fmtFull(a.date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CommentItem({ cm, teamFirstNames }: { cm: { author: string; initials: string; color: string; text: string; when: string; at?: string }; teamFirstNames: Set<string> }) {
  // Prefer the live relative label computed from `at`; fall back to the stored
  // string for legacy comments.
  const whenLabel = cm.at ? relativeWhen(cm.at) : cm.when;
  // Render @mentions of real team members as accented tokens.
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(cm.text)) !== null) {
    const name = m[1].split(/\s+/)[0].toLowerCase();
    const isMember = teamFirstNames.has(name);
    if (m.index > last) parts.push(cm.text.slice(last, m.index));
    parts.push(
      isMember
        ? <span key={`${m.index}`} style={{ color: C.brand, fontWeight: 600 }}>@{m[1]}</span>
        : `@${m[1]}`,
    );
    last = m.index + m[0].length;
  }
  if (last < cm.text.length) parts.push(cm.text.slice(last));

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
      {/* neutral author avatar — identity is the name + initials, not a hue */}
      <Avatar initials={cm.initials} color={C.ink400} size={28} fontSize={12} title={cm.author} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...TX.caption }}>
          <span style={{ fontWeight: 600, color: C.ink900 }}>{cm.author}</span>{" "}
          <span style={{ color: C.ink500 }} title={cm.at ?? cm.when}>· {whenLabel}</span>
        </div>
        <div style={{ ...TX.body, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{parts}</div>
      </div>
      {/* delete-own: the store does not yet expose deleteComment / current-user
          identity, so the affordance is omitted rather than faked.
          // TODO(store): add deleteComment + auth identity, then enable. */}
    </div>
  );
}

// ───────────────────────────────────────── internals

function SubtaskRow({
  projectId,
  subtask,
  siblings,
  team,
  onUpdate,
  onDelete,
}: {
  projectId: number;
  subtask: DerivedSubtask;
  siblings: DerivedSubtask[];
  team: TeamMember[];
  onUpdate: (projectId: number, subtaskId: number, patch: SubtaskPatch) => void;
  onDelete: (projectId: number, subtaskId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const depNames = new Map(siblings.map((s) => [s.id, s.name]));
  const depsById = new Map(siblings.map((s) => [s.id, s.dependsOn]));
  const reaches = (from: number, target: number, seen = new Set<number>()): boolean => {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (depsById.get(from) ?? []).some((d) => reaches(d, target, seen));
  };
  const depOptions = siblings.filter(
    (s) => s.id !== subtask.id && !subtask.dependsOn.includes(s.id) && !reaches(s.id, subtask.id),
  );
  const addDep = (id: number) => onUpdate(projectId, subtask.id, { dependsOn: [...subtask.dependsOn, id] });
  const removeDep = (id: number) => onUpdate(projectId, subtask.id, { dependsOn: subtask.dependsOn.filter((x) => x !== id) });

  const overdue = !subtask.done && daysFromToday(subtask.end) < 0;

  return (
    <div style={{ borderTop: `1px solid ${C.line}` }}>
      {/* collapsed line: ✓ name · assignee · end date · status */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 2px" }}>
        <Checkbox tone="brand" checked={subtask.done} onChange={() => onUpdate(projectId, subtask.id, { done: !subtask.done })} label="Tâche terminée" />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-edit"
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, textAlign: "left",
            border: "1px solid transparent", background: "transparent", borderRadius: R.sm, padding: "4px 7px", cursor: "pointer", font: "inherit",
          }}
        >
          <span
            title={subtask.name}
            style={{
              ...TX.bodyStrong, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              textDecoration: subtask.done ? "line-through" : "none",
              color: subtask.done ? C.ink400 : C.ink900,
            }}
          >
            {subtask.name}
          </span>
          {subtask.onCriticalPath && !subtask.done ? (
            <span style={{ ...TX.eyebrow, fontSize: 12, letterSpacing: ".03em", color: C.ink600, border: `1px solid ${C.lineStrong}`, padding: "0 5px", borderRadius: R.xs, flexShrink: 0 }} title="Sur le chemin critique — aucun retard possible sans décaler la fin">
              critique
            </span>
          ) : subtask.float > 0 && !subtask.done ? (
            <span style={{ ...TX.micro, color: C.ink500, flexShrink: 0 }} title="Marge avant d’impacter la fin du projet">
              +{formatDays(subtask.float)} de marge
            </span>
          ) : null}
        </button>

        <Avatar initials={subtask.assignee.initials} color={subtask.assignee.color} size={22} fontSize={12} title={subtask.assignee.name} />
        <span style={{ ...TX.micro, color: overdue ? C.danger : C.ink500, whiteSpace: "nowrap", width: 64, textAlign: "right" }}>
          {fmtShort(subtask.end)}
        </span>
        <IconButton size={28} tone="danger" onClick={() => onDelete(projectId, subtask.id)} aria-label="Supprimer la tâche">
          <TrashIcon size={13} />
        </IconButton>
      </div>

      {/* expanded editor */}
      {open ? (
        <div style={{ padding: "0 2px 12px", paddingLeft: 27 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ ...TX.overline, color: C.ink600, display: "block", marginBottom: 5 }}>Intitulé</span>
            <Input
              size="sm"
              defaultValue={subtask.name}
              key={subtask.name}
              aria-label="Nom de la tâche"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== subtask.name) onUpdate(projectId, subtask.id, { name: v }); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto 64px", gap: 7, alignItems: "center" }}>
            <Select size="sm" aria-label="Responsable" value={subtask.assigneeId} onChange={(e) => onUpdate(projectId, subtask.id, { assigneeId: Number(e.target.value) })}>
              {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </Select>
            <Input size="sm" type="date" aria-label="Date de début" value={subtask.start} onChange={(e) => onUpdate(projectId, subtask.id, { start: e.target.value })} style={{ width: 148 }} />
            <Input size="sm" type="number" min={1} aria-label="Jours planifiés" value={subtask.plannedDays} onChange={(e) => onUpdate(projectId, subtask.id, { plannedDays: Math.max(1, Number(e.target.value)) })} />
          </div>
          <div style={{ ...TX.micro, color: C.ink500, marginTop: 6 }}>fin {fmtFull(subtask.end)}</div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 9, flexWrap: "wrap" }}>
            <span style={{ ...TX.micro, color: C.ink500 }}>après</span>
            {subtask.dependsOn.map((id) => (
              <span
                key={id}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, background: SURFACE.container, border: `1px solid ${C.line}`, borderRadius: R.xs, padding: "1px 4px 1px 8px", color: C.ink700 }}
              >
                {depNames.get(id) ?? `#${id}`}
                <button onClick={() => removeDep(id)} aria-label="Retirer la dépendance" className="btn soft-hover" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.ink500, lineHeight: 1, padding: 0, display: "flex", borderRadius: R.xs }}>
                  <CloseIcon size={11} />
                </button>
              </span>
            ))}
            {depOptions.length > 0 ? (
              <Select
                size="sm"
                value=""
                aria-label="Ajouter une dépendance"
                onChange={(e) => e.target.value && addDep(Number(e.target.value))}
                style={{ width: 180, height: 28, fontSize: 12 }}
              >
                <option value="">+ dépendance…</option>
                {depOptions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </Select>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Click-to-edit text that looks static until focused. Saves on blur/Enter,
 *  reverts on Escape. Exported for the drawer header + page header. */
export function EditableText({ value, onSave, ariaLabel, style }: { value: string; onSave: (v: string) => void; ariaLabel: string; style?: React.CSSProperties }) {
  return (
    <input
      defaultValue={value}
      key={value}
      aria-label={ariaLabel}
      className="inline-edit"
      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== value) onSave(v); else e.target.value = value; }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { (e.currentTarget as HTMLInputElement).value = value; e.currentTarget.blur(); }
      }}
      style={{ font: "inherit", ...style, border: "1px solid transparent", background: "transparent", borderRadius: R.xs, padding: "1px 4px", margin: "-1px -4px", outline: "none", minWidth: 0, width: "auto", maxWidth: "100%" }}
      size={Math.max(4, value.length)}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ ...TX.overline, color: C.ink600, display: "block", marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint, title, valueColor, children }: { label: string; value: string; hint?: string; title?: string; valueColor?: string; children?: React.ReactNode }) {
  return (
    <div title={title} style={{ background: SURFACE.container, border: `1px solid ${C.line}`, borderRadius: R.md, padding: "12px 14px" }}>
      <div style={{ ...TX.overline, color: C.ink600 }}>{label}</div>
      <div style={{ ...num(28), marginTop: 4, color: valueColor ?? C.ink900 }}>{value}</div>
      {hint ? <div style={{ ...TX.micro, color: C.ink500, marginTop: 3 }}>{hint}</div> : null}
      {children}
    </div>
  );
}
