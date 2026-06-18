"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ICONS } from "./icons";
import { signOutAction } from "@/app/actions";
import { NAV_ITEMS, navItemForPath } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";

export function Sidebar() {
  const pathname = usePathname();
  const activeKey = navItemForPath(pathname).key;
  const { serverBacked } = useProjects();

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: "#1D4459",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        position: "sticky",
        top: 46,
        height: "calc(100vh - 46px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 1,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-.03em",
          padding: "4px 8px 2px",
        }}
      >
        <span>setec</span>
        <span style={{ color: "#3FA535" }}>.</span>
      </div>
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: "#7FA0A3",
          fontWeight: 600,
          padding: "0 8px 18px",
        }}
      >
        Direction technique
      </div>

      <nav style={{ display: "flex", flexDirection: "column" }}>
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
                textAlign: "left",
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                padding: "8px 10px",
                borderRadius: 3,
                marginBottom: 2,
                color: active ? "#fff" : "#A9C2C2",
                background: active ? "rgba(255,255,255,.13)" : "transparent",
                borderLeft: `3px solid ${active ? "#3FA535" : "transparent"}`,
              }}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 8px 4px",
          borderTop: "1px solid rgba(255,255,255,.12)",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#3FA535",
            color: "#0E2A18",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          PD
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>P. Dubois</div>
          <div style={{ fontSize: 11, color: "#7FA0A3" }}>Directrice de projets</div>
        </div>
      </div>

      {serverBacked ? (
        <form action={signOutAction} style={{ padding: "2px 8px 0" }}>
          <button
            type="submit"
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#7FA0A3",
              fontSize: 12,
              fontWeight: 500,
              padding: "6px 0",
            }}
          >
            Se déconnecter
          </button>
        </form>
      ) : null}
    </aside>
  );
}
