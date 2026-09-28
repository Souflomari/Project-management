"use client";

import { AnimatePresence, motion, useIsPresent } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "./icons";
import { useOverlay } from "./overlay/overlay-stack";
import { ProjectComments, ProjectIdentity, ProjectPeekSummary, ProjectTasks, StatusPicker } from "./project-detail";
import { IconButton } from "./ui";
import { useIsClient } from "@/lib/use-media-query";
import { deriveProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, SH, SPRING, TX, Z } from "@/lib/tokens";

const SECTION: React.CSSProperties = { ...TX.overline, color: C.ink700 };

export function ProjectDrawer() {
  const { selected, team, closeDrawer } = useProjects();
  const router = useRouter();
  const isClient = useIsClient();

  const derived = useMemo(() => (selected ? deriveProject(selected, team) : null), [selected, team]);

  const openFull = useCallback(() => {
    const id = selected?.id;
    closeDrawer();
    if (id != null) router.push(`/projets/${id}`);
  }, [selected, closeDrawer, router]);

  if (!isClient) return null;
  // Portal on <body>, outside the inert-able app root. A constant key: switching
  // project while open updates the peek in place (no remount → focus stays).
  return createPortal(
    <AnimatePresence>
      {selected && derived ? (
        <Peek key="peek" p={derived} onClose={closeDrawer} onOpenFull={openFull} />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function Peek({
  p,
  onClose,
  onOpenFull,
}: {
  p: ReturnType<typeof deriveProject>;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  // The overlay layer (focus trap, Escape for the top-most layer only, inert
  // background, scroll lock, focus restore) lives HERE — this component only
  // exists while the drawer is open, so the trap engages on open. During the
  // exit animation the layer is already released.
  const rootRef = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  const titleId = useId();
  useOverlay(rootRef, { active: present, onEscape: onClose, initialFocus: "container" });

  // The drawer is an ACTIONABLE PEEK — identity, status, the decision numbers,
  // then the live task list (add/toggle/edit/delete) and the activity thread with
  // a working composer. The full two-column workspace still lives at /projets/[id].
  return (
    <div ref={rootRef}>
      <motion.div
        onClick={onClose}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        // cursor signals the backdrop is a click-to-close affordance (Escape also
        // closes via the overlay layer).
        style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.34)", zIndex: Z.drawer, cursor: "pointer" }}
      />
      <motion.aside
        data-overlay-focus=""
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
              <IconButton size={30} onClick={onClose} aria-label="Fermer le dossier" data-overlay-close="">
                <CloseIcon size={15} />
              </IconButton>
            </div>
          </div>
          <ProjectIdentity p={p} titleId={titleId} />
          <div style={{ marginTop: 12 }}>
            <StatusPicker p={p} size="xs" />
          </div>
        </div>

        <div style={{ padding: "20px 22px 32px" }}>
          {/* the two decision numbers + next deliverable */}
          <ProjectPeekSummary p={p} />

          {/* live task list — toggle / inline-edit / delete + the "Nouvelle tâche"
              add form, self-contained and store-connected. Separated by a hairline
              rule and a section label, not wrapped in a competing card. */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
            <div style={{ ...SECTION, marginBottom: 12 }}>Tâches</div>
            <ProjectTasks p={p} />
          </div>

          {/* live activity thread WITH the comment composer (@mentions, Maj+Entrée).
              Replaces the former read-only "Activité récente" snapshot. */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={SECTION}>Activité</div>
              <Link
                href={`/projets/${p.id}?onglet=activite`}
                onClick={(e) => { e.preventDefault(); onOpenFull(); }}
                className="soft-hover"
                style={{ ...TX.micro, color: C.ink500, padding: "2px 6px", borderRadius: R.xs }}
              >
                Ouvrir la page ↗
              </Link>
            </div>
            <ProjectComments p={p} />
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
