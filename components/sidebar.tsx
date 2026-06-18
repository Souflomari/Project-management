"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ICONS } from "./icons";
import { signOutAction } from "@/app/actions";
import { WEEK_SHORT } from "@/lib/format";
import { NAV_ITEMS, navItemForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, FONT_DISPLAY, R } from "@/lib/tokens";

export function Sidebar() {
  const pathname = usePathname();
  const activeKey = navItemForPath(pathname).key;
  const { serverBacked } = useProjects();

  return (
    <aside
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
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 19, fontWeight: 600, fontFamily: FONT_DISPLAY, letterSpacing: "-.02em", color: C.ink900, padding: "2px 10px 0" }}>
        <span>setec</span>
        <span style={{ color: C.brandDot }}>.</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.ink500, fontWeight: 440, padding: "2px 10px 22px" }}>Direction technique</div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          const Icon = NAV_ICONS[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className={active ? undefined : "nav-hover"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                fontSize: 13.5,
                fontWeight: active ? 540 : 450,
                padding: "9px 10px",
                borderRadius: R.sm,
                color: active ? C.ink900 : C.ink500,
                background: active ? C.subtle : "transparent",
              }}
            >
              <span style={{ color: active ? C.ink700 : C.ink500, display: "flex" }}>
                <Icon />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* quiet live-week context */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 10px 0", color: C.ink500, fontSize: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.brandDot, flexShrink: 0 }} />
        Semaine {WEEK_SHORT}
      </div>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "16px 10px 4px", borderTop: `1px solid ${C.line}` }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.subtle, border: `1px solid ${C.line}`, color: C.ink700, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>
          PD
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 540, color: C.ink900 }}>P. Dubois</div>
          <div style={{ fontSize: 11.5, color: C.ink500 }}>Directrice de projets</div>
        </div>
      </div>

      {serverBacked ? (
        <form action={signOutAction} style={{ padding: "4px 10px 0" }}>
          <button type="submit" className="nav-hover" style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: C.ink500, fontSize: 12, fontWeight: 450, padding: "6px 10px", borderRadius: R.sm }}>
            Se déconnecter
          </button>
        </form>
      ) : null}
    </aside>
  );
}
