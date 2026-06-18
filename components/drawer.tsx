"use client";

import { Avatar } from "./ui";
import { deriveProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { DRAWER } from "@/lib/tokens";
import { FINAL_PHASE_INDEX, PHASES, STATUSES } from "@/lib/types";
import { STATUS_META } from "@/lib/tokens";
import { FONT_NUM } from "@/lib/tokens";

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: DRAWER.sub,
};

export function ProjectDrawer() {
  const {
    selected,
    team,
    closeDrawer,
    advancePhase,
    setStatus,
    toggleRendu,
    toggleDeliverable,
    addComment,
    commentDraft,
    setCommentDraft,
  } = useProjects();

  if (!selected) return null;

  const p = deriveProject(selected, team);
  const canAdvance = selected.phaseIndex < FINAL_PHASE_INDEX;
  const checkDone = selected.checklist.filter((c) => c.done).length;

  return (
    <>
      <div
        onClick={closeDrawer}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(13,18,28,.38)",
          zIndex: 60,
          animation: "fadeIn .18s ease",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 466,
          maxWidth: "94vw",
          background: DRAWER.paper,
          color: DRAWER.ink,
          zIndex: 61,
          borderLeft: `1px solid ${DRAWER.line}`,
          boxShadow: "-4px 0 16px rgba(20,30,25,.07)",
          overflowY: "auto",
          animation: "drawerIn .26s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {/* header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: DRAWER.paper,
            padding: "18px 24px 14px",
            borderBottom: `1px solid ${DRAWER.line}`,
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...LABEL }}>Dossier projet · {p.phaseFull}</span>
            <button
              onClick={closeDrawer}
              style={{
                border: `1px solid ${DRAWER.line}`,
                background: DRAWER.panel,
                cursor: "pointer",
                width: 30,
                height: 30,
                borderRadius: 3,
                fontSize: 16,
                color: DRAWER.sub,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <h2 style={{ margin: "11px 0 4px", fontSize: 21, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.18 }}>
            {p.name}
          </h2>
          <div style={{ fontSize: 13, color: DRAWER.sub }}>
            {p.client} · {p.discipline}
          </div>
        </div>

        <div style={{ padding: "20px 24px 36px" }}>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <Stat label="Honoraires" value={p.budgetFmt} />
            <Stat label="Avancement" value={`${p.progress}%`} />
          </div>

          {/* status */}
          <div style={{ ...LABEL, marginBottom: 9 }}>Statut</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
            {STATUSES.map((st) => {
              const m = STATUS_META[st];
              const active = st === selected.status;
              return (
                <button
                  key={st}
                  onClick={() => setStatus(selected.id, st)}
                  style={{
                    cursor: "pointer",
                    font: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    padding: "6px 11px",
                    borderRadius: 3,
                    ...(active
                      ? { background: m.color, color: "#fff", border: `1px solid ${m.color}` }
                      : { background: DRAWER.panel, color: DRAWER.sub, border: `1px solid ${DRAWER.line}` }),
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* phase stepper */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11 }}>
            <div style={{ ...LABEL }}>Phase d&apos;étude</div>
            {canAdvance ? (
              <button
                onClick={() => advancePhase(selected.id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  background: DRAWER.ac,
                  padding: "6px 11px",
                  borderRadius: 3,
                }}
              >
                Avancer la phase →
              </button>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26 }}>
            {PHASES.map((ph, i) => {
              const isDone = i < selected.phaseIndex;
              const cur = i === selected.phaseIndex;
              return (
                <div key={ph} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1 }}>
                  <div
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      ...(cur
                        ? { background: DRAWER.paper, border: `3px solid ${DRAWER.ac}` }
                        : isDone
                          ? { background: DRAWER.ac, border: `3px solid ${DRAWER.ac}` }
                          : { background: DRAWER.line, border: `3px solid ${DRAWER.line}` }),
                    }}
                  />
                  <div
                    style={{
                      fontFamily: FONT_NUM,
                      fontSize: 10,
                      textAlign: "center",
                      color: cur || isDone ? DRAWER.ink : DRAWER.sub,
                      fontWeight: cur ? 700 : 500,
                    }}
                  >
                    {ph}
                  </div>
                </div>
              );
            })}
          </div>

          {/* next rendu */}
          <div style={{ ...LABEL, marginBottom: 9 }}>Prochain rendu</div>
          <div
            style={{
              background: DRAWER.panel,
              border: `1px solid ${DRAWER.line}`,
              borderRadius: 4,
              padding: "12px 14px",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.rendu.label}</div>
                <div style={{ fontSize: 12.5, color: DRAWER.sub, marginTop: 2 }}>
                  {p.renduFull} ·{" "}
                  <span style={{ color: p.renduDueColor, fontWeight: 600 }}>{p.renduDaysLabel}</span>
                </div>
              </div>
              <button
                onClick={() => toggleRendu(selected.id)}
                style={{
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  padding: "9px 13px",
                  borderRadius: 3,
                  ...(selected.renduDone
                    ? { border: `1px solid ${DRAWER.line}`, background: DRAWER.panel, color: DRAWER.sub }
                    : { border: "none", background: DRAWER.ac, color: "#fff" }),
                }}
              >
                {selected.renduDone ? "Annuler" : "Marquer rendu"}
              </button>
            </div>
          </div>

          {/* checklist */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
            <div style={{ ...LABEL }}>Livrables (rendus)</div>
            <span style={{ fontSize: 11, color: DRAWER.sub }}>
              {checkDone}/{selected.checklist.length}
            </span>
          </div>
          <div style={{ marginBottom: 26 }}>
            {selected.checklist.map((ch, i) => (
              <div
                key={ch.label}
                onClick={() => toggleDeliverable(selected.id, i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "8px 4px",
                  borderTop: `1px solid ${DRAWER.line}`,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 11,
                    color: "#fff",
                    ...(ch.done
                      ? { background: DRAWER.ac, border: `1px solid ${DRAWER.ac}` }
                      : { background: DRAWER.paper, border: `1.5px solid ${DRAWER.line}` }),
                  }}
                >
                  {ch.done ? "✓" : ""}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: ch.done ? DRAWER.sub : DRAWER.ink,
                    textDecoration: ch.done ? "line-through" : "none",
                  }}
                >
                  {ch.label}
                </span>
              </div>
            ))}
          </div>

          {/* team + deadline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 26 }}>
            <div>
              <div style={{ ...LABEL, marginBottom: 9 }}>Équipe</div>
              <div style={{ display: "flex", alignItems: "center", paddingLeft: 7 }}>
                {p.members.map((m) => (
                  <div key={m.id} style={{ marginLeft: -7 }}>
                    <Avatar initials={m.initials} color={m.color} size={30} fontSize={10.5} ring />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...LABEL, marginBottom: 9 }}>Échéance finale</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.deadlineFull}</div>
              <div style={{ fontSize: 11.5, color: DRAWER.sub, marginTop: 2 }}>{p.deadlineDaysLabel}</div>
            </div>
          </div>

          {/* comments */}
          <div style={{ ...LABEL, marginBottom: 10 }}>Notes &amp; commentaires</div>
          {selected.comments.map((cm, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Avatar initials={cm.initials} color={cm.color} size={28} fontSize={10} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>{cm.author}</span>{" "}
                  <span style={{ color: DRAWER.sub, fontSize: 11 }}>· {cm.when}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>{cm.text}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addComment(selected.id);
              }}
              placeholder="Ajouter une note…"
              style={{
                flex: 1,
                border: `1px solid ${DRAWER.line}`,
                borderRadius: 3,
                padding: "9px 12px",
                font: "inherit",
                fontSize: 13,
                outline: "none",
                background: DRAWER.paper,
                color: DRAWER.ink,
              }}
            />
            <button
              onClick={() => addComment(selected.id)}
              style={{
                border: "none",
                cursor: "pointer",
                font: "inherit",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: DRAWER.ac,
                padding: "9px 15px",
                borderRadius: 3,
              }}
            >
              Publier
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: DRAWER.panel,
        border: `1px solid ${DRAWER.line}`,
        borderRadius: 4,
        padding: "10px 12px",
      }}
    >
      <div style={{ ...LABEL, fontSize: 10, letterSpacing: ".07em" }}>{label}</div>
      <div style={{ fontFamily: FONT_NUM, fontSize: 22, fontWeight: 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}
