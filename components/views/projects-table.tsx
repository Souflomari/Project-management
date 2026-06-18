"use client";

import { useState } from "react";

import { FilterBar } from "../filter-bar";
import { Avatar, PhaseBadge, ProgressBar, StatusPill } from "../ui";
import type { DerivedProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";
import { STATUSES } from "@/lib/types";

const COLS = "2.5fr .7fr 1.4fr 1.3fr .9fr 46px 1fr";

type SortKey = "name" | "phase" | "rendu" | "progress" | "budget" | "resp" | "status";

const HEADERS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Projet · maître d'ouvrage" },
  { key: "phase", label: "Phase" },
  { key: "rendu", label: "Prochain rendu" },
  { key: "progress", label: "Avancement" },
  { key: "budget", label: "Honoraires" },
  { key: "resp", label: "Resp." },
  { key: "status", label: "Statut" },
];

function compare(a: DerivedProject, b: DerivedProject, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "phase":
      return a.phaseIndex - b.phaseIndex;
    case "rendu":
      return (a.nextTask?.end ?? "9999").localeCompare(b.nextTask?.end ?? "9999");
    case "progress":
      return a.progress - b.progress;
    case "budget":
      return a.budget - b.budget;
    case "resp":
      return a.responsable.name.localeCompare(b.responsable.name);
    case "status":
      return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
  }
}

export function ProjectsTable() {
  const { filtered, openProject } = useProjects();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const rows = sort
    ? [...filtered].sort((a, b) => compare(a, b, sort.key) * sort.dir)
    : filtered;

  function toggleSort(key: SortKey) {
    setSort((cur) => (cur && cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  return (
    <>
      <FilterBar />
      <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            padding: "7px 13px",
            background: "#F6F8F4",
            borderBottom: "1px solid #E2E6E0",
            fontSize: 10,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: "#6F6F6F",
            fontWeight: 700,
          }}
        >
          {HEADERS.map((h) => {
            const active = sort?.key === h.key;
            return (
              <div
                key={h.key}
                className="sortable"
                onClick={() => toggleSort(h.key)}
                style={{ display: "flex", alignItems: "center", gap: 3, color: active ? "#233038" : "#6F6F6F" }}
                title="Trier"
              >
                {h.label}
                <span style={{ fontSize: 8, opacity: active ? 1 : 0.35 }}>{active ? (sort!.dir === 1 ? "▲" : "▼") : "▲"}</span>
              </div>
            );
          })}
        </div>

        {rows.map((p) => (
          <div
            key={p.id}
            onClick={() => openProject(p.id)}
            className="row-hover"
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 12,
              alignItems: "center",
              padding: "5px 13px",
              borderTop: "1px solid #EEF1EC",
              cursor: "pointer",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1B2A24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.client} · {p.discipline}
              </div>
            </div>

            <div>
              <PhaseBadge label={p.phaseLabel} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.renduLabel}</div>
              <div style={{ fontSize: 10.5, color: "#6F6F6F" }}>
                {p.renduFmt} · <span style={{ color: p.renduDueColor, fontWeight: 600 }}>{p.renduDaysLabel}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ProgressBar pct={p.progress} color={p.ring} />
              <span style={{ fontFamily: FONT_NUM, fontSize: 12, fontWeight: 600, width: 32, textAlign: "right" }}>{p.progress}%</span>
            </div>

            <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: 500, color: "#3B5560" }}>{p.budgetFmt}</div>

            <div>
              <Avatar
                initials={p.responsable.initials}
                color={p.responsable.color}
                size={30}
                fontSize={10.5}
                title={`${p.responsable.name} · ${p.responsable.role}`}
              />
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
