"use client";

import { useState } from "react";

import { Avatar, Button, Card, Modal } from "@/components/ui";
import { clearSampleData } from "@/lib/data";
import { useProjects } from "@/lib/store/projects-context";
import { C, SP, TX } from "@/lib/tokens";

// Fixed demo persona (mirrors the sidebar account control). Real auth is not yet
// wired through the provider, so the identity here is a placeholder.
const PERSONA = {
  name: "Mehrnaz",
  role: "Responsable du département",
  initials: "ME",
  color: "#4F5A63",
} as const;

/** Small editorial frame for each settings block: an h-less label + helper line
 *  over a flat white card, matching the app's section idiom. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: SP[8] }}>
      <h3 style={{ ...TX.sectionHd, color: C.ink900, margin: 0 }}>{title}</h3>
      {description ? (
        <p style={{ ...TX.caption, color: C.ink500, margin: `${SP[2]}px 0 0` }}>
          {description}
        </p>
      ) : null}
      <div style={{ marginTop: SP[4] }}>{children}</div>
    </section>
  );
}

export default function ParametresPage() {
  const { projects, team } = useProjects();
  const [confirmReset, setConfirmReset] = useState(false);

  // Export {projects, team} as a downloadable JSON file via a transient anchor.
  function exportData() {
    const payload = JSON.stringify({ projects, team }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "setec-pilotage-donnees.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function resetDemo() {
    clearSampleData();
    window.location.reload();
  }

  return (
    <div style={{ maxWidth: 660, margin: "0 auto" }}>
      <h2 style={{ ...TX.h2, color: C.ink900, margin: 0 }}>Paramètres</h2>
      <p style={{ ...TX.body, color: C.ink500, marginTop: SP[2] }}>
        Gérez votre profil, vos données et l{"’"}apparence de l{"’"}application.
      </p>

      {/* ── Profil ──────────────────────────────────────────────────────────── */}
      <Section title="Profil">
        <Card padding={`${SP[5]}px ${SP[6]}px`}>
          <div style={{ display: "flex", alignItems: "center", gap: SP[5] }}>
            <Avatar
              initials={PERSONA.initials}
              color={PERSONA.color}
              size={48}
              title={PERSONA.name}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ ...TX.bodyStrong, color: C.ink900 }}>{PERSONA.name}</div>
              <div style={{ ...TX.caption, color: C.ink500, marginTop: 2 }}>
                {PERSONA.role}
              </div>
            </div>
          </div>
          <p
            style={{
              ...TX.micro,
              color: C.ink400,
              fontWeight: 400,
              margin: `${SP[5]}px 0 0`,
            }}
          >
            Identité de démonstration. L{"’"}authentification réelle, qui affichera
            votre véritable compte, arrive prochainement.
          </p>
        </Card>
      </Section>

      {/* ── Données & confidentialité ───────────────────────────────────────── */}
      <Section
        title="Données & confidentialité"
        description="En mode démonstration, vos modifications sont enregistrées localement, dans ce navigateur uniquement. Rien n’est envoyé à un serveur."
      >
        <Card padding={`${SP[5]}px ${SP[6]}px`}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: SP[5],
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 280px" }}>
              <div style={{ ...TX.bodyStrong, color: C.ink900 }}>
                Exporter les données
              </div>
              <p style={{ ...TX.caption, color: C.ink500, margin: `${SP[2]}px 0 0` }}>
                Téléchargez vos projets et votre équipe au format JSON
                ({projects.length} projet{projects.length > 1 ? "s" : ""},{" "}
                {team.length} membre{team.length > 1 ? "s" : ""}).
              </p>
            </div>
            <Button variant="secondary" onClick={exportData}>
              Exporter les données (JSON)
            </Button>
          </div>

          <div style={{ height: 1, background: C.line, margin: `${SP[5]}px 0` }} />

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: SP[5],
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 280px" }}>
              <div style={{ ...TX.bodyStrong, color: C.danger }}>
                Réinitialiser la démonstration
              </div>
              <p style={{ ...TX.caption, color: C.ink500, margin: `${SP[2]}px 0 0` }}>
                Efface toutes vos modifications locales et restaure les données
                d{"’"}exemple d{"’"}origine. Cette action est irréversible.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>
              Réinitialiser
            </Button>
          </div>
        </Card>
      </Section>

      {/* ── Thème ───────────────────────────────────────────────────────────── */}
      <Section title="Thème">
        <Card padding={`${SP[4]}px ${SP[6]}px`}>
          <p style={{ ...TX.caption, color: C.ink500, margin: 0 }}>
            Le thème clair est le seul disponible pour le moment.
          </p>
        </Card>
      </Section>

      {confirmReset ? (
        <Modal
          title="Réinitialiser la démonstration ?"
          subtitle="Toutes vos modifications locales seront définitivement effacées et remplacées par les données d’exemple. Cette action est irréversible."
          width={440}
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Annuler
              </Button>
              <Button variant="danger" onClick={resetDemo}>
                Réinitialiser
              </Button>
            </>
          }
        >
          <p style={{ ...TX.body, color: C.ink700, margin: 0 }}>
            Confirmez pour rétablir les projets et l{"’"}équipe de démonstration.
          </p>
        </Modal>
      ) : null}

      <div style={{ height: SP[9] }} />
    </div>
  );
}
