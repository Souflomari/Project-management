"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input, Modal } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { C, TX } from "@/lib/tokens";

const label: React.CSSProperties = { ...TX.eyebrow, color: C.ink500, display: "block", margin: "0 0 6px" };

export function AddProjectModal() {
  const router = useRouter();
  const { showAdd, closeAdd, newName, newClient, newResp, setNewName, setNewClient, setNewResp, submitAdd, team } =
    useProjects();
  const [busy, setBusy] = useState(false);

  if (!showAdd) return null;
  const canSubmit = newName.trim().length > 0 && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const created = await submitAdd();
      if (created) router.push("/projets");
    } finally {
      setBusy(false);
    }
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <Modal
      title="Nouveau projet"
      subtitle="Ajoutez un projet au portefeuille de pilotage."
      width={440}
      onClose={closeAdd}
      footer={
        <>
          <Button variant="secondary" onClick={closeAdd} disabled={busy}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>{busy ? "Création…" : "Créer le projet"}</Button>
        </>
      }
    >
      <label style={label}>Intitulé du projet</label>
      <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={onEnter} placeholder="ex. Viaduc de la Loire — Lot 2" style={{ marginBottom: 14 }} />

      <label style={label}>Maître d&apos;ouvrage</label>
      <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} onKeyDown={onEnter} placeholder="ex. Département du Rhône" style={{ marginBottom: 14 }} />

      <label style={{ ...label, marginBottom: 8 }}>Responsable</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {team.map((m) => {
          const active = m.id === newResp;
          return (
            <button
              key={m.id}
              onClick={() => setNewResp(m.id)}
              className="btn"
              style={{
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 10px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
                ...(active
                  ? { background: C.brand50, border: `1px solid ${C.brand}`, color: C.brand }
                  : { background: C.surface, border: `1px solid ${C.line}`, color: C.ink500 }),
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color }} />
              {m.name}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
