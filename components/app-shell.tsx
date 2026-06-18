"use client";

import type { ReactNode } from "react";

import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { ProjectDrawer } from "./drawer";
import { AddProjectModal } from "./add-project-modal";
import { WEEK_LABEL } from "@/lib/format";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0E0F12" }}>
      {/* Top brand bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 46,
          padding: "0 18px",
          background: "#0E0F12",
          color: "#fff",
          borderBottom: "1px solid #23262D",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            fontSize: 11,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "#8B93A0",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#3FA535",
              display: "inline-block",
            }}
          />
          Setec · Pilotage des projets
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "#8B93A0",
            fontWeight: 600,
          }}
        >
          {WEEK_LABEL}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          minHeight: "calc(100vh - 46px)",
          background: "#EFF2EC",
          color: "#233038",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Header />
          <div style={{ padding: "18px 22px 46px" }}>{children}</div>
        </div>
      </div>

      <ProjectDrawer />
      <AddProjectModal />
    </div>
  );
}
