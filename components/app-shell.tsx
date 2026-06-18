"use client";

import type { ReactNode } from "react";

import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { ProjectDrawer } from "./drawer";
import { AddProjectModal } from "./add-project-modal";
import { C } from "@/lib/tokens";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.canvas, color: C.ink900, fontVariantNumeric: "tabular-nums" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header />
        <div style={{ padding: "20px 24px 48px" }}>{children}</div>
      </div>

      <ProjectDrawer />
      <AddProjectModal />
    </div>
  );
}
