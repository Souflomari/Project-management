"use client";

import { usePathname } from "next/navigation";

import { PlusIcon, SearchIcon } from "./icons";
import { Button } from "./ui";
import { navItemForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, TX } from "@/lib/tokens";

export function Header() {
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  const { search, setSearch, searched, filtered, openAdd } = useProjects();

  const subtitle =
    item.key === "projets"
      ? `${filtered.length} affiché${filtered.length > 1 ? "s" : ""} sur ${searched.length}`
      : item.sub;

  return (
    <header
      style={{
        minHeight: 64,
        background: "rgba(250,250,249,.8)",
        backdropFilter: "saturate(180%) blur(8px)",
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
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
        <div
          className="ui-field"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: C.subtle,
            border: "1px solid transparent",
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
