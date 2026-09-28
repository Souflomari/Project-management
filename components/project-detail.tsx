"use client";

// Shared project-detail sections. The PEEK drawer composes the fast-triage
// pieces (identity, status, next deliverable, margin, quick actions, recent
// comments); the full /projets/[id] PAGE composes the workspace pieces (task
// planning surface, activity feed, properties rail, EVM card). Each section
// reads the store directly so callers just drop them in. `p` is the derived
// project (extends the raw Project).

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { CloseIcon, PlusIcon, TrashIcon } from "./icons";
import { Avatar, Button, Checkbox, IconButton, Input, ProgressBar, Select, Textarea } from "./ui";
import type { SubtaskPatch } from "@/lib/data/repository";
import { buildBudget, type DerivedProject, type DerivedSubtask } from "@/lib/derive";
import { daysFromToday, fmtEur, fmtFull, fmtShort, formatDays, pct, REFERENCE_DATE, relativeWhen } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, FONT_DISPLAY, num, R, SURFACE, STATUS_META, TX } from "@/lib/tokens";
import { FINAL_PHASE_INDEX, PHASES, STATUSES, type TeamMember } from "@/lib/types";

// Section headings read as quiet sentence-case overlines (editorial, not robotic
// uppercase). Eyebrow (uppercase, tracked) is reserved for the few true category
// tags — the stat-cell metadata labels below.
const LABEL: React.CSSProperties = { ...TX.overline, color: C.ink700 };

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <PropRow label="Début">
          <DateField
            ariaLabel="Date de début"
            value={p.start}
            max={p.deadline}
            validate={(v) => (v > p.deadline ? `Le début doit précéder l’échéance (${fmtShort(p.deadline)}).` : null)}
            onCommit={(v) => updateProject(p.id, { start: v })}
          />
        </PropRow>
        <PropRow label={`Échéance · ${p.deadlineDaysLabel}`}>
          <DateField
            ariaLabel="Échéance finale"
            value={p.deadline}
            min={p.start}
            validate={(v) => (v < p.start ? `L’échéance doit suivre le début (${fmtShort(p.start)}).` : null)}
            onCommit={(v) => updateProject(p.id, { deadline: v })}
          />
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
  const [ntDays, setNtDays] = useState("5");
  const assigneeDefault = ntAssignee ?? p.responsableId;
  const ntDaysErr = daysError(ntDays);
  const ntStartErr = dateError(ntStart);
  const ntErrId = useId();
  const canAdd = !!ntName.trim() && !ntDaysErr && !ntStartErr;
  const doneCount = p.subtasksD.filter((s) => s.done).length;

  // Planning surface: sort by start date (the order work actually happens).
  const ordered = useMemo(
    () => [...p.subtasksD].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)),
    [p.subtasksD],
  );

  function handleAdd() {
    if (!canAdd) return;
    addSubtask(p.id, { name: ntName.trim(), assigneeId: assigneeDefault, start: ntStart, plannedDays: Number(ntDays) });
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
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Intitulé de la tâche"
          aria-label="Intitulé de la nouvelle tâche"
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 8, alignItems: "center" }}>
          <Select size="sm" aria-label="Responsable" value={assigneeDefault} onChange={(e) => setNtAssignee(Number(e.target.value))}>
            {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </Select>
          <Input size="sm" type="date" required aria-label="Date de début" invalid={!!ntStartErr} aria-describedby={ntStartErr ? ntErrId : undefined} value={ntStart} onChange={(e) => setNtStart(e.target.value)} style={{ width: 150 }} />
          <Input size="sm" type="text" inputMode="numeric" aria-label="Jours planifiés" invalid={!!ntDaysErr} aria-describedby={ntDaysErr ? ntErrId : undefined} value={ntDays} onChange={(e) => setNtDays(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }} style={{ width: 64 }} />
        </div>
        {ntStartErr || ntDaysErr ? (
          <div id={ntErrId} role="alert" style={{ ...TX.nano, color: C.danger, marginTop: 6 }}>{ntStartErr ?? ntDaysErr}</div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <Button size="sm" variant="secondary" icon={<PlusIcon size={14} />} onClick={handleAdd} disabled={!canAdd}>Ajouter</Button>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────── ACTIVITY / COMMENTS

const MENTION_RE = /@([\p{L}\p{M}'’-]+(?:\s+[\p{L}\p{M}'’-]+)?)/gu;

// Comment drafts, keyed by project id. The store holds ONE shared draft, so a
// half-written comment used to follow you from project to project; the drawer
// and the full page of the SAME project still share theirs (same key).
const drafts = new Map<number, string>();
const draftListeners = new Set<() => void>();
function setDraft(id: number, text: string) {
  if (text) drafts.set(id, text); else drafts.delete(id);
  draftListeners.forEach((l) => l());
}
function useDraft(id: number): [string, (t: string) => void] {
  const text = useSyncExternalStore(
    (cb) => { draftListeners.add(cb); return () => { draftListeners.delete(cb); }; },
    () => drafts.get(id) ?? "",
    () => "",
  );
  return [text, (t) => setDraft(id, t)];
}

/** Activity feed: richer comment thread — multiline composer (Shift+Enter for a
 *  newline), @mentions of team members (↑/↓/Entrée/Échap), relative timestamps. */
export function ProjectComments({ p }: { p: DerivedProject }) {
  const { team, addComment } = useProjects();
  const [draft, setDraftText] = useDraft(p.id);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIdx, setMentionIdx] = useState(0);
  const composerId = useId();
  const listId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Publishing: the composer clears at once (a second Enter finds nothing to
  // send → no double post) and stays locked until the store answers. On failure
  // (the store shows the error toast) the text is put back for a retry.
  const [isPending, setPending] = useState(false);

  const teamFirstNames = useMemo(() => new Set(team.map((m) => m.name.split(" ")[0].toLowerCase())), [team]);
  const mentionMatches = useMemo(() => {
    const m = draft.match(/@([\p{L}\p{M}'’-]*)$/u);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return team.filter((tm) => tm.name.toLowerCase().includes(q)).slice(0, 5);
  }, [draft, team]);
  const showMentions = mentionOpen && mentionMatches.length > 0;
  const activeMention = Math.min(mentionIdx, Math.max(0, mentionMatches.length - 1));

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
    const text = draft.trim();
    if (!text || isPending) return;
    setMentionOpen(false);
    setPending(true);
    setDraftText("");
    addComment(p.id, text)
      .then((posted) => { if (!posted) setDraft(p.id, text); })
      .finally(() => setPending(false));
  }

  function applyMention(name: string) {
    const next = draft.replace(/@([\p{L}\p{M}'’-]*)$/u, `@${name.split(" ")[0]} `);
    setDraftText(next);
    setMentionOpen(false);
    composerRef.current?.focus();
  }

  return (
    <>
      {p.comments.map((cm, i) => (
        <CommentItem key={i} cm={cm} teamFirstNames={teamFirstNames} />
      ))}

      <div style={{ marginTop: 12, position: "relative" }}>
        <label htmlFor={composerId} className="sr-only">Ajouter un commentaire</label>
        <Textarea
          id={composerId}
          ref={composerRef}
          rows={2}
          value={draft}
          readOnly={isPending}
          aria-busy={isPending || undefined}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showMentions}
          aria-controls={showMentions ? listId : undefined}
          aria-activedescendant={showMentions ? `${listId}-${activeMention}` : undefined}
          onChange={(e) => {
            setDraftText(e.target.value);
            setMentionOpen(/@[\p{L}\p{M}'’-]*$/u.test(e.target.value));
            setMentionIdx(0);
          }}
          onKeyDown={(e) => {
            if (showMentions) {
              // The mention list owns ↑/↓/Entrée/Tab/Échap while open. Escape is
              // marked handled so it never also closes the drawer/dialog.
              if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((activeMention + 1) % mentionMatches.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((activeMention - 1 + mentionMatches.length) % mentionMatches.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applyMention(mentionMatches[activeMention].name); return; }
              if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
            }
            // Enter submits; Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          placeholder="Ajouter à l’activité…  (@ pour mentionner · Maj+Entrée pour un retour à la ligne)"
          style={{ minHeight: 60 }}
        />
        {showMentions ? (
          <div
            id={listId}
            role="listbox"
            aria-label="Mentionner un membre"
            style={{ position: "absolute", left: 0, bottom: "100%", marginBottom: 4, background: C.surface, border: `1px solid ${C.lineStrong}`, borderRadius: R.md, boxShadow: "0 8px 16px -6px rgba(28,25,23,.18)", padding: 4, zIndex: 5, minWidth: 200 }}
          >
            {mentionMatches.map((tm, i) => (
              <div
                key={tm.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeMention}
                onMouseDown={(e) => { e.preventDefault(); applyMention(tm.name); }}
                onMouseEnter={() => setMentionIdx(i)}
                className="soft-hover"
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", borderRadius: R.sm, padding: "6px 8px", cursor: "pointer", background: i === activeMention ? C.subtle : "transparent" }}
              >
                <Avatar initials={tm.initials} color={tm.color} size={22} fontSize={12} />
                <span style={{ ...TX.caption, color: C.ink900 }}>{tm.name}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="secondary" onClick={submit} loading={isPending} disabled={!draft.trim()}>Publier</Button>
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
  for (const m of cm.text.matchAll(MENTION_RE)) {
    const name = m[1].split(/\s+/)[0].toLowerCase();
    const isMember = teamFirstNames.has(name);
    if ((m.index ?? 0) > last) parts.push(cm.text.slice(last, m.index));
    parts.push(
      isMember
        ? <span key={`${m.index}`} style={{ color: C.brand, fontWeight: 600 }}>@{m[1]}</span>
        : `@${m[1]}`,
    );
    last = (m.index ?? 0) + m[0].length;
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
            <DateField ariaLabel="Date de début" value={subtask.start} onCommit={(v) => onUpdate(projectId, subtask.id, { start: v })} style={{ width: 148 }} />
            <DaysField key={`pd-${subtask.plannedDays}`} value={subtask.plannedDays} onCommit={(n) => onUpdate(projectId, subtask.id, { plannedDays: n })} />
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
        if (e.key === "Escape") { e.preventDefault(); (e.currentTarget as HTMLInputElement).value = value; e.currentTarget.blur(); }
      }}
      style={{ font: "inherit", ...style, border: "1px solid transparent", background: "transparent", borderRadius: R.xs, padding: "1px 4px", margin: "-1px -4px", outline: "none", minWidth: 0, width: "auto", maxWidth: "100%" }}
      size={Math.max(4, value.length)}
    />
  );
}

// ───────────────────────────────────────── validated inputs

const MAX_TASK_DAYS = 1000;

/** Planned working days: a whole number between 1 and 1000. */
function daysError(raw: string): string | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return "Durée : un nombre entier de jours.";
  const n = Number(t);
  if (n < 1 || n > MAX_TASK_DAYS) return `Durée : entre 1 et ${MAX_TASK_DAYS} jours.`;
  return null;
}

/** A real, plausible calendar date (also rejects the transient years a date
 *  input reports while the user is still typing, e.g. 0002-06-15). */
function dateError(v: string): string | null {
  if (!v) return "Date requise.";
  const y = Number(v.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || y < 2000 || y > 2100) return "Date invalide.";
  return null;
}

/** Date input with a LOCAL draft: typing, ArrowUp/Down on a segment or a
 *  picker selection only edit the draft — the component is never remounted, so
 *  focus stays put and a half-typed date (e.g. "15" in the year) is never
 *  saved. The draft commits on blur/Enter, and only when it is a complete, valid
 *  yyyy-mm-dd that also satisfies `validate`; otherwise it reverts to the last
 *  saved value with an inline error. Escape discards the draft. An external
 *  change of `value` (undo, Gantt drag) shows through whenever no draft is
 *  pending. */
function DateField({ value, onCommit, validate, ariaLabel, min, max, style }: {
  value: string;
  onCommit: (v: string) => void;
  validate?: (v: string) => string | null;
  ariaLabel: string;
  min?: string;
  max?: string;
  style?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const errId = useId();
  const check = (v: string) => dateError(v) ?? validate?.(v) ?? null;

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const msg = check(draft);
    if (msg) { setErr(`${msg} Valeur précédente conservée.`); return; }
    setErr(null);
    if (draft !== value) onCommit(draft);
  };

  // A still-pending valid draft is saved if the field unmounts while focused
  // (drawer closed from the keyboard, project switched) — no silent data loss.
  const pending = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    pending.current = () => { if (draft !== null && !check(draft) && draft !== value) onCommit(draft); };
  });
  useEffect(() => () => pending.current(), []);

  return (
    <div style={{ minWidth: 0 }}>
      <Input
        size="sm"
        type="date"
        required
        aria-label={ariaLabel}
        min={min}
        max={max}
        invalid={!!err}
        aria-describedby={err ? errId : undefined}
        value={draft ?? value}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          // Live feedback only; nothing is saved until blur/Enter.
          setErr(v === value ? null : check(v));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape" && (draft !== null || err)) {
            // Handled here: the enclosing drawer/modal must not close as well.
            e.preventDefault();
            setDraft(null);
            setErr(null);
          }
        }}
        style={style}
      />
      {err ? <div id={errId} role="alert" style={{ ...TX.nano, color: C.danger, marginTop: 4 }}>{err}</div> : null}
    </div>
  );
}

/** Planned-days input: edits locally, commits on blur/Enter only (not on every
 *  keystroke), integer 1..1000; Escape or an invalid value reverts. */
function DaysField({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [err, setErr] = useState<string | null>(null);
  const errId = useId();
  const commit = () => {
    const msg = daysError(text);
    if (msg) { setErr(`${msg} Valeur précédente conservée.`); setText(String(value)); return; }
    setErr(null);
    const n = Number(text.trim());
    if (n !== value) onCommit(n);
  };
  return (
    <div style={{ minWidth: 0 }}>
      <Input
        size="sm"
        type="text"
        inputMode="numeric"
        aria-label="Jours planifiés"
        invalid={!!err}
        aria-describedby={err ? errId : undefined}
        value={text}
        onChange={(e) => { setText(e.target.value); setErr(null); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setText(String(value)); setErr(null); }
        }}
      />
      {err ? <div id={errId} role="alert" style={{ ...TX.nano, color: C.danger, marginTop: 4 }}>{err}</div> : null}
    </div>
  );
}
