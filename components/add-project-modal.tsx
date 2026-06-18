"use client";

import { useRouter } from "next/navigation";

import { useProjects } from "@/lib/store/projects-context";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "#6F6F6F",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E2E6E0",
  borderRadius: 3,
  padding: "10px 12px",
  font: "inherit",
  fontSize: 13.5,
  outline: "none",
  marginBottom: 14,
};

export function AddProjectModal() {
  const router = useRouter();
  const {
    showAdd,
    closeAdd,
    newName,
    newClient,
    newResp,
    setNewName,
    setNewClient,
    setNewResp,
    submitAdd,
    team,
  } = useProjects();

  if (!showAdd) return null;

  const canSubmit = newName.trim().length > 0;

  async function handleSubmit() {
    const created = await submitAdd();
    if (created) router.push("/projets");
  }

  return (
    <div
      onClick={closeAdd}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,18,28,.42)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn .16s ease",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 4,
          padding: "22px 24px 20px",
          color: "#233038",
          animation: "popIn .2s cubic-bezier(.2,.7,.2,1)",
          border: "1px solid #C7CFC4",
        }}
      >
        <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 700 }}>Nouveau projet</h2>
        <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#6F6F6F" }}>
          Ajoutez un projet au portefeuille de pilotage.
        </p>

        <label style={labelStyle}>Intitulé du projet</label>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ex. Viaduc de la Loire — Lot 2"
          style={inputStyle}
        />

        <label style={labelStyle}>Maître d&apos;ouvrage</label>
        <input
          value={newClient}
          onChange={(e) => setNewClient(e.target.value)}
          placeholder="ex. Département du Rhône"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginBottom: 8 }}>Responsable</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 22 }}>
          {team.map((m) => {
            const active = m.id === newResp;
            return (
              <button
                key={m.id}
                onClick={() => setNewResp(m.id)}
                style={{
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 10px",
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  ...(active
                    ? { background: "#EDF3EF", border: "1px solid #17823D", color: "#17823D" }
                    : { background: "#fff", border: "1px solid #E2E6E0", color: "#6F6F6F" }),
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color }} />
                {m.name}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={closeAdd}
            style={{
              border: "1px solid #E2E6E0",
              background: "#fff",
              cursor: "pointer",
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#6F6F6F",
              padding: "10px 16px",
              borderRadius: 3,
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              border: "none",
              cursor: "pointer",
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "#17823D",
              padding: "10px 18px",
              borderRadius: 3,
              opacity: canSubmit ? 1 : 0.5,
              pointerEvents: canSubmit ? "auto" : "none",
            }}
          >
            Créer le projet
          </button>
        </div>
      </div>
    </div>
  );
}
