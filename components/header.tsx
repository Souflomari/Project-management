"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PlusIcon, SearchIcon } from "./icons";
import { Button } from "./ui";
import { openCommandPalette } from "./command-palette";
import { isWorkspacePath, navItemForPath, WORKSPACE_VIEWS } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, SH, TX } from "@/lib/tokens";

/** Segmented links switching the lens of the Projets workspace. */
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
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: R.sm,
              background: active ? C.surface : "transparent",
              color: active ? C.ink900 : C.ink500,
              boxShadow: active ? SH.sm : "none",
              transition: "background .12s, color .12s",
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
  const item = navItemForPath(pathname);
  const inWorkspace = isWorkspacePath(pathname);
  const isListe = item.key === "projets";
  const { search, setSearch, searched, filtered, openAdd } = useProjects();

  const [kbd, setKbd] = useState("⌘K");
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setKbd("Ctrl K");
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
  const count = `${filtered.length} affiché${filtered.length > 1 ? "s" : ""} sur ${searched.length}`;

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
        <h1 style={{ ...TX.h1, margin: 0, whiteSpace: "nowrap" }}>{title}</h1>
        {inWorkspace ? <WorkspaceSwitcher activeKey={item.key} /> : null}
        {isListe ? <span className="header-search" style={{ ...TX.caption, color: C.ink400, whiteSpace: "nowrap" }}>{count}</span> : null}
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
              height: 36,
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
            className="ui-field header-search"
            aria-label="Recherche rapide"
            style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.sm, padding: "0 10px 0 12px", height: 36, width: 240, color: C.ink400, cursor: "pointer", font: "inherit" }}
          >
            <SearchIcon />
            <span style={{ fontSize: 14, flex: 1, textAlign: "left" }}>Rechercher…</span>
            <kbd style={{ fontSize: 11, fontWeight: 600, color: C.ink500, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.xs, padding: "1px 5px", fontFamily: "inherit" }}>{kbd}</kbd>
          </button>
        )}
        <Button onClick={openAdd} icon={<PlusIcon size={15} />} aria-label="Nouveau projet">
          <span className="btn-label-collapsible">Nouveau projet</span>
        </Button>
      </div>
    </header>
  );
}
