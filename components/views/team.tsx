"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ChevronLeftIcon, ChevronRightIcon, EditIcon, PlusIcon, TrashIcon } from "../icons";
import { TeamMemberModal } from "../team-member-modal";
import { Avatar, Button, Card, EmptyState, IconButton, rowProps, Segmented, Toolbar } from "../ui";
import { buildTeamLoad, type HeatBucket } from "@/lib/derive";
import { isToday, MONS_LONG, MONTHS_FULL, monthRange, toDate, weekRange } from "@/lib/format";
import { useProjects, type TeamMode } from "@/lib/store/projects-context";
import { C, chargeColor, loadTier, num, R, SP, SURFACE, TX } from "@/lib/tokens";
import type { TeamMember } from "@/lib/types";

const MODE_OPTS: { value: TeamMode; label: string }[] = [
  { value: "semaine", label: "Semaine" },
  { value: "mois", label: "Mois" },
];

export function Team() {
  const { allDerived, team, teamMode, teamAnchor, setTeamMode, teamPrev, teamNext, teamToday, deleteTeamMember, openProject, setSearch } = useProjects();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

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
        <Button variant="secondary" size="sm" onClick={teamToday}>Aujourd’hui</Button>
        <Segmented value={teamMode} options={MODE_OPTS} onChange={setTeamMode} />
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={openAdd} icon={<PlusIcon size={15} />}>Nouveau membre</Button>
        </div>
      </Toolbar>

      <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 20px" }}>
        Charge sur <strong style={{ color: C.ink700, fontWeight: 540 }}>{capacity} jours ouvrés</strong> · répartition {teamMode === "semaine" ? "par jour" : "par semaine"} · la ligne = 100&#8239;% (pleine capacité)
      </p>

      <div className="enter-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 18 }}>
        {loads.map((t) => {
          const c = chargeColor(t.chargePct);
          const isRef = referenced.has(t.member.id);
          return (
            <Card key={t.member.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <button
                  {...rowProps(() => showProjectsOf(t.member))}
                  className="soft-hover row-focus"
                  title={`Voir les projets de ${t.member.name}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "none", border: "none", padding: "4px 6px", margin: "-4px -6px", borderRadius: R.sm, cursor: "pointer", textAlign: "left" }}
                >
                  <Avatar initials={t.member.initials} color={t.member.color} size={42} fontSize={15} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink900 }}>{t.member.name}</div>
                    <div style={{ ...TX.caption, color: C.ink500 }}>{t.member.role}</div>
                  </div>
                </button>
                <div style={{ display: "flex", gap: 5 }}>
                  <IconButton size={28} onClick={() => openEdit(t.member)} aria-label="Modifier"><EditIcon size={14} /></IconButton>
                  <IconButton
                    size={28}
                    tone="danger"
                    disabled={isRef}
                    onClick={() => !isRef && deleteTeamMember(t.member.id)}
                    title={isRef ? "Membre affecté à des projets — réaffectez d’abord" : "Supprimer"}
                  >
                    <TrashIcon size={14} />
                  </IconButton>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  {(() => {
                    const tier = loadTier(t.chargePct);
                    const over = tier === "over" || tier === "crit";
                    // Over capacity, the raw % balloons (a member can read 290 %+).
                    // Cap the headline at a credible ceiling and carry the real
                    // figure as concrete overflow days ("+N j"), so the card reads
                    // "booked past capacity", not "broken counter".
                    const shown = over ? Math.min(t.chargePct, 130) : t.chargePct;
                    return (
                      <>
                        <span style={{ ...num(26), color: c }}>{shown}&#8239;%{over ? " +" : ""}</span>
                        <span style={{ ...TX.caption, color: C.ink500 }}>
                          {t.periodDays} / {t.capacity} j
                          {over ? <span style={{ color: c, fontWeight: 540 }}> · +{t.periodDays - t.capacity}&#8239;j de surcapacité</span> : ""}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <span style={{ ...TX.caption, color: C.ink500 }}>{t.projectsActive} projet{t.projectsActive > 1 ? "s" : ""}</span>
              </div>

              <div style={{ background: SURFACE.containerLow, border: `1px solid ${C.line}`, borderRadius: R.md, padding: `${SP[5]}px ${SP[5]}px ${SP[4]}px` }}>
                <Heatmap buckets={t.buckets} mode={teamMode} />
              </div>

              {t.tasks.length === 0 ? (
                <div style={{ marginTop: SP[4] }}>
                  <EmptyState compact title="Aucune tâche planifiée" hint="Rien d’affecté à ce membre sur la période." />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: SP[4] }}>
                  {t.tasks.map((task, i) => (
                    <div
                      key={i}
                      {...rowProps(() => openProject(task.projectId))}
                      className="row-hover row-focus"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", ...TX.caption, padding: "2px 4px", borderRadius: R.xxs }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: task.done ? C.ink500 : C.ink900 }}>{task.taskName}</span>
                        <span style={{ color: C.ink500 }}> · {task.projectName}</span>
                      </div>
                      <span style={{ ...num(12), color: C.ink700, whiteSpace: "nowrap" }}>{task.daysInPeriod}&#8239;j</span>
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

const WD = ["L", "M", "M", "J", "V", "S", "D"];

/** Workload heatmap as bars against a 100%-capacity line: the bar fills toward
 *  the dashed line at full capacity, and a terracotta cap rises above it when
 *  the period is overbooked — so *when* overload happens is readable at a glance. */
function Heatmap({ buckets, mode }: { buckets: HeatBucket[]; mode: TeamMode }) {
  if (buckets.length === 0) return null;
  const FULL = 32; // px height representing 100% capacity
  const OVER = 10; // headroom above the line for the overflow cap
  const H = FULL + OVER;
  return (
    <div style={{ display: "flex", gap: mode === "semaine" ? 5 : 3, alignItems: "flex-end" }}>
      {buckets.map((b, i) => {
        const d = toDate(b.start);
        const today = mode === "semaine" && isToday(b.start);
        // Fill never exceeds the 100 % track; overflow becomes a capped cap above
        // the line whose *height saturates* (more red ≠ taller bar), so a 290 %
        // cell reads as "firmly over" without overshooting the track.
        const base = (Math.min(b.pct, 100) / 100) * FULL;
        const over = b.pct > 100 ? Math.min((b.pct - 100) / 40, 1) * OVER : 0;
        const overDays = Math.max(0, b.days - b.capacity);
        const lab = mode === "semaine" ? WD[(d.getDay() + 6) % 7] : String(d.getDate());
        return (
          <div key={i} style={{ flex: 1, minWidth: 0 }} title={`${mode === "semaine" ? "" : "Semaine du "}${d.getDate()} ${MONTHS_FULL[d.getMonth()]} · ${b.days} / ${b.capacity} j · ${b.pct} %`}>
            <div style={{ position: "relative", height: H, borderRadius: R.xs, background: SURFACE.containerHigh, boxShadow: `inset 0 0 0 1px ${C.line}`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: OVER, borderTop: `1px dashed ${C.lineStrong}` }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: base, background: chargeColor(b.pct) }} />
              {over > 0 ? <div style={{ position: "absolute", left: 0, right: 0, bottom: FULL, height: over, background: chargeColor(120), backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.28) 0 2px, transparent 2px 4px)" }} /> : null}
              {overDays > 0 ? <span style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontSize: 9, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: C.surface }}>+{overDays}&#8239;j</span> : null}
            </div>
            <div style={{ fontSize: 10, fontWeight: today ? 700 : 450, color: today ? C.ink900 : C.ink500, textAlign: "center", marginTop: 4 }}>{lab}</div>
          </div>
        );
      })}
    </div>
  );
}
