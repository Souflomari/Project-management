"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { CaretDownIcon, NAV_ICONS } from "./icons";
import { signOutAction } from "@/app/actions";
import { WEEK_SHORT } from "@/lib/format";
import {
  ACCOUNT_ROUTES,
  SIDEBAR_ITEMS,
  WORKSPACE_VIEWS,
  isWorkspacePath,
  sidebarKeyForPath,
  workspaceLensForPath,
} from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, DUR, EASE, FONT_DISPLAY, R, SP, SPRING, SURFACE, TX } from "@/lib/tokens";

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 11,
    width: "100%",
    minHeight: 40, // Fitts: generous nav target
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    padding: "0 10px",
    borderRadius: R.sm,
    color: active ? C.ink900 : C.ink500,
    // C1: SELECTED is an INK device (not green). Dark left-bar + dark icon + a
    // clearly-sunken surface so the active row reads as chosen without any accent.
    background: active ? SURFACE.containerHigh : "transparent",
    transition: `background ${DUR.base} ${EASE.standard}, color ${DUR.base} ${EASE.standard}`,
  };
}

/** The animated green left-indicator bar shared by every nav row. */
function ActiveBar({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: 2,
        top: "50%",
        transform: `translateY(-50%) scaleY(${active ? 1 : 0})`,
        width: 3,
        height: 18,
        borderRadius: R.pill,
        // C1: persistent SELECTED is ink, not green (green = hover/positive/data).
        background: C.ink900,
        transition: `transform ${DUR.base} ${EASE.out}`,
      }}
    />
  );
}

/**
 * The "Projets" workspace is an expandable group: the parent row navigates to
 * the Liste lens, and the chevron toggles a sub-list with the four lenses
 * (Liste/Planning/Calendrier/Kanban) so all three previously-orphaned views are
 * reachable from any route. Auto-opens while inside the workspace.
 */
