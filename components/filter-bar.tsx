"use client";

import { type ReactNode } from "react";

import { CloseIcon } from "./icons";
import { Button, Select } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, TX } from "@/lib/tokens";
import { PHASES } from "@/lib/types";

export function FilterBar({ trailing, showViews }: { trailing?: ReactNode; showViews?: boolean }) {
  const {
    filters, setFilter, filter,
    team, respFilter, setRespFilter, phaseFilter, setPhaseFilter, resetFilters,
    savedViews, saveView, applyView, deleteView,
  } = useProjects();

  const hasFacets = filter !== "all" || respFilter != null || phaseFilter != null;

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      {filters.map((f) => {
        const a = f.active;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="btn"
            style={{
              cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: R.sm,
              display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              border: `1px solid ${a ? C.solid : C.line}`, background: a ? C.solid : C.surface, color: a ? "#fff" : C.ink700,
              transition: "background .12s, border-color .12s",
            }}
          >
            {f.label}
            <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "1px 6px", borderRadius: R.xs, background: a ? "rgba(255,255,255,.20)" : C.subtle, color: a ? "#fff" : C.ink500 }}>
              {f.count}
            </span>
          </button>
        );
      })}

      <div style={{ width: 1, height: 22, background: C.line, margin: "0 2px" }} />

      <Select size="sm" aria-label="Filtrer par responsable" value={respFilter ?? ""} onChange={(e) => setRespFilter(e.target.value ? Number(e.target.value) : null)} style={{ width: 150 }}>
        <option value="">Responsable</option>
        {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
      </Select>
      <Select size="sm" aria-label="Filtrer par phase" value={phaseFilter ?? ""} onChange={(e) => setPhaseFilter(e.target.value ? Number(e.target.value) : null)} style={{ width: 120 }}>
        <option value="">Phase</option>
        {PHASES.map((ph, i) => (<option key={ph} value={i}>{ph}</option>))}
      </Select>

      {hasFacets ? (
        <button onClick={resetFilters} className="soft-hover" style={{ display: "inline-flex", alignItems: "center", gap: 4, ...TX.caption, color: C.ink500, background: "none", border: "none", borderRadius: R.xs, padding: "4px 6px", cursor: "pointer" }}>
          <CloseIcon size={12} /> Réinitialiser
        </button>
      ) : null}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        {trailing}
        {showViews ? (
          <>
            {savedViews.length > 0 ? (
              <Select
                size="sm"
                aria-label="Vues enregistrées"
                value=""
                onChange={(e) => { const v = savedViews.find((x) => x.id === e.target.value); if (v) applyView(v); }}
                style={{ width: 150 }}
              >
                <option value="">Vues enregistrées</option>
                {savedViews.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
              </Select>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => { const n = window.prompt("Nom de la vue ?"); if (n && n.trim()) saveView(n.trim()); }}>
              Enregistrer la vue
            </Button>
            {savedViews.length > 0 ? (
              <button
                onClick={() => { if (savedViews.length && window.confirm("Supprimer toutes les vues enregistrées ?")) savedViews.forEach((v) => deleteView(v.id)); }}
                title="Supprimer les vues"
                className="soft-hover"
                style={{ ...TX.caption, color: C.ink400, background: "none", border: "none", borderRadius: R.xs, padding: "4px 6px", cursor: "pointer" }}
              >
                Effacer
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
