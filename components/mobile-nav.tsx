"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_ICONS } from "./icons";
import {
  SIDEBAR_ITEMS,
  WORKSPACE_VIEWS,
  isWorkspacePath,
  sidebarKeyForPath,
  workspaceLensForPath,
} from "@/lib/nav";
import { C, DUR, EASE, R, SH, TX } from "@/lib/tokens";

/**
 * Thumb-zone bottom tab bar for mobile (<=768px). Hidden above 768px via the
 * `.mobile-tabbar` class in globals.css. The 3 primary destinations match the
 * sidebar's SIDEBAR_ITEMS. When the user is inside the Projets workspace a
 * secondary lens strip (Liste/Planning/Calendrier/Kanban) floats just above the
 * tab bar so those three previously-orphaned views are reachable on mobile too.
 */
export function MobileNav() {
  const pathname = usePathname();
  const activeKey = sidebarKeyForPath(pathname);
  const activeLens = workspaceLensForPath(pathname);

  // The lens strip is a mobile-only affordance (the sidebar's expandable group +
  // header switcher cover desktop). The bottom tab bar shows ≤768px via CSS;
  // mirror that breakpoint here so the strip never leaks onto desktop. Avoids
  // adding CSS (globals.css is owned elsewhere).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const showLenses = isMobile && isWorkspacePath(pathname);

  return (
    <>
      {showLenses ? (
        <nav
          aria-label="Vue des projets"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: "calc(60px + env(safe-area-inset-bottom))",
            zIndex: 40,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "8px 12px",
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(10px) saturate(1.4)",
            WebkitBackdropFilter: "blur(10px) saturate(1.4)",
            borderTop: `1px solid ${C.line}`,
          }}
        >
          {WORKSPACE_VIEWS.map((v) => {
            const active = v.key === activeLens;
            return (
              <Link
                key={v.key}
                href={v.href}
                aria-current={active ? "page" : undefined}
                className="state-layer"
                style={{
                  flexShrink: 0,
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  padding: "0 14px",
                  borderRadius: R.pill,
                  minHeight: 40, // Fitts: comfortable mobile lens target
                  display: "inline-flex",
                  alignItems: "center",
                  // Calm active state, consistent with sidebar/header switcher:
                  // a quiet neutral pill (no green) so only ONE accent is spent.
                  // Inactive lenses are unboxed text — less ink, less clutter.
                  border: `1px solid ${active ? C.line : "transparent"}`,
                  background: active ? C.surface : "transparent",
                  color: active ? C.ink900 : C.ink500,
                  boxShadow: active ? SH.sm : "none",
                  transition: `background ${DUR.fast} ${EASE.standard}, color ${DUR.fast} ${EASE.standard}`,
                  whiteSpace: "nowrap",
                }}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

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
                // Consistent with sidebar: the green accent lives on the icon; the
                // label is neutral ink so the active tab reads calm, not coloured.
                color: active ? C.ink900 : C.ink500,
                fontWeight: active ? 600 : 500,
                transition: `color ${DUR.base} ${EASE.standard}`,
              }}
            >
              <span style={{ display: "flex", color: active ? "var(--selected)" : C.ink500, transition: `color ${DUR.base} ${EASE.standard}` }}>
                <Icon size={21} />
              </span>
              <span style={{ ...TX.nano, fontWeight: "inherit", whiteSpace: "nowrap" }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
