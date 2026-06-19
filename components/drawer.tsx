"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";

import { CloseIcon } from "./icons";
import { ProjectIdentity, ProjectPeekSummary, StatusPicker } from "./project-detail";
import { IconButton, useFocusTrap } from "./ui";
import { deriveProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, SH, SPRING, TX, Z } from "@/lib/tokens";

const SECTION: React.CSSProperties = { ...TX.overline, color: C.ink700, marginBottom: 10 };

// A drawer block is a white card lifted off the field by a hairline + soft
// shadow (unified-white depth model — no tinted fills).
const CARD: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: R.lg,
  boxShadow: SH.sm,
  padding: "16px 18px",
};

export function ProjectDrawer() {
  const { selected, team, closeDrawer } = useProjects();
  const router = useRouter();

  const asideRef = useRef<HTMLElement>(null);
  useFocusTrap(asideRef, closeDrawer);

  const derived = useMemo(() => (selected ? deriveProject(selected, team) : null), [selected, team]);

  const openFull = useCallback(() => {
    const id = selected?.id;
    closeDrawer();
    if (id != null) router.push(`/projets/${id}`);
  }, [selected, closeDrawer, router]);

  return (
    <AnimatePresence>
      {selected && derived ? (
        <Peek key={derived.id} p={derived} asideRef={asideRef} onClose={closeDrawer} onOpenFull={openFull} />
      ) : null}
    </AnimatePresence>
  );
}

function Peek({
  p,
  asideRef,
  onClose,
  onOpenFull,
}: {
  p: ReturnType<typeof deriveProject>;
  asideRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  // The drawer is a FAST TRIAGE PEEK — identity, status, the three decision
  // numbers (avancement / margin / next rendu), quick actions, recent comments.
  // The full two-column workspace lives at /projets/[id].
  const recentComments = p.comments.slice(-3);

  return (
    <>
      <motion.div
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.34)", zIndex: Z.drawer }}
      />
      <motion.aside
        ref={asideRef as never}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={SPRING.gentle}
        style={{
          outline: "none",
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: "96vw",
          background: C.surface,
          color: C.ink900,
          zIndex: Z.drawer + 1,
          borderLeft: `1px solid ${C.line}`,
          boxShadow: SH.drawer,
          overflowY: "auto",
        }}
      >
        {/* header — identity + the editable status affordance live here */}
        <div style={{ position: "sticky", top: 0, background: C.surface, padding: "16px 22px 14px", borderBottom: `1px solid ${C.line}`, zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ ...TX.eyebrow, color: C.ink500 }}>{p.phaseFull}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Link
                href={`/projets/${p.id}`}
                onClick={(e) => { e.preventDefault(); onOpenFull(); }}
                style={{ ...TX.caption, fontWeight: 600, color: C.ink500, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: R.sm }}
                className="soft-hover"
                title="Ouvrir l’espace de travail du projet"
              >
                Ouvrir la page ↗
              </Link>
              <IconButton size={30} onClick={onClose} aria-label="Fermer le dossier">
                <CloseIcon size={15} />
              </IconButton>
            </div>
          </div>
          <ProjectIdentity p={p} titleId="drawer-title" />
          <div style={{ marginTop: 12 }}>
            <StatusPicker p={p} size="xs" />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 22px 32px" }}>
          {/* the three decision numbers + next deliverable */}
          <ProjectPeekSummary p={p} />

          {/* recent activity (last 3) — full thread on the page */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={SECTION}>Activité récente</div>
              <Link
                href={`/projets/${p.id}?onglet=activite`}
                onClick={(e) => { e.preventDefault(); onOpenFull(); }}
                className="soft-hover"
                style={{ ...TX.micro, color: C.ink500, padding: "2px 6px", borderRadius: R.xs }}
              >
                Tout voir
              </Link>
            </div>
            {recentComments.length === 0 ? (
              <div style={{ ...TX.caption, color: C.ink500 }}>Aucune activité pour l’instant.</div>
            ) : (
              recentComments.map((cm, i) => (
                <div key={i} style={{ display: "flex", gap: 9, marginBottom: i === recentComments.length - 1 ? 0 : 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cm.color, marginTop: 7, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...TX.caption }}>
                      <span style={{ fontWeight: 600, color: C.ink900 }}>{cm.author}</span>{" "}
                      <span style={{ color: C.ink500 }}>· {cm.when}</span>
                    </div>
                    <div style={{ ...TX.body, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{cm.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
