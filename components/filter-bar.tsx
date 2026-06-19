"use client";

import { useState, type ReactNode } from "react";

import { CloseIcon } from "./icons";
import { Button, Input, Modal, Select } from "./ui";
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

  // Replaces window.prompt/confirm with focus-trapped, styled, i18n-friendly modals.
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const submitSave = () => { const n = viewName.trim(); if (n) saveView(n); setSaveOpen(false); setViewName(""); };

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      {filters.map((f) => {
        const a = f.active;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`btn state-layer${a ? " state-on-light" : ""}`}
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
            <Button size="sm" variant="secondary" onClick={() => { setViewName(""); setSaveOpen(true); }}>
              Enregistrer la vue
            </Button>
            {savedViews.length > 0 ? (
              <button
                onClick={() => setConfirmClear(true)}
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

      {saveOpen ? (
        <Modal
          title="Enregistrer la vue"
          subtitle="Conserve les filtres, la recherche et le tri actuels."
          width={420}
          onClose={() => setSaveOpen(false)}
          footer={
            <>
              <Button size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>Annuler</Button>
              <Button size="sm" onClick={submitSave} disabled={!viewName.trim()}>Enregistrer</Button>
            </>
          }
        >
          <Input
            autoFocus
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitSave(); } }}
            placeholder="Nom de la vue"
            aria-label="Nom de la vue"
          />
        </Modal>
      ) : null}

      {confirmClear ? (
        <Modal
          title="Supprimer les vues enregistrées ?"
          subtitle="Cette action est irréversible."
          width={420}
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Annuler</Button>
              <Button size="sm" variant="danger" onClick={() => { savedViews.forEach((v) => deleteView(v.id)); setConfirmClear(false); }}>Supprimer</Button>
            </>
          }
        >
          <p style={{ ...TX.caption, color: C.ink600, margin: 0 }}>
            {savedViews.length} vue{savedViews.length > 1 ? "s" : ""} ser{savedViews.length > 1 ? "ont" : "a"} définitivement supprimée{savedViews.length > 1 ? "s" : ""}.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
