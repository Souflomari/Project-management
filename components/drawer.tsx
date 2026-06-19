"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { CloseIcon } from "./icons";
import { ProjectComments, ProjectIdentity, ProjectOverview, ProjectTasks } from "./project-detail";
import { IconButton, prefersReducedMotion, useFocusTrap } from "./ui";
import { deriveProject } from "@/lib/derive";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, SH, TX } from "@/lib/tokens";

const SECTION: React.CSSProperties = { ...TX.overline, color: C.ink700, marginBottom: 10 };

export function ProjectDrawer() {
  const { selected, team, closeDrawer } = useProjects();
  const router = useRouter();

  const asideRef = useRef<HTMLElement>(null);
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (prefersReducedMotion()) { closeDrawer(); return; }
    setClosing(true);
    window.setTimeout(() => { closeDrawer(); setClosing(false); }, 220);
  }, [closeDrawer]);
  useFocusTrap(asideRef, requestClose);

  const derived = useMemo(() => (selected ? deriveProject(selected, team) : null), [selected, team]);
  if (!selected || !derived) return null;
  const p = derived;

  const openFull = () => { closeDrawer(); router.push(`/projets/${p.id}`); };

  return (
    <>
      <div
        onClick={requestClose}
        style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.34)", zIndex: 60, animation: closing ? "fadeOut .2s ease forwards" : "fadeIn var(--dur-base) ease" }}
      />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        style={{
          outline: "none",
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 500,
          maxWidth: "96vw",
          background: C.surface,
          color: C.ink900,
          zIndex: 61,
          borderLeft: `1px solid ${C.line}`,
          boxShadow: SH.drawer,
          overflowY: "auto",
          animation: closing ? "drawerOut .2s var(--ease-accel) forwards" : "drawerIn var(--dur-slow) var(--ease-out)",
        }}
      >
        {/* header */}
        <div style={{ position: "sticky", top: 0, background: C.surface, padding: "18px 24px 14px", borderBottom: `1px solid ${C.line}`, zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ ...TX.eyebrow, color: C.ink500 }}>{p.phaseFull}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Link
                href={`/projets/${p.id}`}
                onClick={(e) => { e.preventDefault(); openFull(); }}
                style={{ ...TX.caption, fontWeight: 600, color: C.ink500, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: R.sm }}
                className="soft-hover"
                title="Ouvrir la page du projet"
              >
                Ouvrir la page ↗
              </Link>
              <IconButton size={30} onClick={requestClose} aria-label="Fermer le dossier">
                <CloseIcon size={15} />
              </IconButton>
            </div>
          </div>
          <ProjectIdentity p={p} titleId="drawer-title" />
        </div>

        <div className="enter-stagger" style={{ padding: "20px 24px 36px" }}>
          <ProjectOverview p={p} />
          <div style={{ marginTop: 28 }}>
            <ProjectTasks p={p} />
          </div>
          <div style={{ marginTop: 28 }}>
            <div style={SECTION}>Commentaires</div>
            <ProjectComments p={p} />
          </div>
        </div>
      </aside>
    </>
  );
}
