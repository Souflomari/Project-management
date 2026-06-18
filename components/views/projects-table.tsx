"use client";

import { useState } from "react";

import { FilterBar } from "../filter-bar";
import { CaretDownIcon } from "../icons";
import { Avatar, PhaseBadge, ProgressBar, rowProps, StatusPill } from "../ui";
import type { DerivedProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, SH, TX } from "@/lib/tokens";
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
    case "name": return a.name.localeCompare(b.name);
    case "phase": return a.phaseIndex - b.phaseIndex;
    case "rendu": return (a.nextTask?.end ?? "9999").localeCompare(b.nextTask?.end ?? "9999");
    case "progress": return a.progress - b.progress;
    case "budget": return a.budget - b.budget;
    case "resp": return a.responsable.name.localeCompare(b.responsable.name);
    case "status": return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
  }
}

export function ProjectsTable() {
  const { filtered, openProject } = useProjects();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const rows = sort ? [...filtered].sort((a, b) => compare(a, b, sort.key) * sort.dir) : filtered;
  const toggleSort = (key: SortKey) =>
    setSort((cur) => (cur && cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <>
      <FilterBar />
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.md, overflow: "hidden", boxShadow: SH.sm }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            padding: "8px 16px",
            background: C.subtle,
            borderBottom: `1px solid ${C.line}`,
            ...TX.overline,
            color: C.ink500,
          }}
        >
          {HEADERS.map((h) => {
            const active = sort?.key === h.key;
            return (
              <div
                key={h.key}
                className="sortable"
                onClick={() => toggleSort(h.key)}
                style={{ display: "flex", alignItems: "center", gap: 3, color: active ? C.ink900 : C.ink500 }}
                title="Trier"
              >
                {h.label}
                <span style={{ display: "inline-flex", opacity: active ? 1 : 0, transform: active && sort!.dir === -1 ? "rotate(180deg)" : "none", transition: "transform .12s" }}>
                  <CaretDownIcon size={11} />
                </span>
              </div>
            );
          })}
        </div>

        {rows.map((p) => (
          <div
            key={p.id}
            {...rowProps(() => openProject(p.id))}
            className="row-hover row-focus"
            style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", padding: "8px 16px", borderTop: `1px solid ${C.line}`, cursor: "pointer" }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ ...TX.bodyStrong, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.client} · {p.discipline}</div>
            </div>

            <div><PhaseBadge label={p.phaseLabel} /></div>

            <div style={{ minWidth: 0 }}>
              <div style={{ ...TX.caption, fontWeight: 600, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.renduLabel}</div>
              <div style={{ ...TX.caption, color: C.ink500 }}>
                {p.renduFmt} · <span style={{ color: p.renduDueColor, fontWeight: 600 }}>{p.renduDaysLabel}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ProgressBar pct={p.progress} color={p.ring} />
              <span style={{ ...num(13), width: 34, textAlign: "right", color: C.ink700 }}>{p.progress}%</span>
            </div>

            <div style={{ ...num(14), fontWeight: 500, color: C.ink700 }}>{p.budgetFmt}</div>

            <div>
              <Avatar initials={p.responsable.initials} color={p.responsable.color} size={30} fontSize={11} title={`${p.responsable.name} · ${p.responsable.role}`} />
            </div>

            <div><StatusPill color={p.statusColor} label={p.statusLabel} /></div>
          </div>
        ))}
      </div>
    </>
  );
}
