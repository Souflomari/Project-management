"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ICONS } from "./icons";
import { SIDEBAR_ITEMS, sidebarKeyForPath } from "@/lib/nav";
import { C, DUR, EASE, R, TX } from "@/lib/tokens";

/**
 * Thumb-zone bottom tab bar for mobile (<=768px). Hidden above 768px via the
 * `.mobile-tabbar` class in globals.css. Mirrors the header's translucent glass
 * surface and floats above the safe-area inset. The 3 destinations match the
 * sidebar's SIDEBAR_ITEMS; active state uses sidebarKeyForPath so a workspace
 * lens (Planning/Calendrier/Kanban) still lights "Projets".
 */
export function MobileNav() {
  const pathname = usePathname();
  const activeKey = sidebarKeyForPath(pathname);

  return (
    <nav className="mobile-tabbar" aria-label="Navigation principale">
      {SIDEBAR_ITEMS.map((item) => {
        const active = item.key === activeKey;
        const Icon = NAV_ICONS[item.key];
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="mobile-tab state-layer"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              borderRadius: R.md,
              color: active ? C.brandText : C.ink500,
              fontWeight: active ? 600 : 500,
              transition: `color ${DUR.base} ${EASE.standard}`,
            }}
          >
            <span style={{ display: "flex", color: active ? C.brand : C.ink500, transition: `color ${DUR.base} ${EASE.standard}` }}>
              <Icon size={21} />
            </span>
            <span style={{ ...TX.nano, fontWeight: "inherit", whiteSpace: "nowrap" }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