function ProjetsGroup({ pathname }: { pathname: string }) {
  const inWorkspace = isWorkspacePath(pathname);
  const activeLens = workspaceLensForPath(pathname);
  const groupActive = sidebarKeyForPath(pathname) === "projets";
  const [open, setOpen] = useState(inWorkspace);

  // Keep the group open whenever the user navigates into it.
  useEffect(() => {
    if (inWorkspace) setOpen(true);
  }, [inWorkspace]);

  const Icon = NAV_ICONS.projets;

  return (
    <div>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Link
          href="/projets"
          aria-current={groupActive ? "page" : undefined}
          className="app-nav-link state-layer"
          style={{ ...navLinkStyle(groupActive), paddingRight: 34 }}
        >
          <ActiveBar active={groupActive} />
          <span style={{ color: groupActive ? C.ink900 : C.ink500, display: "flex", transition: `color ${DUR.base} ${EASE.standard}` }}>
            <Icon />
          </span>
          <span className="rail-hide">Projets</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Réduire les vues Projets" : "Développer les vues Projets"}
          aria-expanded={open}
          className="rail-hide nav-hover"
          style={{
            position: "absolute",
            right: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30, // Fitts: enlarge the disclosure hit area
            border: "none",
            background: "transparent",
            color: C.ink400,
            cursor: "pointer",
            borderRadius: R.xs,
          }}
        >
          <span style={{ display: "flex", transform: `rotate(${open ? 0 : -90}deg)`, transition: `transform ${DUR.base} ${EASE.standard}` }}>
            <CaretDownIcon size={14} />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="rail-hide"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING.gentle}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: SP[1], padding: "2px 0 4px" }}>
              {WORKSPACE_VIEWS.map((v) => {
                const active = v.key === activeLens;
                return (
                  <Link
                    key={v.key}
                    href={v.href}
                    aria-current={active ? "page" : undefined}
                    className="app-nav-link state-layer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      width: "100%",
                      minHeight: 36, // Fitts: sub-row still comfortably tappable
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      padding: "0 10px 0 33px",
                      borderRadius: R.sm,
                      // Same calm model as primary rows: quiet neutral container,
                      // the active dot (a non-colour position cue too) goes green.
                      color: active ? C.ink900 : C.ink500,
                      background: active ? SURFACE.containerHigh : "transparent",
                      transition: `background ${DUR.base} ${EASE.standard}, color ${DUR.base} ${EASE.standard}`,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: active ? C.ink900 : C.ink350,
                        transition: `background ${DUR.base} ${EASE.standard}`,
                      }}
                    />
                    {v.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Avatar + name footer that opens an account menu (Profil/Paramètres/Thème/Se déconnecter). */
function AccountMenu({ serverBacked }: { serverBacked: boolean }) {
  // TODO(auth): surface the real authenticated user. The Supabase session is
  // available server-side (getServerContext().user) but isn't threaded through
  // ProjectsProvider yet — wire `user` into the provider and read it here to
  // replace the placeholder identity below.
  const name = "Mehrnaz";
  const role = "Responsable du département";
  const initials = "ME";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    minHeight: 38, // Fitts: comfortable menu-row target
    textAlign: "left",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: C.ink700,
    fontSize: 14,
    fontWeight: 400,
    padding: "0 10px",
    borderRadius: R.sm,
  };

  return (
    <div ref={ref} style={{ position: "relative", marginTop: "auto" }}>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label="Compte"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={SPRING.snappy}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 4,
              right: 4,
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: R.md,
              boxShadow: "var(--sh-overlay, 0 8px 28px rgba(28,25,23,.16))",
              padding: 5,
              zIndex: 40,
            }}
          >
            <Link href={ACCOUNT_ROUTES.profil} role="menuitem" className="nav-hover" style={itemStyle} onClick={() => setOpen(false)}>
              Profil
            </Link>
            <Link href={ACCOUNT_ROUTES.parametres} role="menuitem" className="nav-hover" style={itemStyle} onClick={() => setOpen(false)}>
              Paramètres
            </Link>
            {/* TODO(theme): wire to a real theme toggle once a theme store exists. */}
            <button type="button" role="menuitem" className="nav-hover" style={itemStyle} onClick={() => setOpen(false)} title="Bientôt disponible">
              Thème
            </button>
            <div style={{ height: 1, background: C.line, margin: "4px 6px" }} />
            {serverBacked ? (
              <form action={signOutAction}>
                <button type="submit" role="menuitem" className="nav-hover" style={{ ...itemStyle, color: C.ink500 }}>
                  Se déconnecter
                </button>
              </form>
            ) : (
              <Link href="/login" role="menuitem" className="nav-hover" style={{ ...itemStyle, color: C.ink500 }} onClick={() => setOpen(false)}>
                Se déconnecter
              </Link>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Compte — ${name}`}
        className="nav-hover"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          minHeight: 48, // Fitts: the account control is a generous target
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "8px 8px",
          marginTop: 16,
          borderTop: `1px solid ${C.line}`,
          borderRadius: R.sm,
        }}
      >
        {/* Persona avatar: a MUTED NEUTRAL disc with white initials — the same
            calm, low-chroma treatment the rest of the app uses for avatars (no
            saturated hue), so identity reads quietly and the one green accent is
            never diluted. */}
        <div aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: "#4F5A63", color: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
          {initials}
        </div>
        <div className="rail-hide" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div style={{ fontSize: 12, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role}</div>
        </div>
        {/* Conventional disclosure caret (Jakob): the avatar signals identity, the
            caret signals "opens a menu" — clearer than a redundant person icon. */}
        <span className="rail-hide" aria-hidden style={{ color: C.ink400, display: "flex", flexShrink: 0, transform: `rotate(${open ? 180 : 0}deg)`, transition: `transform ${DUR.base} ${EASE.standard}` }}>
          <CaretDownIcon size={14} />
        </span>
      </button>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const activeKey = sidebarKeyForPath(pathname);
  const { serverBacked } = useProjects();

  return (
    <aside
      className="app-sidebar"
      style={{
        width: 232,
        flexShrink: 0,
        background: C.canvas,
        borderRight: `1px solid ${C.line}`,
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px 16px",
        position: "sticky",
        top: 0,
        height: "100dvh",
      }}
    >
      <Link
        href="/"
        aria-label="Setec — Tableau de bord"
        className="soft-hover"
        style={{ display: "block", textDecoration: "none", borderRadius: R.sm, padding: "2px 10px 0", margin: "-2px -10px 0" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 20, fontWeight: 600, fontFamily: FONT_DISPLAY, letterSpacing: "-.02em", color: C.ink900 }}>
          <span className="rail-hide">setec</span>
          <span className="rail-only" style={{ fontFamily: FONT_DISPLAY }}>s</span>
          <span style={{ color: C.brandDot }}>.</span>
        </div>
        <div className="rail-hide" style={{ ...TX.caption, fontSize: 12, color: C.ink500, fontWeight: 400, paddingTop: 2 }}>Direction technique</div>
      </Link>
      <div style={{ height: 22 }} />

      <nav aria-label="Navigation principale" style={{ display: "flex", flexDirection: "column", gap: SP[1] }}>
        {SIDEBAR_ITEMS.map((item) => {
          if (item.key === "projets") return <ProjetsGroup key="projets" pathname={pathname} />;
          const active = item.key === activeKey;
          const Icon = NAV_ICONS[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className="app-nav-link state-layer"
              style={navLinkStyle(active)}
            >
              <ActiveBar active={active} />
              <span style={{ color: active ? C.ink900 : C.ink500, display: "flex", transition: `color ${DUR.base} ${EASE.standard}` }}>
                <Icon />
              </span>
              <span className="rail-hide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* quiet live-week context — neutral dot: this is ambient metadata, not a
          selection/positive signal, so it must not spend the one green accent
          (Von Restorff: keep the accent reserved for what actually matters). */}
      <div className="rail-hide" style={{ display: "flex", alignItems: "center", gap: SP[3], margin: "16px 10px 0", color: C.ink500, ...TX.micro }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.ink350, flexShrink: 0 }} />
        Semaine {WEEK_SHORT}
      </div>

      <AccountMenu serverBacked={serverBacked} />
    </aside>
  );
}
