"use client";

import { useState } from "react";

import { Button, Input, Modal } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { C, TX } from "@/lib/tokens";
import type { TeamMember } from "@/lib/types";

const PALETTE = ["#17823D", "#3A9095", "#4C8AA3", "#E1832F", "#A42421", "#3B7179", "#9C7257", "#1D4459", "#6A6557", "#8A6FB0"];

const label: React.CSSProperties = { ...TX.overline, color: C.ink500, display: "block", margin: "0 0 6px" };

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamMemberModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { addTeamMember, updateTeamMember } = useProjects();
  const editing = member !== null;
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [initials, setInitials] = useState(member?.initials ?? "");
  const [color, setColor] = useState(member?.color ?? PALETTE[0]);

  const finalInitials = (initials.trim() || initialsFrom(name)).slice(0, 3);
  const canSubmit = name.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    const payload = { name: name.trim(), role: role.trim() || "Membre", initials: finalInitials, color };
    if (editing) updateTeamMember(member!.id, payload);
    else addTeamMember(payload);
    onClose();
  }

  return (
    <Modal
      title={editing ? "Modifier le membre" : "Nouveau membre"}
      width={420}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!canSubmit}>{editing ? "Enregistrer" : "Ajouter"}</Button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: color, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {finalInitials}
        </div>
        <div style={{ ...TX.caption, color: C.ink500 }}>Aperçu de l&apos;avatar</div>
      </div>

      <label style={label}>Nom</label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. J. Martin" style={{ marginBottom: 14 }} />

      <label style={label}>Rôle</label>
      <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="ex. Ingénieur structures" style={{ marginBottom: 14 }} />

      <label style={label}>Initiales</label>
      <Input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder={initialsFrom(name)} style={{ width: 90, marginBottom: 14 }} />

      <label style={label}>Couleur</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="btn"
            style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "2px solid #1A2329" : "2px solid transparent" }}
          />
        ))}
      </div>
    </Modal>
  );
}
