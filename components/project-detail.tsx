"use client";

// Shared project-detail sections, composed by BOTH the peek drawer and the
// full /projets/[id] page. Each section reads the store directly so callers
// just drop them in. `p` is the derived project (extends the raw Project).

import { useState } from "react";

import { CloseIcon, PlusIcon, TrashIcon } from "./icons";
import { Avatar, Button, Checkbox, IconButton, Input, ProgressBar, Select } from "./ui";
import type { SubtaskPatch } from "@/lib/data/repository";
import type { DerivedProject, DerivedSubtask } from "@/lib/derive";
import { fmtFull, REFERENCE_DATE } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, FONT_DISPLAY, num, R, STATUS_META, TX } from "@/lib/tokens";
import { FINAL_PHASE_INDEX, PHASES, STATUSES, type TeamMember } from "@/lib/types";

const LABEL: React.CSSProperties = { ...TX.eyebrow, color: C.ink500 };

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
          style={titleStyle ?? { fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.2, color: C.ink900 }}
        />
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 2, ...TX.caption, color: C.ink500 }}>
        <EditableText value={p.client} onSave={(v) => updateProject(p.id, { client: v })} ariaLabel="Maître d'ouvrage" style={{ color: C.ink500 }} />
        <span style={{ color: C.ink400 }}>·</span>
        <EditableText value={p.discipline} onSave={(v) => updateProject(p.id, { discipline: v })} ariaLabel="Discipline" style={{ color: C.ink500 }} />
      </div>
    </>
  );
}

