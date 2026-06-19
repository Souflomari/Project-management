"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ChevronRightIcon, PlusIcon, SearchIcon } from "./icons";
import { Button } from "./ui";
import { openCommandPalette } from "./command-palette";
import { isProjectDetailPath, isWorkspacePath, navItemForPath, WORKSPACE_VIEWS } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, DUR, EASE, R, SH, TX } from "@/lib/tokens";

/** Segmented links switching the lens of the Projets workspace. A neutral toggle:
 *  the selected lens is a quiet white pill on the inset track (size/elevation, not
 *  colour) so the one green accent stays reserved for brand/semantics. */
function WorkspaceSwitcher({ activeKey }: { activeKey: string }) {
  return (
    <div role="tablist" aria-label="Vue des projets" className="ws-switcher" style={{ display: "inline-flex", gap: 2, background: C.subtle, borderRadius: R.md, padding: 3, maxWidth: "100%", overflowX: "auto" }}>
      {WORKSPACE_VIEWS.map((v) => {
        const active = v.key === activeKey;
        return (
          <Link
            key={v.key}
            href={v.href}
            role="tab"
            aria-selected={active}
            className="state-layer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 30,
              fontSize: 12.5,
              fontWeight: active ? 600 : 540,
              padding: "0 13px",
              borderRadius: R.sm,
              background: active ? C.surface : "transparent",
              color: active ? C.ink900 : C.ink500,
              boxShadow: active ? SH.sm : "none",
              transition: `background ${DUR.fast} ${EASE.standard}, color ${DUR.fast} ${EASE.standard}, box-shadow ${DUR.fast} ${EASE.standard}`,
              whiteSpace: "nowrap",
            }}
          >
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const params = useParams();
  const item = navItemForPath(pathname);
  const isDetail = isProjectDetailPath(pathname);
  // A project detail page is NOT a workspace lens: it gets a breadcrumb and
  // drops the list-search/count chrome (meaningless on a single project).
  const inWorkspace = isWorkspacePath(pathname) && !isDetail;
  const isListe = item.key === "projets" && pathname === "/projets";
  const { search, setSearch, openAdd, allDerived } = useProjects();

  // Resolve the open project's name for the breadcrumb (falls back gracefully
  // before data hydrates or if the id is unknown).
  const detailId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);
  const detailName = isDetail
    ? (allDerived.find((p) => p.id === detailId)?.name ?? "Projet")
    : null;

  // Resolve the platform-specific hint only after mount to avoid a visible swap
  // from the SSR/first-paint guess. `null` until then renders a stable-width
  // placeholder so the launcher layout doesn't shift.
  const [kbd, setKbd] = useState<string | null>(null);
  useEffect(() => {
    setKbd(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K");
  }, []);

  // Lift the sticky header (shadow + denser glass) once content scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 4));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const title = inWorkspace ? "Projets" : item.label;

  return (
    <header
      style={{
        minHeight: 64,
        background: scrolled ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.72)",
        backdropFilter: scrolled ? "blur(10px)" : "blur(6px)",
        WebkitBackdropFilter: scrolled ? "blur(10px)" : "blur(6px)",
        borderBottom: `1px solid ${C.line}`,
        boxShadow: scrolled ? SH.sm : "none",
        transition: "box-shadow .16s ease, background .16s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        padding: "12px 28px",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div className="header-lead" style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        {isDetail ? (
          <nav aria-label="Fil d'Ariane" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Link href="/projets" className="soft-hover" style={{ ...TX.h1, color: C.ink500, textDecoration: "none", padding: "2px 6px", margin: "0 -6px", borderRadius: R.sm, whiteSpace: "nowrap" }}>
              Projets
            </Link>
            <span aria-hidden style={{ color: C.ink400, display: "flex", flexShrink: 0 }}>
              <ChevronRightIcon size={18} />
            </span>
            <h1 style={{ ...TX.h1, margin: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} aria-current="page">
              {detailName}
            </h1>
          </nav>
        ) : (
          <>
            <h1 style={{ ...TX.h1, margin: 0, whiteSpace: "nowrap" }}>{title}</h1>
            {inWorkspace ? <WorkspaceSwitcher activeKey={item.key} /> : null}
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {isListe ? (
          <div
            className="ui-field header-search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: R.sm,
              padding: "0 12px",
              height: 38,
              width: 280,
              color: C.ink400,
            }}
          >
            <SearchIcon />
            <input
              data-projets-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un projet…"
              aria-label="Rechercher un projet"
              style={{ border: "none", background: "transparent", outline: "none", font: "inherit", fontSize: 14, color: C.ink900, width: "100%" }}
            />
          </div>
        ) : (
          <button
            onClick={openCommandPalette}
            className="ui-field header-search lift-hover"
            aria-label="Recherche rapide"
            style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.sm, padding: "0 10px 0 12px", height: 38, width: 240, color: C.ink500, cursor: "pointer", font: "inherit" }}
          >
            <SearchIcon />
            <span style={{ fontSize: 14, flex: 1, textAlign: "left" }}>Rechercher…</span>
            <kbd style={{ ...TX.nano, color: C.ink500, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.xs, padding: "1px 5px", fontFamily: "inherit", minWidth: "3ch", textAlign: "center", visibility: kbd ? "visible" : "hidden" }}>{kbd ?? " "}</kbd>
          </button>
        )}
        <Button onClick={openAdd} icon={<PlusIcon size={15} />} aria-label="Nouveau projet">
          <span className="btn-label-collapsible">Nouveau projet</span>
        </Button>
      </div>
    </header>
  );
}
