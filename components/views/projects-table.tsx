"use client";

import { useState } from "react";

import { FilterBar } from "../filter-bar";
import { CaretDownIcon, CheckIcon } from "../icons";
import { Avatar, Button, PhaseBadge, ProgressBar, rowProps, Select, StatusPill } from "../ui";
import type { DerivedProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, SH, TX } from "@/lib/tokens";
import { STATUSES, type Status } from "@/lib/types";

const COLS = "34px 2.4fr 64px 1.4fr 1.2fr .9fr 46px 116px";

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

function Check({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 18, height: 18, borderRadius: R.xs, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, cursor: "pointer", padding: 0, color: "#fff",
        ...(checked ? { background: C.solid, border: `1px solid ${C.solid}` } : { background: C.surface, border: `1.5px solid ${C.lineStrong}` }),
      }}
    >
      {checked ? <CheckIcon size={12} /> : null}
    </button>
  );
}

export function ProjectsTable() {
  const { filtered, searched, team, openProject, openAdd, bulkSetStatus, bulkAdvancePhase, bulkSetResponsable, tableSort, setTableSort } = useProjects();
  const [sel, setSel] = useState<Set<number>>(new Set());

  const sort = tableSort;
  const rows = sort ? [...filtered].sort((a, b) => compare(a, b, sort.key as SortKey) * sort.dir) : filtered;
  const toggleSort = (key: SortKey) =>
    setTableSort(sort && sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 });

  const selectedIds = rows.filter((r) => sel.has(r.id)).map((r) => r.id);
  const allOn = rows.length > 0 && selectedIds.length === rows.length;
  const toggleOne = (id: number) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)));
  const clearSel = () => setSel(new Set());

  return (
    <>
      <FilterBar showViews />

      {selectedIds.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px 9px 16px", marginBottom: 12, background: C.ink900, color: "#fff", borderRadius: R.md, boxShadow: SH.md, flexWrap: "wrap" }}>
          <span style={{ ...TX.bodyStrong, color: "#fff" }}>{selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}</span>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,.16)" }} />
          <Select size="sm" value="" aria-label="Changer le statut" onChange={(e) => { if (e.target.value) { bulkSetStatus(selectedIds, e.target.value as Status); clearSel(); } }} style={{ width: 150 }}>
            <option value="">Changer le statut…</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
          <Select size="sm" value="" aria-label="Réassigner" onChange={(e) => { if (e.target.value) { bulkSetResponsable(selectedIds, Number(e.target.value)); clearSel(); } }} style={{ width: 160 }}>
            <option value="">Réassigner à…</option>
            {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => { bulkAdvancePhase(selectedIds); clearSel(); }}>Avancer la phase</Button>
          <button onClick={clearSel} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 540, cursor: "pointer", padding: "4px 6px" }}>Désélectionner</button>
        </div>
      ) : null}

      <div className="table-scroll">
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, overflow: "hidden", minWidth: 760 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            padding: "11px 18px",
            borderBottom: `1px solid ${C.line}`,
            ...TX.overline,
            color: C.ink400,
            alignItems: "center",
          }}
        >
          <Check checked={allOn} onToggle={toggleAll} label="Tout sélectionner" />
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

        {rows.map((p) => {
          const on = sel.has(p.id);
          return (
            <div
              key={p.id}
              {...rowProps(() => openProject(p.id))}
              className="row-hover row-focus"
              style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", minHeight: 58, padding: "10px 18px", borderTop: `1px solid ${C.line}`, cursor: "pointer", background: on ? C.brand50 : undefined }}
            >
              <Check checked={on} onToggle={() => toggleOne(p.id)} label={`Sélectionner ${p.name}`} />

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
          );
        })}
        {rows.length === 0 ? (
          <div style={{ padding: "40px 18px", textAlign: "center", borderTop: `1px solid ${C.line}` }}>
            <div style={{ ...TX.caption, color: C.ink500 }}>{searched.length === 0 ? "Aucun projet pour l’instant." : "Aucun projet ne correspond à ce filtre."}</div>
            <div style={{ marginTop: 12 }}>
              <Button variant="secondary" onClick={openAdd} style={{ margin: "0 auto" }}>Nouveau projet</Button>
            </div>
          </div>
        ) : null}
      </div>
      </div>
    </>
  );
}
