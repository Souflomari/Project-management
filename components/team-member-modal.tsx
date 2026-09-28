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
  const [touched, setTouched] = useState(false);
  // NB: no "Capacité (ETP)" field — TeamMember has no fte/capacity attribute, so
  // the value was never persisted (and "0" silently became 1). Re-add it once
  // the data model carries a capacity.

  // Once the user types in the Initiales field, stop auto-deriving from the name.
  const [initialsTouched, setInitialsTouched] = useState(
    member !== null && (member.initials ?? "") !== "" && member.initials !== initialsFrom(member.name),
  );

  const derivedInitials = initialsTouched ? initials.trim() : initialsFrom(name);
  const finalInitials = derivedInitials.toUpperCase();

  // ── validation (live; shown once the user has typed or tried to submit) ──
  const trimmedName = name.trim();
  const nameErr = !trimmedName
    ? "Le nom est requis."
    : trimmedName.length > 80
      ? "80 caractères maximum."
      : undefined;
  const initialsErr = !/^[\p{L}\p{N}]{1,3}$/u.test(finalInitials)
    ? "1 à 3 lettres ou chiffres."
    : undefined;
  const colorErr = !(PALETTE as readonly string[]).includes(color) ? "Choisissez une couleur de la palette." : undefined;
  const costRaw = costPerDay.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const costNum = costRaw === "" ? undefined : Number(costRaw);
  const costErr = costNum !== undefined && (!Number.isFinite(costNum) || costNum < 0 || costNum > 100_000 || !/^\d+([.]\d+)?$/.test(costRaw))
    ? "Montant invalide (0 à 100 000 €/j)."
    : undefined;
  const valid = !nameErr && !initialsErr && !colorErr && !costErr;

  // Warn when the chosen colour is already used by another member (own colour ok).
  const colorCollision = colorsInUse.some((c) => c === color && c !== member?.color);

  function submit() {
    setTouched(true);
    if (!valid) return;
    const payload = {
      name: trimmedName,
      role: role.trim() || "Membre",
      initials: finalInitials,
      color,
      ...(costNum !== undefined ? { costPerDay: Math.round(costNum) } : {}),
    };
    if (editing) updateTeamMember(member!.id, payload);
    else addTeamMember(payload);
    onClose();
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  };
  const show = (err: string | undefined) => (touched ? err : undefined);

  return (
    <Modal
      title={editing ? "Modifier le membre" : "Nouveau membre"}
      width={440}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={touched && !valid}>{editing ? "Enregistrer" : "Ajouter"}</Button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: color, color: C.surface, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: `background ${DUR.base} ${EASE.standard}` }}>
          {finalInitials}
        </div>
        <div style={{ ...TX.caption, color: C.ink500 }}>Aperçu de l’avatar</div>
      </div>

      {/* ── Identité ── */}
      <div style={sectionHd}>Identité</div>

      <Field label="Nom" required error={show(nameErr)} style={{ marginBottom: 14 }}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} aria-required autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="ex. J. Martin" />
        )}
      </Field>

      <Field label="Rôle / discipline" hint="Sert au regroupement de l’équipe." style={{ marginBottom: 14 }}>
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={onEnter} placeholder="ex. Ingénieur structures" />
        )}
      </Field>

      <Field label="Initiales" hint="1 à 3 caractères — déduites du nom par défaut." error={show(initialsErr)} style={{ marginBottom: 14 }}>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            aria-describedby={describedBy}
            maxLength={3}
            value={initialsTouched ? initials : finalInitials}
            onChange={(e) => { setInitialsTouched(true); setInitials(e.target.value); }}
            onKeyDown={onEnter}
            placeholder={initialsFrom(name)}
            style={{ width: 90 }}
          />
        )}
      </Field>

      <Field label="Couleur" error={show(colorErr) ?? (colorCollision ? "Cette couleur est déjà utilisée par un autre membre." : undefined)}>
        {({ id, describedBy }) => (
          <div id={id} role="radiogroup" aria-label="Couleur de l’avatar" aria-describedby={describedBy} style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {PALETTE.map((c, i) => {
              const taken = colorsInUse.some((u) => u === c && c !== member?.color);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="btn"
                  role="radio"
                  aria-checked={color === c}
                  tabIndex={color === c || (!PALETTE.includes(color as (typeof PALETTE)[number]) && i === 0) ? 0 : -1}
                  onKeyDown={(e) => {
                    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                    if (!d) return;
                    e.preventDefault();
                    const next = (i + d + PALETTE.length) % PALETTE.length;
                    setColor(PALETTE[next]);
                    ((e.currentTarget.parentElement?.children[next]) as HTMLElement | undefined)?.focus();
                  }}
                  aria-label={`Couleur ${i + 1}${taken ? " (déjà utilisée)" : ""}`}
                  style={{
                    width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                    border: "2px solid transparent",
                    boxShadow: color === c ? `0 0 0 2px ${C.surface}, 0 0 0 4px ${C.brand}` : "none",
                    transition: `box-shadow ${DUR.fast} ${EASE.standard}, transform ${DUR.fast} ${EASE.standard}`,
                    position: "relative",
                  }}
                >
                  {taken ? <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.surface, fontSize: 12, fontWeight: 600 }}>•</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {/* ── Coût ── */}
      <div style={sectionHd}>Coût</div>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Taux journalier (€/j)" hint="Pilote le budget et la valeur acquise." error={show(costErr)} style={{ flex: 1 }}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              aria-describedby={describedBy}
              inputMode="decimal"
              value={costPerDay}
              onChange={(e) => setCostPerDay(e.target.value)}
              onKeyDown={onEnter}
              placeholder="ex. 750"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