/** Honoraires + avancement, statut, phase stepper, responsable/dates, équipe. */
export function ProjectOverview({ p }: { p: DerivedProject }) {
  const { team, updateProject, setStatus, advancePhase, setPhase } = useProjects();
  const canAdvance = p.phaseIndex < FINAL_PHASE_INDEX;
  const doneCount = p.subtasksD.filter((s) => s.done).length;
  const N = PHASES.length;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.md, padding: "12px 14px" }}>
          <div style={{ ...TX.eyebrow, color: C.ink500 }}>Honoraires</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
            <input
              key={p.budget}
              defaultValue={p.budget}
              type="number"
              min={0}
              step={10}
              aria-label="Honoraires en milliers d'euros"
              className="inline-edit"
              onBlur={(e) => { const v = Math.max(0, Math.round(Number(e.target.value) || 0)); if (v !== p.budget) updateProject(p.id, { budget: v }); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              style={{ width: 92, ...num(22), color: C.ink900, border: "1px solid transparent", background: "transparent", borderRadius: R.xs, padding: "0 3px", margin: "0 -3px", outline: "none" }}
            />
            <span style={{ ...TX.caption, color: C.ink500 }}>k€</span>
          </div>
          <div style={{ ...TX.micro, color: C.ink500, marginTop: 3 }}>{p.budgetFmt}</div>
        </div>
        <Stat label="Avancement" value={`${p.progress} %`} hint={`${doneCount} / ${p.subtasksD.length} tâches`}>
          <div style={{ marginTop: 8 }}><ProgressBar pct={p.progress} color={C.brand} height={5} /></div>
        </Stat>
      </div>

      <div style={{ ...LABEL, marginBottom: 9 }}>Statut</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
        {STATUSES.map((st) => {
          const m = STATUS_META[st];
          const active = st === p.status;
          return (
            <button
              key={st}
              onClick={() => setStatus(p.id, st)}
              aria-pressed={active}
              className="btn"
              style={{
                cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 540, whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: R.sm,
                ...(active
                  ? { background: m.bg, color: m.color, border: `1px solid transparent` }
                  : { background: C.surface, color: C.ink500, border: `1px solid ${C.line}` }),
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? m.color : C.ink400 }} />
              {m.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={LABEL}>Phase d&apos;étude</div>
        <Button size="sm" disabled={!canAdvance} onClick={() => advancePhase(p.id)}>Phase suivante</Button>
      </div>
      <div style={{ position: "relative", marginBottom: 26 }}>
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
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
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
                <span style={{ ...TX.micro, color: cur ? C.ink900 : isDone ? C.ink700 : C.ink400, fontWeight: cur ? 600 : 500 }}>{ph}</span>
              </button>
            );
          })}
        </div>
      </div>

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
            <Avatar initials={m.initials} color={m.color} size={28} fontSize={10} ring title={`${m.name} · ${m.role}`} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Task list (with dependencies) + add-task form. */
export function ProjectTasks({ p }: { p: DerivedProject }) {
  const { team, addSubtask, updateSubtask, deleteSubtask } = useProjects();
  const [ntName, setNtName] = useState("");
  const [ntAssignee, setNtAssignee] = useState<number | null>(null);
  const [ntStart, setNtStart] = useState(REFERENCE_DATE);
  const [ntDays, setNtDays] = useState(5);
  const assigneeDefault = ntAssignee ?? p.responsableId;
  const doneCount = p.subtasksD.filter((s) => s.done).length;

  function handleAdd() {
    if (!ntName.trim()) return;
    addSubtask(p.id, { name: ntName, assigneeId: assigneeDefault, start: ntStart, plannedDays: ntDays });
    setNtName("");
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={LABEL}>Tâches &amp; planning</div>
        <span style={{ ...TX.micro, color: C.ink500 }}>{doneCount} / {p.subtasksD.length} · {p.doneDays} / {p.totalDays} j</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        {p.subtasksD.length === 0 ? (
          <div style={{ ...TX.caption, color: C.ink500, padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
            Aucune tâche. Ajoutez la première ci-dessous.
          </div>
        ) : (
          p.subtasksD.map((s) => (
            <SubtaskRow key={s.id} projectId={p.id} subtask={s} siblings={p.subtasksD} team={team} onUpdate={updateSubtask} onDelete={deleteSubtask} />
          ))
        )}
      </div>

      <div style={{ background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.md, padding: 12 }}>
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

/** Comment thread + composer. */
export function ProjectComments({ p }: { p: DerivedProject }) {
  const { addComment, commentDraft, setCommentDraft } = useProjects();
  return (
    <>
      {p.comments.length === 0 ? (
        <div style={{ ...TX.caption, color: C.ink500, marginBottom: 12 }}>Aucun commentaire pour l&apos;instant.</div>
      ) : null}
      {p.comments.map((cm, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <Avatar initials={cm.initials} color={cm.color} size={28} fontSize={10} title={cm.author} />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...TX.caption }}>
              <span style={{ fontWeight: 600, color: C.ink900 }}>{cm.author}</span>{" "}
              <span style={{ color: C.ink400 }}>· {cm.when}</span>
            </div>
            <div style={{ ...TX.body, marginTop: 2 }}>{cm.text}</div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Input
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && commentDraft.trim()) addComment(p.id); }}
          placeholder="Ajouter un commentaire…"
        />
        <Button variant="secondary" onClick={() => commentDraft.trim() && addComment(p.id)} disabled={!commentDraft.trim()}>Publier</Button>
      </div>
    </>
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

  return (
    <div style={{ padding: "10px 2px", borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Checkbox tone="brand" checked={subtask.done} onChange={() => onUpdate(projectId, subtask.id, { done: !subtask.done })} label="Tâche terminée" />
        <input
          defaultValue={subtask.name}
          aria-label="Nom de la tâche"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== subtask.name) onUpdate(projectId, subtask.id, { name: v }); }}
          className="ui-field"
          style={{
            flex: 1, border: "1px solid transparent", background: "transparent", borderRadius: R.sm,
            padding: "5px 7px", font: "inherit", fontSize: 14, fontWeight: 500, outline: "none",
            textDecoration: subtask.done ? "line-through" : "none",
            color: subtask.done ? C.ink400 : C.ink900,
          }}
        />
        <IconButton size={28} tone="danger" onClick={() => onDelete(projectId, subtask.id)} aria-label="Supprimer la tâche">
          <TrashIcon size={13} />
        </IconButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto 56px", gap: 7, alignItems: "center", marginTop: 7, paddingLeft: 27 }}>
        <Select size="sm" aria-label="Responsable" value={subtask.assigneeId} onChange={(e) => onUpdate(projectId, subtask.id, { assigneeId: Number(e.target.value) })}>
          {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
        </Select>
        <Input size="sm" type="date" aria-label="Date de début" value={subtask.start} onChange={(e) => onUpdate(projectId, subtask.id, { start: e.target.value })} style={{ width: 148 }} />
        <Input size="sm" type="number" min={1} aria-label="Jours planifiés" value={subtask.plannedDays} onChange={(e) => onUpdate(projectId, subtask.id, { plannedDays: Math.max(1, Number(e.target.value)) })} />
      </div>
      <div style={{ ...TX.micro, color: C.ink400, marginTop: 4, paddingLeft: 27 }}>fin {fmtFull(subtask.end)}</div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7, paddingLeft: 27, flexWrap: "wrap" }}>
        <span style={{ ...TX.micro, color: C.ink400 }}>↳ après</span>
        {subtask.dependsOn.map((id) => (
          <span
            key={id}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.xs, padding: "1px 4px 1px 8px", color: C.ink700 }}
          >
            {depNames.get(id) ?? `#${id}`}
            <button onClick={() => removeDep(id)} aria-label="Retirer la dépendance" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.ink400, lineHeight: 1, padding: 0, display: "flex" }}>
              <CloseIcon size={11} />
            </button>
          </span>
        ))}
        {depOptions.length > 0 ? (
          <select
            value=""
            aria-label="Ajouter une dépendance"
            onChange={(e) => e.target.value && addDep(Number(e.target.value))}
            className="ui-field"
            style={{ fontSize: 11, padding: "3px 6px", borderRadius: R.xs, border: `1px solid ${C.line}`, background: C.surface, color: C.ink500, maxWidth: 160, cursor: "pointer", outline: "none" }}
          >
            <option value="">+ dépendance…</option>
            {depOptions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        ) : null}
      </div>
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
      <span style={{ ...TX.eyebrow, color: C.ink500, display: "block", marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.md, padding: "12px 14px" }}>
      <div style={{ ...TX.eyebrow, color: C.ink500 }}>{label}</div>
      <div style={{ ...num(22), marginTop: 4, color: C.ink900 }}>{value}</div>
      {hint ? <div style={{ ...TX.micro, color: C.ink500, marginTop: 3 }}>{hint}</div> : null}
      {children}
    </div>
  );
}
