"use client";

import { Avatar } from "../ui";
import { buildTeamLoad } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

export function Team() {
  const { allDerived, team, openProject } = useProjects();
  const loads = buildTeamLoad(allDerived, team);

  return (
    <>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6F6F6F" }}>
        Charge par responsable — projets actifs, honoraires pilotés et avancement.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {loads.map((t) => (
          <div key={t.member.id} style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 4, padding: "13px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Avatar initials={t.member.initials} color={t.member.color} size={42} fontSize={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.member.name}</div>
                <div style={{ fontSize: 11.5, color: "#6F6F6F" }}>{t.member.role}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT_NUM, fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{t.active}</div>
                <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#9AA39B" }}>projets</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: "#6F6F6F", marginBottom: 6 }}>
              <span>Charge</span>
              <span style={{ fontFamily: FONT_NUM, fontWeight: 500, color: "#3B5560", whiteSpace: "nowrap" }}>
                {t.budgetFmt} pilotés
              </span>
            </div>
            <div style={{ height: 3, background: "#E4E8E2", borderRadius: 999, overflow: "hidden", marginBottom: 11 }}>
              <div style={{ height: "100%", borderRadius: 999, width: `${t.loadPct}%`, background: t.member.color }} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {t.projects.map((pr) => (
                <span
                  key={pr.id}
                  onClick={() => openProject(pr.id)}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 3,
                    background: "#F1F3EF",
                    border: "1px solid #E2E6E0",
                    color: "#3B5560",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pr.short}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
