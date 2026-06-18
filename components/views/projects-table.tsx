"use client";

import { FilterBar } from "../filter-bar";
import { Avatar, PhaseBadge, ProgressBar, StatusPill } from "../ui";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

const COLS = "2.5fr .7fr 1.4fr 1.3fr .9fr 46px 1fr";

export function ProjectsTable() {
  const { filtered, openProject } = useProjects();

  return (
    <>
      <FilterBar />
      <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            padding: "6px 13px",
            background: "#F6F8F4",
            borderBottom: "1px solid #E2E6E0",
            fontSize: 10,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: "#6F6F6F",
            fontWeight: 700,
          }}
        >
          <div>Projet · maître d&apos;ouvrage</div>
          <div>Phase</div>
          <div>Prochain rendu</div>
          <div>Avancement</div>
          <div>Honoraires</div>
          <div>Resp.</div>
          <div>Statut</div>
        </div>

        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => openProject(p.id)}
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 12,
              alignItems: "center",
              padding: "6px 13px",
              borderTop: "1px solid #EEF1EC",
              cursor: "pointer",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div style={{ fontSize: 11.5, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.client} · {p.discipline}
              </div>
            </div>

            <div>
              <PhaseBadge label={p.phaseLabel} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.rendu.label}
              </div>
              <div style={{ fontSize: 10.5 }}>
                {p.renduFmt} · <span style={{ color: p.renduDueColor, fontWeight: 600 }}>{p.renduDaysLabel}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ProgressBar pct={p.progress} color={p.ring} />
              <span style={{ fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, width: 32, textAlign: "right" }}>
                {p.progress}%
              </span>
            </div>

            <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 500, color: "#3B5560" }}>{p.budgetFmt}</div>

            <div>
              <Avatar initials={p.responsable.initials} color={p.responsable.color} size={30} fontSize={10.5} />
            </div>

            <div>
              <StatusPill color={p.statusColor} label={p.statusLabel} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
