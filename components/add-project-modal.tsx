"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, Field, Input, Modal, Select } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { REFERENCE_DATE } from "@/lib/format";
import { PHASES, PHASES_FULL } from "@/lib/types";
import { C, R, TX } from "@/lib/tokens";

const DISCIPLINES = [
  "Génie civil",
  "Ouvrages d’art",
  "Infrastructures",
  "Bâtiment",
  "Eau & environnement",
  "Énergie",
  "Mobilité & transport",
];

const labelStyle: React.CSSProperties = { ...TX.micro, color: C.ink700, fontWeight: 600, display: "block", margin: "0 0 6px" };

// A phase preset for the next opening ("Nouveau projet en APD" from a Kanban
// column). Kept here — not in the store — because only this form reads it.
let presetPhase: number | null = null;

/** Open the add-project form with the "Phase d'étude" pre-selected. */
export function openAddInPhase(openAdd: () => void, phaseIndex: number) {
  presetPhase = phaseIndex;
  openAdd();
}

/** Parse a French amount: "12,5", "1 200", "12.5" → number; "" → null. */
export function parseFrenchNumber(raw: string): number | null {
  const t = raw.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (t === "") return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function AddProjectModal() {
  const router = useRouter();
  const { showAdd, selectedId, closeDrawer, closeAdd } = useProjects();

  // After a successful create: close the form and any open drawer, then route
  // to the new project's page. The push waits until the drawer is really
  // closed (and is deferred one task): the store mirrors its selection to the
  // URL with history.replaceState in its own effect, which would otherwise
  // cancel the navigation.
  const [navTo, setNavTo] = useState<string | null>(null);
  useEffect(() => {
    if (!navTo || selectedId != null) return;
    const timer = window.setTimeout(() => { router.push(navTo); setNavTo(null); }, 0);
    return () => window.clearTimeout(timer);
  }, [navTo, selectedId, router]);

  // Mounted only while open: every opening starts from fresh field state.
  return showAdd ? (
    <AddProjectForm
      onCreated={(id) => {
        closeDrawer();
        closeAdd();
        setNavTo(`/projets/${id}`);
      }}
    />
  ) : null;
}

function AddProjectForm({ onCreated }: { onCreated: (id: number) => void }) {
  const {
    closeAdd,
    newName, newClient, newResp,
    setNewName, setNewClient, setNewResp,
    createProject, team, viewerMember,
  } = useProjects();

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState(DISCIPLINES[0]);
  const [budget, setBudget] = useState("");
  const [start, setStart] = useState(REFERENCE_DATE);
  const [deadline, setDeadline] = useState("");
  const [phaseIndex, setPhaseIndex] = useState(() => {
    const p = presetPhase ?? 0;
    presetPhase = null;
    return p;
  });
  const [touched, setTouched] = useState(false);

  // Pre-select the signed-in user as responsable (Supabase mode, when their
  // login is linked to a team member). Runs once per opening.
  const respDefaulted = useRef(false);
  useEffect(() => {
    if (respDefaulted.current || !viewerMember) return;
    respDefaulted.current = true;
    setNewResp(viewerMember.id);
  }, [viewerMember, setNewResp]);

  // Validation runs live (not just after a first submit): the error shows as
  // soon as the value is wrong and submit stays blocked until it is fixed.
  const nameErr = touched && !newName.trim() ? "L’intitulé est requis." : undefined;
  const budgetNum = parseFrenchNumber(budget);
  const budgetErr = budgetNum !== null && (!Number.isFinite(budgetNum) || budgetNum < 0)
    ? "Saisissez un montant valide en k€ (ex. 320 ou 12,5)."
    : undefined;
  const startErr = !start ? "La date de début est requise." : undefined;
  const dateErr = !startErr && deadline && deadline < start
    ? "L’échéance doit suivre la date de début."
    : undefined;

  const valid = newName.trim().length > 0 && !budgetErr && !startErr && !dateErr;

  async function handleSubmit() {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const created = await createProject({
        name: newName,
        client: newClient,
        responsableId: newResp,
        discipline,
        budget: Math.max(0, Math.round(budgetNum ?? 0)),
        phaseIndex,
        start,
        ...(deadline ? { deadline } : {}),
      });
      if (created) return onCreated(created.id);
      // The store already showed the reason in a toast.
      setFormError("Le projet n’a pas pu être créé. Vérifiez les champs puis réessayez.");
    } catch {
      setFormError("La création a échoué (connexion ou serveur indisponible). Vos saisies sont conservées — réessayez.");
    }
    setBusy(false);
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e.target as HTMLElement).matches("textarea")) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal
      title="Nouveau projet"
      subtitle="Renseignez les informations clés — le projet apparaîtra aussitôt dans le planning et le calendrier."
      width={520}
      onClose={closeAdd}
      footer={
        <>
          <Button variant="secondary" onClick={closeAdd} disabled={busy}>Annuler</Button>
          <Button onClick={handleSubmit} loading={busy} disabled={busy || (touched && !valid) || !!budgetErr || !!startErr || !!dateErr}>Créer le projet</Button>
        </>
      }
    >
      {formError ? (
        <p role="alert" style={{ ...TX.caption, color: C.danger, background: "#FAEEEB", borderRadius: R.sm, padding: "8px 12px", margin: "0 0 14px" }}>{formError}</p>
      ) : null}

      <Field label="Intitulé du projet" required error={nameErr}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} aria-describedby={describedBy} aria-required autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={onEnter} placeholder="ex. Viaduc de la Loire — Lot 2" />
        )}
      </Field>

      <div style={{ height: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Maître d’ouvrage" hint="Le client commanditaire.">
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} value={newClient} onChange={(e) => setNewClient(e.target.value)} onKeyDown={onEnter} placeholder="ex. Département du Rhône" />
          )}
        </Field>

        <Field label="Discipline">
          {({ id }) => (
            <Select id={id} value={discipline} onChange={(e) => setDiscipline(e.target.value)} style={{ width: "100%" }}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          )}
        </Field>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Honoraires" hint="En milliers d’euros (k€), arrondi à l’unité." error={budgetErr}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} invalid={invalid} aria-describedby={describedBy} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} onKeyDown={onEnter} placeholder="ex. 320" trailing={<span style={{ ...TX.nano, color: C.ink500 }}>k€</span>} />
          )}
        </Field>

        <Field label="Phase d’étude">
          {({ id }) => (
            <Select id={id} value={phaseIndex} onChange={(e) => setPhaseIndex(Number(e.target.value))} style={{ width: "100%" }}>
              {PHASES.map((p, i) => <option key={p} value={i}>{p} — {PHASES_FULL[i]}</option>)}
            </Select>
          )}
        </Field>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Début" required error={startErr}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} invalid={invalid} aria-describedby={describedBy} aria-required type="date" required value={start} onChange={(e) => setStart(e.target.value)} onKeyDown={onEnter} />
          )}
        </Field>

        <Field label="Échéance" error={dateErr}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} invalid={invalid} aria-describedby={describedBy} type="date" min={start || undefined} value={deadline} onChange={(e) => setDeadline(e.target.value)} onKeyDown={onEnter} />
          )}
        </Field>
      </div>

      <div style={{ height: 18 }} />

      <div id="add-project-resp-label" style={labelStyle}>Responsable</div>
      <div role="group" aria-labelledby="add-project-resp-label" style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {team.map((m) => {
          const active = m.id === newResp;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setNewResp(m.id)}
              aria-pressed={active}
              className="btn"
              style={{
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 10px",
                borderRadius: R.xs,
                display: "flex",
                alignItems: "center",
                gap: 6,
                ...(active
                  ? { background: C.brand50, border: `1px solid ${C.brand}`, color: C.brandText }
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
