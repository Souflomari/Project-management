"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PlusIcon, SearchIcon } from "./icons";
import { Button } from "./ui";
import { openCommandPalette } from "./command-palette";
import { navItemForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, TX } from "@/lib/tokens";

export function Header() {
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  const { search, setSearch, searched, filtered, openAdd } = useProjects();
  const [kbd, setKbd] = useState("⌘K");
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setKbd("Ctrl K");
  }, []);

  const subtitle =
    item.key === "projets"
      ? `${filtered.length} affiché${filtered.length > 1 ? "s" : ""} sur ${searched.length}`
      : item.sub;

  return (
    <header
      style={{
        minHeight: 64,
        background: "rgba(250,250,249,.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderBottom: `1px solid ${C.line}`,
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
      <div style={{ minWidth: 0 }}>
        <h1 style={{ ...TX.h1, margin: 0 }}>{item.label}</h1>
        {subtitle ? <div style={{ ...TX.caption, color: C.ink400, marginTop: 3 }}>{subtitle}</div> : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {item.key === "projets" ? (
          <div
            className="ui-field"
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
            className="ui-field"
            aria-label="Recherche rapide"
            style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.sm, padding: "0 10px 0 12px", height: 36, width: 240, color: C.ink400, cursor: "pointer", font: "inherit" }}
          >
            <SearchIcon />
            <span style={{ fontSize: 14, flex: 1, textAlign: "left" }}>Rechercher…</span>
            <kbd style={{ fontSize: 11, fontWeight: 600, color: C.ink500, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.xs, padding: "1px 5px", fontFamily: "inherit" }}>{kbd}</kbd>
          </button>
        )}
        <Button onClick={openAdd} icon={<PlusIcon size={15} />}>
          Nouveau projet
        </Button>
      </div>
    </header>
  );
}
