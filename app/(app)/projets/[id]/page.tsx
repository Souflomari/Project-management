"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ProjectComments, ProjectIdentity, ProjectOverview, ProjectTasks } from "@/components/project-detail";
import { Chip, StatusPill } from "@/components/ui";
import { useProjects } from "@/lib/store/projects-context";
import { C, PHASE_COLORS, R, TX } from "@/lib/tokens";

const TABS = [
  { key: "apercu", label: "Vue d'ensemble" },
  { key: "taches", label: "Tâches & planning" },
  { key: "commentaires", label: "Commentaires" },
] as const;

export default function ProjectPage() {
  const params = useParams();
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const { allDerived } = useProjects();
  const p = allDerived.find((x) => x.id === id) ?? null;
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("apercu");

  const back = (
    <Link href="/projets" className="soft-hover" style={{ ...TX.caption, fontWeight: 600, color: C.ink500, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", margin: "0 0 14px -8px", borderRadius: R.sm }}>
      ← Projets
    </Link>
  );

  if (!p) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {back}
        <div style={{ ...TX.h2, color: C.ink900 }}>Projet introuvable</div>
        <p style={{ ...TX.body, color: C.ink500, marginTop: 6 }}>Ce projet n&apos;existe pas ou a été supprimé.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {back}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <Chip label={p.phaseLabel} color={PHASE_COLORS[p.phaseIndex] ?? C.ink500} tone="soft" title={p.phaseFull} />
        <StatusPill color={p.statusColor} bg={p.statusBg} label={p.statusLabel} filled />
      </div>

      <ProjectIdentity p={p} titleStyle={{ ...TX.display, color: C.ink900 }} />

      <div role="tablist" aria-label="Sections du projet" style={{ display: "flex", gap: 6, borderBottom: `1px solid ${C.line}`, marginTop: 22 }}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className="soft-hover"
              style={{
                ...TX.bodyStrong,
                fontSize: 13.5,
                color: active ? C.ink900 : C.ink500,
                background: "none",
                border: "none",
                borderBottom: `2px solid ${active ? C.solid : "transparent"}`,
                padding: "10px 8px",
                marginBottom: -1,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ paddingTop: 24, maxWidth: 660 }}>
        {tab === "apercu" ? <ProjectOverview p={p} /> : null}
        {tab === "taches" ? <ProjectTasks p={p} /> : null}
        {tab === "commentaires" ? <ProjectComments p={p} /> : null}
      </div>
    </div>
  );
}
