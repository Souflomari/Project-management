"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ICONS } from "./icons";
import { signOutAction } from "@/app/actions";
import { WEEK_SHORT } from "@/lib/format";
import { SIDEBAR_ITEMS, sidebarKeyForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, DUR, EASE, FONT_DISPLAY, R, SP, TX } from "@/lib/tokens";

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
      <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 19, fontWeight: 600, fontFamily: FONT_DISPLAY, letterSpacing: "-.02em", color: C.ink900, padding: "2px 10px 0" }}>
        <span className="rail-hide">setec</span>
        <span className="rail-only" style={{ fontFamily: FONT_DISPLAY }}>s</span>
        <span style={{ color: C.brandDot }}>.</span>
      </div>
      <div className="rail-hide" style={{ ...TX.caption, fontSize: 11.5, color: C.ink500, fontWeight: 440, padding: "2px 10px 22px" }}>Direction technique</div>

      <nav style={{ display: "flex", flexDirection: "column", gap: SP[1] }}>
        {SIDEBAR_ITEMS.map((item) => {
          const active = item.key === activeKey;
          const Icon = NAV_ICONS[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className="app-nav-link state-layer"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                fontSize: 13.5,
                fontWeight: active ? 540 : 450,
                padding: "9px 10px",
                borderRadius: R.sm,
                color: active ? C.brandText : C.ink500,
                background: active ? C.brand50 : "transparent",
                transition: `background ${DUR.base} ${EASE.standard}, color ${DUR.base} ${EASE.standard}`,
              }}
            >
              {/* green left-indicator bar gives the brand colour a deliberate active role */}
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
                  background: C.brand,
                  transition: `transform ${DUR.base} ${EASE.out}`,
                }}
              />
              <span style={{ color: active ? C.brand : C.ink500, display: "flex", transition: `color ${DUR.base} ${EASE.standard}` }}>
                <Icon />
              </span>
              <span className="rail-hide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* quiet live-week context */}
      <div className="rail-hide" style={{ display: "flex", alignItems: "center", gap: SP[3], margin: "16px 10px 0", color: C.ink500, ...TX.micro }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.brandDot, flexShrink: 0 }} />
        Semaine {WEEK_SHORT}
      </div>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "16px 10px 4px", borderTop: `1px solid ${C.line}` }}>
        <div title="P. Dubois · Directrice de projets" style={{ width: 30, height: 30, borderRadius: "50%", background: C.subtle, border: `1px solid ${C.line}`, color: C.ink700, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
          PD
        </div>
        <div className="rail-hide" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 540, color: C.ink900 }}>P. Dubois</div>
          <div style={{ fontSize: 11.5, color: C.ink500 }}>Directrice de projets</div>
        </div>
      </div>

      {serverBacked ? (
        <form action={signOutAction} className="rail-hide" style={{ padding: "4px 10px 0" }}>
          <button type="submit" className="nav-hover" style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: C.ink500, fontSize: 12, fontWeight: 450, padding: "6px 10px", borderRadius: R.sm }}>
            Se déconnecter
          </button>
        </form>
      ) : null}
    </aside>
  );
}
