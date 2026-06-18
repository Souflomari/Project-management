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
        width: 240,
        flexShrink: 0,
        background: C.surface,
        borderRight: `1px solid ${C.line}`,
        display: "flex",
        flexDirection: "column",
        padding: "18px 12px",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", color: C.ink900, padding: "2px 10px 0" }}>
        <span>setec</span>
        <span style={{ color: C.brandDot }}>.</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.ink400, fontWeight: 450, padding: "1px 10px 14px" }}>Direction technique</div>

      {/* quiet live-week context */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 10px 14px", color: C.ink500, fontSize: 12.5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.brandDot, flexShrink: 0 }} />
        Semaine {WEEK_SHORT}
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
                fontWeight: active ? 550 : 450,
                padding: "8px 10px",
                borderRadius: 8,
                color: active ? C.brandText : C.ink500,
                background: active ? C.brand50 : "transparent",
                transition: "background .12s, color .12s",
              }}
            >
              <span style={{ color: active ? C.brand : C.ink400, display: "flex" }}>
                <Icon />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "12px 10px 4px", borderTop: `1px solid ${C.line}` }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12.5 }}>
          PD
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 550, color: C.ink900 }}>P. Dubois</div>
          <div style={{ fontSize: 11.5, color: C.ink500 }}>Directrice de projets</div>
        </div>
      </div>

      {serverBacked ? (
        <form action={signOutAction} style={{ padding: "2px 10px 0" }}>
          <button type="submit" style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: C.ink400, fontSize: 12, fontWeight: 450, padding: "6px 0" }}>
            Se déconnecter
          </button>
        </form>
      ) : null}
    </aside>
  );
}
