"use client";

import { usePathname } from "next/navigation";

import { PlusIcon, SearchIcon } from "./icons";
import { Button } from "./ui";
import { navItemForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, TX } from "@/lib/tokens";

export function Header() {
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  const { search, setSearch, searched, filtered, openAdd } = useProjects();

  const subtitle =
    item.key === "projets" ? `${searched.length} projets · ${filtered.length} affichés` : item.sub;

  return (
    <header
      style={{
        minHeight: 60,
        background: C.surface,
        borderBottom: `1px solid ${C.line}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        padding: "10px 24px",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ ...TX.h1, margin: 0 }}>{item.label}</h1>
        <div style={{ ...TX.caption, color: C.ink500, marginTop: 2 }}>{subtitle}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          className="ui-field"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 4,
            padding: "0 12px",
            height: 36,
            width: 280,
          }}
        >
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un projet…"
            style={{ border: "none", background: "transparent", outline: "none", font: "inherit", fontSize: 13.5, color: C.ink900, width: "100%" }}
          />
        </div>
        <Button onClick={openAdd} icon={<PlusIcon size={15} />}>
          Nouveau projet
        </Button>
      </div>
    </header>
  );
}
