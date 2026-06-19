"use client";

import { useState } from "react";

import { FilterBar } from "../filter-bar";
import { CaretDownIcon } from "../icons";
import { Avatar, Button, PhaseBadge, ProgressBar, rowProps, StatusPill } from "../ui";
import type { DerivedProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, TX } from "@/lib/tokens";
import { STATUSES } from "@/lib/types";

const COLS = "2.4fr 64px 1.4fr 1.2fr .9fr 46px 116px";

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
  const { filtered, searched, openProject, openAdd } = useProjects();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const rows = sort ? [...filtered].sort((a, b) => compare(a, b, sort.key) * sort.dir) : filtered;
  const toggleSort = (key: SortKey) =>
    setSort((cur) => (cur && cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <>
      <FilterBar />
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            padding: "11px 18px",
            borderBottom: `1px solid ${C.line}`,
            ...TX.overline,
            color: C.ink400,
          }}
        >
          {HEADERS.map((h) => {
            const active = sort?.key === h.key;
            const right = h.key === "budget";
            return (
              <button
                key={h.key}
                className="sortable"
                onClick={() => toggleSort(h.key)}
                aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
                style={{ display: "flex", alignItems: "center", justifyContent: right ? "flex-end" : "flex-start", gap: 3, color: active ? C.ink700 : C.ink500, background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", ...TX.overline }}
              >
                {h.label}
                <span className="sort-caret" style={{ display: "inline-flex", opacity: active ? 1 : 0, transform: active && sort!.dir === -1 ? "rotate(180deg)" : "none", transition: "transform .12s, opacity .12s" }}>
                  <CaretDownIcon size={11} />
                </span>
              </button>
            );
          })}
        </div>

        {rows.map((p) => (
          <div
            key={p.id}
            {...rowProps(() => openProject(p.id))}
            className="row-hover row-focus"
            style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", minHeight: 58, padding: "10px 18px", borderTop: `1px solid ${C.line}`, cursor: "pointer" }}
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
              <span style={{ ...num(13), width: 38, textAlign: "right", color: C.ink700 }}>{p.progress}&#8239;%</span>
            </div>

            <div style={{ ...num(14), fontWeight: 500, color: C.ink700, textAlign: "right" }}>{p.budgetFmt}</div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <Avatar initials={p.responsable.initials} color={p.responsable.color} size={30} fontSize={11} title={`${p.responsable.name} · ${p.responsable.role}`} />
            </div>

            <div><StatusPill color={p.statusColor} bg={p.statusBg} label={p.statusLabel} filled /></div>
          </div>
        ))}
        {rows.length === 0 ? (
          <div style={{ padding: "40px 18px", textAlign: "center", borderTop: `1px solid ${C.line}` }}>
            <div style={{ ...TX.caption, color: C.ink500 }}>{searched.length === 0 ? "Aucun projet pour l’instant." : "Aucun projet ne correspond à ce filtre."}</div>
            <div style={{ marginTop: 12 }}>
              <Button variant="secondary" onClick={openAdd} style={{ margin: "0 auto" }}>Nouveau projet</Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
