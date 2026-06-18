"use client";

import { useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon, EditIcon, PlusIcon, TrashIcon } from "../icons";
import { TeamMemberModal } from "../team-member-modal";
import { Avatar, Button, Card, EmptyState, IconButton, rowProps, Segmented, Toolbar } from "../ui";
import { buildTeamLoad, type HeatBucket } from "@/lib/derive";
import { MONS_LONG, MONTHS_FULL, monthRange, toDate, weekRange } from "@/lib/format";
import { useProjects, type TeamMode } from "@/lib/store/projects-context";
import { C, chargeColor, heatColor, num, TX } from "@/lib/tokens";
import type { TeamMember } from "@/lib/types";

const MODE_OPTS: { value: TeamMode; label: string }[] = [
  { value: "semaine", label: "Semaine" },
  { value: "mois", label: "Mois" },
];

export function Team() {
  const { allDerived, team, teamMode, teamAnchor, setTeamMode, teamPrev, teamNext, deleteTeamMember, openProject } = useProjects();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

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
  const loads = buildTeamLoad(allDerived, team, range, teamMode === "semaine" ? "day" : "week");
  const capacity = loads[0]?.capacity ?? 0;
  const periodLabel =
    teamMode === "semaine"
      ? `${toDate(weekRange(teamAnchor).start).getDate()} – ${toDate(weekRange(teamAnchor).end).getDate()} ${MONTHS_FULL[toDate(weekRange(teamAnchor).end).getMonth()]}`
      : `${MONS_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (m: TeamMember) => { setEditing(m); setModalOpen(true); };

  return (
    <>
      <Toolbar style={{ marginBottom: 8 }}>
        <IconButton onClick={teamPrev} aria-label="Précédent"><ChevronLeftIcon /></IconButton>
        <h2 style={{ ...num(18), minWidth: 150 }}>{periodLabel}</h2>
        <IconButton onClick={teamNext} aria-label="Suivant"><ChevronRightIcon /></IconButton>
        <Segmented value={teamMode} options={MODE_OPTS} onChange={setTeamMode} />
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={openAdd} icon={<PlusIcon size={15} />}>Membre</Button>
        </div>
      </Toolbar>

      <p style={{ ...TX.caption, color: C.ink400, margin: "0 0 20px" }}>
        Charge sur <strong style={{ color: C.ink500, fontWeight: 540 }}>{capacity} jours ouvrés</strong> · frise {teamMode === "semaine" ? "par jour" : "par semaine"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18 }}>
        {loads.map((t) => {
          const c = chargeColor(t.chargePct);
          const isRef = referenced.has(t.member.id);
          return (
            <Card key={t.member.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Avatar initials={t.member.initials} color={t.member.color} size={42} fontSize={15} title={`${t.member.name} · ${t.member.role}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.member.name}</div>
                  <div style={{ ...TX.caption, color: C.ink500 }}>{t.member.role}</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <IconButton size={28} onClick={() => openEdit(t.member)} aria-label="Modifier"><EditIcon size={14} /></IconButton>
                  <IconButton
                    size={28}
                    tone="danger"
                    disabled={isRef}
                    onClick={() => !isRef && deleteTeamMember(t.member.id)}
                    title={isRef ? "Membre affecté à des projets — réaffectez d'abord" : "Supprimer"}
                    style={isRef ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                  >
                    <TrashIcon size={14} />
                  </IconButton>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ ...num(26), color: c }}>{t.chargePct}%</span>
                  <span style={{ ...TX.caption, color: C.ink500 }}>{t.periodDays} j / {t.capacity} j</span>
                </div>
                <span style={{ ...TX.caption, color: C.ink500 }}>{t.projectsActive} projet{t.projectsActive > 1 ? "s" : ""}</span>
              </div>

              <Heatmap buckets={t.buckets} mode={teamMode} />

              {t.tasks.length === 0 ? (
                <div style={{ marginTop: 12 }}><EmptyState title="Aucune tâche planifiée sur la période." /></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
                  {t.tasks.map((task, i) => (
                    <div
                      key={i}
                      {...rowProps(() => openProject(task.projectId))}
                      className="row-hover row-focus"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", ...TX.caption, padding: "2px 4px", borderRadius: 4 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: task.done ? C.ink400 : C.ink900 }}>{task.taskName}</span>
                        <span style={{ color: C.ink400 }}> · {task.projectName}</span>
                      </div>
                      <span style={{ ...num(12), color: C.ink700, whiteSpace: "nowrap" }}>{task.daysInPeriod} j</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {modalOpen ? <TeamMemberModal member={editing} onClose={() => setModalOpen(false)} /> : null}
    </>
  );
}

function Heatmap({ buckets, mode }: { buckets: HeatBucket[]; mode: TeamMode }) {
  if (buckets.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {buckets.map((b, i) => {
        const bg = heatColor(b.pct);
        // Cells are now light/muted, so dark ink keeps contrast across the ramp.
        const txt = b.pct === 0 ? C.ink400 : C.ink800;
        return (
          <div key={i} style={{ flex: 1, minWidth: 0 }} title={`${mode === "semaine" ? "" : "Semaine du "}${b.label} · ${b.days}/${b.capacity} j · ${b.pct}%`}>
            <div style={{ height: 30, borderRadius: 4, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: txt }}>{b.pct > 0 ? `${b.pct}%` : ""}</span>
            </div>
            <div style={{ fontSize: 9.5, color: C.ink400, textAlign: "center", marginTop: 3 }}>{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}
