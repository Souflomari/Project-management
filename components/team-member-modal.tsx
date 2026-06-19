"use client";

import { useState } from "react";

import { Button, Field, Input, Modal } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { AVATAR_PALETTE, C, DUR, EASE, TX } from "@/lib/tokens";
import type { TeamMember } from "@/lib/types";

const PALETTE = AVATAR_PALETTE;

// Section heading inside the modal — quiet sentence-case overline grouping.
const sectionHd: React.CSSProperties = { ...TX.eyebrow, color: C.ink500, margin: "20px 0 12px" };

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamMemberModal({
  member,
  colorsInUse = [],
  onClose,
}: {
  member: TeamMember | null;
  /** Colours already taken by other members — used to warn on collision. */
  colorsInUse?: readonly string[];
  onClose: () => void;
}) {
  const { addTeamMember, updateTeamMember } = useProjects();
  const editing = member !== null;
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [initials, setInitials] = useState(member?.initials ?? "");
  const [color, setColor] = useState(member?.color ?? PALETTE[0]);
  const [costPerDay, setCostPerDay] = useState(member?.costPerDay != null ? String(member.costPerDay) : "");
  // Capacity as a full-time-equivalent factor (1 = full time). The workload model
  // can scale a member's capacity by this. // TODO(derive): persist `fte` once the
  // data model / repository carry it (currently UI-only, sent best-effort below).
  const [fte, setFte] = useState(memberFte(member));

  // Once the user types in the Initiales field, stop auto-deriving from the name.
  const [initialsTouched, setInitialsTouched] = useState(
    member !== null && (member.initials ?? "") !== "" && member.initials !== initialsFrom(member.name),
  );

  const derivedInitials = initialsTouched && initials.trim() ? initials.trim() : initialsFrom(name);
  const finalInitials = derivedInitials.slice(0, 3);
  const canSubmit = name.trim().length > 0;

  // Warn when the chosen colour is already used by another member (own colour ok).
  const colorCollision = colorsInUse.some((c) => c === color && c !== member?.color);

  function submit() {
    if (!canSubmit) return;
    const cost = costPerDay.trim() === "" ? undefined : Math.max(0, Math.round(Number(costPerDay) || 0));
    const fteNum = Math.max(0.1, Math.min(2, Number(fte) || 1));
    const payload = {
      name: name.trim(),
      role: role.trim() || "Membre",
      initials: finalInitials,
      color,
      ...(cost != null ? { costPerDay: cost } : {}),
      // best-effort; repository ignores unknown keys until `fte` is modelled.
      ...(fteNum !== 1 ? ({ fte: fteNum } as Record<string, number>) : {}),
    };
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
      width={440}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!canSubmit}>{editing ? "Enregistrer" : "Ajouter"}</Button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: color, color: C.surface, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: `background ${DUR.base} ${EASE.standard}` }}>
          {finalInitials}
        </div>
        <div style={{ ...TX.caption, color: C.ink500 }}>Aperçu de l’avatar</div>
      </div>

      {/* ── Identité ── */}
      <div style={sectionHd}>Identité</div>

      <Field label="Nom" required style={{ marginBottom: 14 }}>
        {({ id }) => (
          <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="ex. J. Martin" />
        )}
      </Field>

      <Field label="Rôle / discipline" hint="Sert au regroupement de l’équipe." style={{ marginBottom: 14 }}>
        {({ id }) => (
          <Input id={id} value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={onEnter} placeholder="ex. Ingénieur structures" />
        )}
      </Field>

      <Field label="Initiales" style={{ marginBottom: 14 }}>
        {({ id }) => (
          <Input
            id={id}
            value={initialsTouched ? initials : finalInitials}
            onChange={(e) => { setInitialsTouched(true); setInitials(e.target.value); }}
            placeholder={initialsFrom(name)}
            style={{ width: 90 }}
          />
        )}
      </Field>

      <Field label="Couleur" error={colorCollision ? "Cette couleur est déjà utilisée par un autre membre." : undefined}>
        {({ id }) => (
          <div id={id} role="radiogroup" aria-label="Couleur de l’avatar" style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {PALETTE.map((c) => {
              const taken = colorsInUse.some((u) => u === c && c !== member?.color);
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="btn"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={taken ? "Couleur déjà utilisée" : "Couleur"}
                  style={{
                    width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                    border: "2px solid transparent",
                    boxShadow: color === c ? `0 0 0 2px ${C.surface}, 0 0 0 4px ${C.brand}` : "none",
                    transition: `box-shadow ${DUR.fast} ${EASE.standard}, transform ${DUR.fast} ${EASE.standard}`,
                    position: "relative",
                  }}
                >
                  {taken ? <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.surface, fontSize: 11, fontWeight: 700 }}>•</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {/* ── Capacité & coût ── */}
      <div style={sectionHd}>Capacité &amp; coût</div>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Taux journalier (€/j)" hint="Pilote le budget et la valeur acquise." style={{ flex: 1 }}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={0}
              step={10}
              value={costPerDay}
              onChange={(e) => setCostPerDay(e.target.value)}
              onKeyDown={onEnter}
              placeholder="ex. 750"
            />
          )}
        </Field>

        <Field label="Capacité (ETP)" hint="1 = temps plein." style={{ width: 120 }}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min={0.1}
              max={2}
              step={0.1}
              value={fte}
              onChange={(e) => setFte(e.target.value)}
              onKeyDown={onEnter}
              placeholder="1"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

/** Read an optional FTE off the member if the model has begun carrying it,
 *  defaulting to full time. // TODO(derive): replace once `fte` is in the type. */
function memberFte(member: TeamMember | null): string {
  const f = (member as (TeamMember & { fte?: number }) | null)?.fte;
  return f != null ? String(f) : "1";
}
