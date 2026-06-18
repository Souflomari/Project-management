"use client";

import { useState } from "react";

import { Avatar } from "../ui";
import { TeamMemberModal } from "../team-member-modal";
import { buildTeamLoad, type HeatBucket } from "@/lib/derive";
import { MONS_LONG, MONTHS_FULL, monthRange, toDate, weekRange } from "@/lib/format";
import { useProjects, type TeamMode } from "@/lib/store/projects-context";
import { chargeColor, FONT_NUM, heatColor } from "@/lib/tokens";
import type { TeamMember } from "@/lib/types";

const navBtn: React.CSSProperties = {
  border: "1px solid #E2E6E0",
  background: "#fff",
  cursor: "pointer",
  width: 30,
  height: 30,
  borderRadius: 3,
  fontSize: 15,
  color: "#3B5560",
};

export function Team() {
  const { allDerived, team, teamMode, teamAnchor, setTeamMode, teamPrev, teamNext, deleteTeamMember, openProject } = useProjects();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const anchor = toDate(teamAnchor);
  const range = teamMode === "semaine" ? weekRange(teamAnchor) : monthRange(anchor.getFullYear(), anchor.getMonth());
  const loads = buildTeamLoad(allDerived, team, range, teamMode === "semaine" ? "day" : "week");
  const capacity = loads[0]?.capacity ?? 0;

  const periodLabel =
    teamMode === "semaine"
      ? `${toDate(weekRange(teamAnchor).start).getDate()} – ${toDate(weekRange(teamAnchor).end).getDate()} ${MONTHS_FULL[toDate(weekRange(teamAnchor).end).getMonth()]}`
      : `${MONS_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`;

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(m: TeamMember) {
    setEditing(m);
    setModalOpen(true);
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <button onClick={teamPrev} style={navBtn} aria-label="Précédent">‹</button>
        <h2 style={{ margin: 0, fontFamily: FONT_NUM, fontSize: 18, fontWeight: 600, minWidth: 150 }}>{periodLabel}</h2>
        <button onClick={teamNext} style={navBtn} aria-label="Suivant">›</button>
        <div style={{ display: "flex", gap: 2, background: "#EAEEE7", borderRadius: 4, padding: 3 }}>
          {(["semaine", "mois"] as TeamMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setTeamMode(m)}
              style={{ border: "none", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 3, background: teamMode === m ? "#fff" : "transparent", color: teamMode === m ? "#17823D" : "#6F6F6F" }}
            >
              {m === "semaine" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
        <button
          onClick={openAdd}
          style={{ marginLeft: "auto", border: "none", cursor: "pointer", background: "#17823D", color: "#fff", font: "inherit", fontWeight: 600, fontSize: 13, padding: "8px 13px", borderRadius: 3, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontSize: 16, lineHeight: 0 }}>+</span>Membre
        </button>
      </div>

      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6F6F6F" }}>
        Charge = jours planifiés ÷ <strong>{capacity} jours ouvrés</strong> de la période. La frise montre la charge {teamMode === "semaine" ? "par jour" : "semaine par semaine"} — pour repérer <em>quand</em> tombe la surcharge.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {loads.map((t) => {
          const c = chargeColor(t.chargePct);
          return (
            <div key={t.member.id} style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Avatar initials={t.member.initials} color={t.member.color} size={42} fontSize={14} title={`${t.member.name} · ${t.member.role}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.member.name}</div>
                  <div style={{ fontSize: 11.5, color: "#6F6F6F" }}>{t.member.role}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => openEdit(t.member)} title="Modifier" style={{ border: "1px solid #E2E6E0", background: "#fff", cursor: "pointer", borderRadius: 3, width: 26, height: 26, fontSize: 12, color: "#6F6F6F" }}>✎</button>
                  <button onClick={() => deleteTeamMember(t.member.id)} title="Supprimer" style={{ border: "1px solid #E2E6E0", background: "#fff", cursor: "pointer", borderRadius: 3, width: 26, height: 26, fontSize: 14, color: "#B4532E", lineHeight: 1 }}>×</button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: FONT_NUM, fontSize: 26, fontWeight: 600, lineHeight: 1, color: c }}>{t.chargePct}%</span>
                  <span style={{ fontSize: 11.5, color: "#6F6F6F" }}>{t.periodDays} j / {t.capacity} j</span>
                </div>
                <span style={{ fontSize: 11, color: "#6F6F6F" }}>{t.projectsActive} projet{t.projectsActive > 1 ? "s" : ""}</span>
              </div>

              <Heatmap buckets={t.buckets} mode={teamMode} />

              {t.tasks.length === 0 ? (
                <div style={{ fontSize: 11.5, color: "#9AA39B", marginTop: 12 }}>Aucune tâche planifiée sur la période.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 12 }}>
                  {t.tasks.map((task, i) => (
                    <div
                      key={i}
                      onClick={() => openProject(task.projectId)}
                      className="row-hover"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", fontSize: 11.5, padding: "1px 2px", borderRadius: 2 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: task.done ? "#9AA39B" : "#233038" }}>{task.taskName}</span>
                        <span style={{ color: "#9AA39B" }}> · {task.projectName}</span>
                      </div>
                      <span style={{ fontFamily: FONT_NUM, fontWeight: 600, color: "#3B5560", whiteSpace: "nowrap" }}>{task.daysInPeriod} j</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        const txt = b.pct === 0 ? "#9AA39B" : b.pct >= 50 ? "#fff" : "#3B5560";
        return (
          <div key={i} style={{ flex: 1, minWidth: 0 }} title={`${mode === "semaine" ? "" : "Semaine du "}${b.label} · ${b.days}/${b.capacity} j · ${b.pct}%`}>
            <div style={{ height: 30, borderRadius: 2, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: FONT_NUM, fontSize: 10.5, fontWeight: 600, color: txt }}>{b.pct > 0 ? `${b.pct}%` : ""}</span>
            </div>
            <div style={{ fontSize: 9, color: "#9AA39B", textAlign: "center", marginTop: 3 }}>{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}
