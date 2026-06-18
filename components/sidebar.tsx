"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ICONS } from "./icons";
import { signOutAction } from "@/app/actions";
import { WEEK_SHORT } from "@/lib/format";
import { NAV_ITEMS, navItemForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C } from "@/lib/tokens";

export function Sidebar() {
  const pathname = usePathname();
  const activeKey = navItemForPath(pathname).key;
  const { serverBacked } = useProjects();

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: C.navy,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", padding: "4px 8px 2px" }}>
        <span>setec</span>
        <span style={{ color: C.brandDot }}>.</span>
      </div>
      <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: C.navyMuted, fontWeight: 600, padding: "0 8px 14px" }}>
        Direction technique
      </div>

      {/* live week context (folded in from the old top bar) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 8px 16px", padding: "8px 10px", background: "rgba(255,255,255,.06)", borderRadius: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.brandDot, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, color: "#D7E4E2", fontWeight: 500 }}>
          Semaine {WEEK_SHORT}
        </span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          const Icon = NAV_ICONS[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                padding: "9px 11px",
                borderRadius: 8,
                color: active ? "#fff" : "#A9C2C2",
                background: active ? C.navyActive : "transparent",
                borderLeft: `3px solid ${active ? C.brandDot : "transparent"}`,
                transition: "background .12s",
              }}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 4px", borderTop: "1px solid rgba(255,255,255,.12)" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.brandDot, color: "#0E2A18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
          PD
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>P. Dubois</div>
          <div style={{ fontSize: 11, color: C.navyMuted }}>Directrice de projets</div>
        </div>
      </div>

      {serverBacked ? (
        <form action={signOutAction} style={{ padding: "2px 8px 0" }}>
          <button type="submit" style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: C.navyMuted, fontSize: 12, fontWeight: 500, padding: "6px 0" }}>
            Se déconnecter
          </button>
        </form>
      ) : null}
    </aside>
  );
}
