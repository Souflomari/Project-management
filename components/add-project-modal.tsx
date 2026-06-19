"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, Field, Input, Modal, Select } from "./ui";
import { useProjects } from "@/lib/store/projects-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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

export function AddProjectModal() {
  const router = useRouter();
  const {
    showAdd, closeAdd,
    newName, newClient, newResp,
    setNewName, setNewClient, setNewResp,
    submitAdd, team, selectedId, updateProject, setPhase,
  } = useProjects();

  const [busy, setBusy] = useState(false);
  const [discipline, setDiscipline] = useState(DISCIPLINES[0]);
  const [budget, setBudget] = useState("");
  const [start, setStart] = useState(REFERENCE_DATE);
  const [deadline, setDeadline] = useState("");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [touched, setTouched] = useState(false);

  // Reset transient field state each time the modal (re)opens.
  useEffect(() => {
    if (showAdd) {
      setDiscipline(DISCIPLINES[0]);
      setBudget("");
      setStart(REFERENCE_DATE);
      setDeadline("");
      setPhaseIndex(0);
      setTouched(false);
      setBusy(false);
    }
  }, [showAdd]);

  // Pre-select the signed-in user as responsable when their email maps onto a
  // team member (prenom.nom@… → "Prénom Nom"). Best-effort; keeps the store's
  // default otherwise.
  useEffect(() => {
    if (!showAdd || !isSupabaseConfigured()) return;
    let cancelled = false;
    createBrowserSupabaseClient().auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (cancelled || !email) return;
      const local = email.split("@")[0].toLowerCase();
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const me = team.find((m) => {
        const parts = norm(m.name).split(/\s+/);
        return parts.every((p) => local.includes(p)) || norm(m.name).replace(/\s+/g, ".") === norm(local);
      });
      if (me) setNewResp(me.id);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [showAdd, team, setNewResp]);

  // After submitAdd() succeeds, the store sets selectedId to the new project.
  // We apply the extra fields then route to its page — the single navigation
  // (no router.push race with the store's selectedId).
  const pending = useRef<{ patch: Parameters<typeof updateProject>[1]; phase: number } | null>(null);
  useEffect(() => {
    if (pending.current && selectedId != null) {
      const { patch, phase } = pending.current;
      pending.current = null;
      updateProject(selectedId, patch);
      if (phase > 0) setPhase(selectedId, phase);
      const id = selectedId;
      closeAdd();
      router.push(`/projets/${id}`);
    }
  }, [selectedId, updateProject, setPhase, closeAdd, router]);

  if (!showAdd) return null;

  const nameErr = touched && !newName.trim() ? "L’intitulé est requis." : undefined;
  const budgetNum = budget.trim() === "" ? 0 : Number(budget.replace(/\s/g, "").replace(",", "."));
  const budgetErr = touched && budget.trim() !== "" && (!Number.isFinite(budgetNum) || budgetNum < 0)
    ? "Saisissez un montant valide (k€)."
    : undefined;
  const dateErr = touched && deadline && deadline < start
    ? "L’échéance doit suivre la date de début."
    : undefined;

  const canSubmit = newName.trim().length > 0 && !budgetErr && !dateErr && !busy;

  async function handleSubmit() {
    setTouched(true);
    if (!newName.trim() || budgetErr || dateErr || busy) return;
    setBusy(true);
    try {
      // Stage the extra fields; the post-submit effect persists them once the
      // new project id is known.
      pending.current = {
        patch: {
          discipline,
          budget: Math.max(0, Math.round(Number.isFinite(budgetNum) ? budgetNum : 0)),
          start,
          ...(deadline ? { deadline } : {}),
        },
        phase: phaseIndex,
      };
      const created = await submitAdd();
      if (!created) {
        pending.current = null;
        setBusy(false);
      }
    } catch {
      pending.current = null;
      setBusy(false);
    }
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
          <Button onClick={handleSubmit} loading={busy} disabled={!canSubmit}>Créer le projet</Button>
        </>
      }
    >
      <Field label="Intitulé du projet" required error={nameErr}>
        {({ id, invalid }) => (
          <Input id={id} invalid={invalid} autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={onEnter} placeholder="ex. Viaduc de la Loire — Lot 2" />
        )}
      </Field>

      <div style={{ height: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Maître d’ouvrage" hint="Le client commanditaire.">
          {({ id }) => (
            <Input id={id} value={newClient} onChange={(e) => setNewClient(e.target.value)} onKeyDown={onEnter} placeholder="ex. Département du Rhône" />
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
        <Field label="Honoraires" hint="En milliers d’euros (k€)." error={budgetErr}>
          {({ id, invalid }) => (
            <Input id={id} invalid={invalid} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} onKeyDown={onEnter} placeholder="ex. 320" trailing={<span style={{ ...TX.nano, color: C.ink500 }}>k€</span>} />
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
        <Field label="Début">
          {({ id }) => (
            <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          )}
        </Field>

        <Field label="Échéance" error={dateErr}>
          {({ id, invalid }) => (
            <Input id={id} invalid={invalid} type="date" min={start} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          )}
        </Field>
      </div>

      <div style={{ height: 18 }} />

      <label style={labelStyle}>Responsable</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
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
