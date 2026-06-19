"use client";

import { useState } from "react";

import { Button, Input, Modal } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { AVATAR_PALETTE, C, DUR, EASE, TX } from "@/lib/tokens";
import type { TeamMember } from "@/lib/types";

const PALETTE = AVATAR_PALETTE;

// Form field labels read as quiet sentence-case overlines, not robotic uppercase.
const label: React.CSSProperties = { ...TX.overline, color: C.ink600, display: "block", margin: "0 0 6px" };

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
  // Once the user types in the Initiales field, stop auto-deriving from the name.
  // Editing a member whose stored initials differ from what the name derives is
  // treated as a pre-existing override so we don't clobber it on first render.
  const [initialsTouched, setInitialsTouched] = useState(
    member !== null && (member.initials ?? "") !== "" && member.initials !== initialsFrom(member.name),
  );

  // The derived value follows the name live, unless the user has overridden it.
  const derivedInitials = initialsTouched && initials.trim() ? initials.trim() : initialsFrom(name);
  const finalInitials = derivedInitials.slice(0, 3);
  const canSubmit = name.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    const payload = { name: name.trim(), role: role.trim() || "Membre", initials: finalInitials, color };
    if (editing) updateTeamMember(member!.id, payload);
    else addTeamMember(payload);
    onClose();
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) { e.preventDefault(); submit(); }
  };

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
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: color, color: C.surface, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: `background ${DUR.base} ${EASE.standard}` }}>
          {finalInitials}
        </div>
        <div style={{ ...TX.caption, color: C.ink500 }}>Aperçu de l’avatar</div>
      </div>

      <label style={label}>Nom</label>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="ex. J. Martin" style={{ marginBottom: 14 }} />

      <label style={label}>Rôle</label>
      <Input value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={onEnter} placeholder="ex. Ingénieur structures" style={{ marginBottom: 14 }} />

      <label style={label}>Initiales</label>
      <Input
        value={initialsTouched ? initials : finalInitials}
        onChange={(e) => { setInitialsTouched(true); setInitials(e.target.value); }}
        placeholder={initialsFrom(name)}
        style={{ width: 90, marginBottom: 14 }}
      />

      <label style={label}>Couleur</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="btn"
            aria-label={`Couleur ${c}`}
            aria-pressed={color === c}
            style={{
              width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
              // Selected swatch gets a green identity ring, offset from the swatch
              // by a white gap so it reads on every palette colour.
              border: "2px solid transparent",
              boxShadow: color === c ? `0 0 0 2px ${C.surface}, 0 0 0 4px ${C.brand}` : "none",
              transition: `box-shadow ${DUR.fast} ${EASE.standard}, transform ${DUR.fast} ${EASE.standard}`,
            }}
          />
        ))}
      </div>
    </Modal>
  );
}
