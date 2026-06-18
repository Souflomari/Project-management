"use client";

import { useState } from "react";

import { useProjects } from "@/lib/store/projects-context";
import type { TeamMember } from "@/lib/types";

const PALETTE = ["#17823D", "#3A9095", "#4C8AA3", "#E1832F", "#A42421", "#3B7179", "#9C7257", "#1D4459", "#6A6557", "#8A6FB0"];

const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "#6F6F6F",
  margin: "0 0 6px",
};
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E2E6E0",
  borderRadius: 3,
  padding: "9px 11px",
  font: "inherit",
  fontSize: 13.5,
  outline: "none",
  marginBottom: 14,
};

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
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(13,18,28,.42)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .16s ease", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 400, maxWidth: "100%", background: "#fff", borderRadius: 4, padding: "22px 24px 20px", color: "#233038", animation: "popIn .2s cubic-bezier(.2,.7,.2,1)", border: "1px solid #C7CFC4" }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>{editing ? "Modifier le membre" : "Nouveau membre"}</h2>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: color, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {finalInitials}
          </div>
          <div style={{ fontSize: 12, color: "#6F6F6F" }}>Aperçu de l&apos;avatar</div>
        </div>

        <label style={label}>Nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. J. Martin" style={input} />

        <label style={label}>Rôle</label>
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="ex. Ingénieur structures" style={input} />

        <label style={label}>Initiales</label>
        <input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder={initialsFrom(name)} style={{ ...input, width: 90 }} />

        <label style={label}>Couleur</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 22 }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "2px solid #233038" : "2px solid transparent" }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ border: "1px solid #E2E6E0", background: "#fff", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "#6F6F6F", padding: "10px 16px", borderRadius: 3 }}>
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{ border: "none", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "#17823D", padding: "10px 18px", borderRadius: 3, opacity: canSubmit ? 1 : 0.5, pointerEvents: canSubmit ? "auto" : "none" }}
          >
            {editing ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
