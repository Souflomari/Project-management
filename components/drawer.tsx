"use client";

import { useState } from "react";

import { Avatar } from "./ui";
import type { SubtaskPatch } from "@/lib/data/repository";
import { deriveProject, type DerivedSubtask } from "@/lib/derive";
import { fmtFull } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { DRAWER, FONT_NUM, STATUS_META } from "@/lib/tokens";
import { FINAL_PHASE_INDEX, PHASES, STATUSES, type TeamMember } from "@/lib/types";

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: DRAWER.sub,
};

const fieldStyle: React.CSSProperties = {
  border: `1px solid ${DRAWER.line}`,
  borderRadius: 3,
  padding: "5px 7px",
  font: "inherit",
  fontSize: 12,
  outline: "none",
  background: DRAWER.paper,
  color: DRAWER.ink,
};

export function ProjectDrawer() {
  const {
    selected,
    team,
    closeDrawer,
    advancePhase,
    setStatus,
    addComment,
    commentDraft,
    setCommentDraft,
    addSubtask,
    updateSubtask,
    deleteSubtask,
  } = useProjects();

  const [ntName, setNtName] = useState("");
  const [ntAssignee, setNtAssignee] = useState<number | null>(null);
  const [ntStart, setNtStart] = useState("2026-06-15");
  const [ntDays, setNtDays] = useState(5);

  if (!selected) return null;

  const p = deriveProject(selected, team);
  const canAdvance = selected.phaseIndex < FINAL_PHASE_INDEX;
  const doneCount = p.subtasksD.filter((s) => s.done).length;
  const assigneeDefault = ntAssignee ?? p.responsableId;

  function handleAdd() {
    if (!ntName.trim()) return;
    addSubtask(p.id, { name: ntName, assigneeId: assigneeDefault, start: ntStart, plannedDays: ntDays });
    setNtName("");
  }

  return (
    <>
      <div
        onClick={closeDrawer}
        style={{ position: "fixed", inset: 0, background: "rgba(13,18,28,.38)", zIndex: 60, animation: "fadeIn .18s ease" }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 500,
          maxWidth: "96vw",
          background: DRAWER.paper,
          color: DRAWER.ink,
          zIndex: 61,
          borderLeft: `1px solid ${DRAWER.line}`,
          boxShadow: "-4px 0 16px rgba(20,30,25,.07)",
          overflowY: "auto",
          animation: "drawerIn .26s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {/* header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: DRAWER.paper,
            padding: "18px 24px 14px",
            borderBottom: `1px solid ${DRAWER.line}`,
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={LABEL}>Dossier projet · {p.phaseFull}</span>
            <button
              onClick={closeDrawer}
              style={{
                border: `1px solid ${DRAWER.line}`,
                background: DRAWER.panel,
                cursor: "pointer",
                width: 30,
                height: 30,
                borderRadius: 3,
                fontSize: 16,
                color: DRAWER.sub,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <h2 style={{ margin: "11px 0 4px", fontSize: 21, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.18 }}>
            {p.name}
          </h2>
          <div style={{ fontSize: 13, color: DRAWER.sub }}>
            {p.client} · {p.discipline}
          </div>
        </div>

        <div style={{ padding: "20px 24px 36px" }}>
          {/* stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <Stat label="Honoraires" value={p.budgetFmt} />
            <Stat label="Avancement" value={`${p.progress}%`} hint={`${doneCount}/${p.subtasksD.length} tâches`} />
          </div>

          {/* status */}
          <div style={{ ...LABEL, marginBottom: 9 }}>Statut</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
            {STATUSES.map((st) => {
              const m = STATUS_META[st];
              const active = st === selected.status;
              return (
                <button
                  key={st}
                  onClick={() => setStatus(selected.id, st)}
                  style={{
                    cursor: "pointer",
                    font: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    padding: "6px 11px",
                    borderRadius: 3,
                    ...(active
                      ? { background: m.color, color: "#fff", border: `1px solid ${m.color}` }
                      : { background: DRAWER.panel, color: DRAWER.sub, border: `1px solid ${DRAWER.line}` }),
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* phase stepper */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11 }}>
            <div style={LABEL}>Phase d&apos;étude</div>
            {canAdvance ? (
              <button
                onClick={() => advancePhase(selected.id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  background: DRAWER.ac,
                  padding: "6px 11px",
                  borderRadius: 3,
                }}
              >
                Avancer la phase →
              </button>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26 }}>
            {PHASES.map((ph, i) => {
              const isDone = i < selected.phaseIndex;
              const cur = i === selected.phaseIndex;
              return (
                <div key={ph} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1 }}>
                  <div
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      ...(cur
                        ? { background: DRAWER.paper, border: `3px solid ${DRAWER.ac}` }
                        : isDone
                          ? { background: DRAWER.ac, border: `3px solid ${DRAWER.ac}` }
                          : { background: DRAWER.line, border: `3px solid ${DRAWER.line}` }),
                    }}
                  />
                  <div
                    style={{
                      fontFamily: FONT_NUM,
                      fontSize: 10,
                      color: cur || isDone ? DRAWER.ink : DRAWER.sub,
                      fontWeight: cur ? 700 : 500,
                    }}
                  >
                    {ph}
                  </div>
                </div>
              );
            })}
          </div>

          {/* tasks */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={LABEL}>Tâches & planning</div>
            <span style={{ fontSize: 11, color: DRAWER.sub }}>
              {doneCount}/{p.subtasksD.length} · {p.doneDays}/{p.totalDays} j
            </span>
          </div>

          <div style={{ marginBottom: 12 }}>
            {p.subtasksD.length === 0 ? (
              <div style={{ fontSize: 12.5, color: DRAWER.sub, padding: "8px 0", borderTop: `1px solid ${DRAWER.line}` }}>
                Aucune tâche. Ajoutez la première ci-dessous.
              </div>
            ) : (
              p.subtasksD.map((s) => (
                <SubtaskRow
                  key={s.id}
                  projectId={p.id}
                  subtask={s}
                  siblings={p.subtasksD}
                  team={team}
                  onUpdate={updateSubtask}
                  onDelete={deleteSubtask}
                />
              ))
            )}
          </div>

          {/* add task */}
          <div style={{ background: DRAWER.panel, border: `1px solid ${DRAWER.line}`, borderRadius: 4, padding: 11, marginBottom: 26 }}>
            <div style={{ ...LABEL, marginBottom: 8, fontSize: 10 }}>Nouvelle tâche</div>
            <input
              value={ntName}
              onChange={(e) => setNtName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Intitulé de la tâche"
              style={{ ...fieldStyle, width: "100%", marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={assigneeDefault}
                onChange={(e) => setNtAssignee(Number(e.target.value))}
                style={{ ...fieldStyle, flex: 1, minWidth: 110 }}
              >
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input type="date" value={ntStart} onChange={(e) => setNtStart(e.target.value)} style={fieldStyle} />
              <input
                type="number"
                min={1}
                value={ntDays}
                onChange={(e) => setNtDays(Number(e.target.value))}
                title="Jours planifiés"
                style={{ ...fieldStyle, width: 56 }}
              />
              <span style={{ fontSize: 11, color: DRAWER.sub }}>j</span>
              <button
                onClick={handleAdd}
                style={{
                  border: "none",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  background: DRAWER.ac,
                  padding: "6px 12px",
                  borderRadius: 3,
                }}
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* team + deadline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 26 }}>
            <div>
              <div style={{ ...LABEL, marginBottom: 9 }}>Équipe</div>
              <div style={{ display: "flex", alignItems: "center", paddingLeft: 7 }}>
                {p.members.map((m) => (
                  <div key={m.id} style={{ marginLeft: -7 }}>
                    <Avatar initials={m.initials} color={m.color} size={30} fontSize={10.5} ring title={`${m.name} · ${m.role}`} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...LABEL, marginBottom: 9 }}>Échéance finale</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.deadlineFull}</div>
              <div style={{ fontSize: 11.5, color: DRAWER.sub, marginTop: 2 }}>{p.deadlineDaysLabel}</div>
            </div>
          </div>

          {/* comments */}
          <div style={{ ...LABEL, marginBottom: 10 }}>Notes &amp; commentaires</div>
          {selected.comments.map((cm, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Avatar initials={cm.initials} color={cm.color} size={28} fontSize={10} title={cm.author} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>{cm.author}</span>{" "}
                  <span style={{ color: DRAWER.sub, fontSize: 11 }}>· {cm.when}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>{cm.text}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment(selected.id)}
              placeholder="Ajouter une note…"
              style={{ ...fieldStyle, flex: 1, padding: "9px 12px", fontSize: 13 }}
            />
            <button
              onClick={() => addComment(selected.id)}
              style={{
                border: "none",
                cursor: "pointer",
                font: "inherit",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: DRAWER.ac,
                padding: "9px 15px",
                borderRadius: 3,
              }}
            >
              Publier
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

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
  const depOptions = siblings.filter((s) => s.id !== subtask.id && !subtask.dependsOn.includes(s.id));
  const addDep = (id: number) => onUpdate(projectId, subtask.id, { dependsOn: [...subtask.dependsOn, id] });
  const removeDep = (id: number) =>
    onUpdate(projectId, subtask.id, { dependsOn: subtask.dependsOn.filter((x) => x !== id) });
  return (
    <div style={{ padding: "9px 2px", borderTop: `1px solid ${DRAWER.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          onClick={() => onUpdate(projectId, subtask.id, { done: !subtask.done })}
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 11,
            color: "#fff",
            cursor: "pointer",
            ...(subtask.done
              ? { background: DRAWER.ac, border: `1px solid ${DRAWER.ac}` }
              : { background: DRAWER.paper, border: `1.5px solid ${DRAWER.line}` }),
          }}
        >
          {subtask.done ? "✓" : ""}
        </span>
        <input
          defaultValue={subtask.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== subtask.name) onUpdate(projectId, subtask.id, { name: v });
          }}
          style={{
            ...fieldStyle,
            flex: 1,
            border: "1px solid transparent",
            background: "transparent",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: subtask.done ? "line-through" : "none",
            color: subtask.done ? DRAWER.sub : DRAWER.ink,
          }}
        />
        <button
          onClick={() => onDelete(projectId, subtask.id)}
          title="Supprimer"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: DRAWER.sub, fontSize: 15, lineHeight: 1, padding: 2 }}
        >
          ×
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, paddingLeft: 27, flexWrap: "wrap" }}>
        <select
          value={subtask.assigneeId}
          onChange={(e) => onUpdate(projectId, subtask.id, { assigneeId: Number(e.target.value) })}
          style={{ ...fieldStyle, maxWidth: 130 }}
        >
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={subtask.start}
          onChange={(e) => onUpdate(projectId, subtask.id, { start: e.target.value })}
          style={fieldStyle}
        />
        <input
          type="number"
          min={1}
          value={subtask.plannedDays}
          onChange={(e) => onUpdate(projectId, subtask.id, { plannedDays: Math.max(1, Number(e.target.value)) })}
          title="Jours planifiés"
          style={{ ...fieldStyle, width: 52 }}
        />
        <span style={{ fontSize: 11, color: DRAWER.sub, whiteSpace: "nowrap" }}>j · fin {fmtFull(subtask.end)}</span>
      </div>

      {/* dependencies (Finish-to-Start) */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, paddingLeft: 27, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, color: DRAWER.sub }}>↳ après</span>
        {subtask.dependsOn.map((id) => (
          <span
            key={id}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, background: DRAWER.panel, border: `1px solid ${DRAWER.line}`, borderRadius: 3, padding: "1px 4px 1px 7px", color: "#3B5560" }}
          >
            {depNames.get(id) ?? `#${id}`}
            <button onClick={() => removeDep(id)} title="Retirer" style={{ border: "none", background: "transparent", cursor: "pointer", color: DRAWER.sub, fontSize: 12, lineHeight: 1, padding: 0 }}>
              ×
            </button>
          </span>
        ))}
        {depOptions.length > 0 ? (
          <select
            value=""
            onChange={(e) => e.target.value && addDep(Number(e.target.value))}
            style={{ ...fieldStyle, fontSize: 10.5, padding: "3px 5px", maxWidth: 150 }}
          >
            <option value="">+ dépendance…</option>
            {depOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: DRAWER.panel, border: `1px solid ${DRAWER.line}`, borderRadius: 4, padding: "10px 12px" }}>
      <div style={{ ...LABEL, fontSize: 10, letterSpacing: ".07em" }}>{label}</div>
      <div style={{ fontFamily: FONT_NUM, fontSize: 22, fontWeight: 600, marginTop: 3 }}>{value}</div>
      {hint ? <div style={{ fontSize: 10.5, color: DRAWER.sub, marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}
