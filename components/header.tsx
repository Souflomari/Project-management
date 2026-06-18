"use client";

import { usePathname } from "next/navigation";

import { SearchIcon } from "./icons";
import { navItemForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";

export function Header() {
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  const { search, setSearch, searched, filtered, openAdd } = useProjects();

  const subtitle =
    item.key === "projets"
      ? `${searched.length} projets · ${filtered.length} affichés`
      : item.sub;

  return (
    <header
      style={{
        minHeight: 54,
        background: "#fff",
        borderBottom: "1px solid #D7DDD3",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        padding: "9px 22px",
        position: "sticky",
        top: 46,
        zIndex: 30,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>
          {item.label}
        </h1>
        <div style={{ fontSize: 12, color: "#6F6F6F", marginTop: 1 }}>{subtitle}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#F1F3EF",
            border: "1px solid #E2E6E0",
            borderRadius: 3,
            padding: "8px 12px",
            width: 230,
          }}
        >
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un projet…"
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              font: "inherit",
              fontSize: 13,
              color: "#233038",
              width: "100%",
            }}
          />
        </div>
        <button
          onClick={openAdd}
          style={{
            border: "none",
            cursor: "pointer",
            background: "#17823D",
            color: "#fff",
            font: "inherit",
            fontWeight: 600,
            fontSize: 13,
            padding: "8px 13px",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            gap: 7,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 0 }}>+</span>Nouveau projet
        </button>
      </div>
    </header>
  );
}
