"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { ProjectDrawer } from "./drawer";
import { AddProjectModal } from "./add-project-modal";
import { CommandPalette } from "./command-palette";
import { Toaster } from "./toaster";
import { C, R, TX, Z } from "@/lib/tokens";

// Visually-hidden until focused. Inline styles can't express `:focus`, so the
// link swaps to an on-canvas pill via onFocus/onBlur. Kept as the first DOM node
// so it's the first thing keyboard users reach.
const HIDDEN: CSSProperties = {
  position: "fixed",
  top: 8,
  left: 8,
  width: 1,
  height: 1,
  padding: 0,
  margin: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
  zIndex: Z.toast + 1,
};

const VISIBLE: CSSProperties = {
  position: "fixed",
  top: 12,
  left: 12,
  width: "auto",
  height: "auto",
  clip: "auto",
  padding: "9px 14px",
  margin: 0,
  overflow: "visible",
  whiteSpace: "nowrap",
  ...TX.bodyStrong,
  color: "#fff",
  background: C.solid,
  borderRadius: R.sm,
  textDecoration: "none",
  boxShadow: "var(--sh-overlay, 0 8px 28px rgba(28,25,23,.16))",
  zIndex: Z.toast + 1,
};

function SkipLink() {
  const [focused, setFocused] = useState(false);
  return (
    <a
      href="#main"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={focused ? VISIBLE : HIDDEN}
    >
      Aller au contenu
    </a>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: C.canvas, color: C.ink900, fontVariantNumeric: "tabular-nums" }}>
      {/* Skip link: first focusable element; visually hidden until focused. */}
      <SkipLink />
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header />
        <main id="main" className="app-main" style={{ maxWidth: 1520, width: "100%", margin: "0 auto" }}>{children}</main>
      </div>

      <MobileNav />
      <ProjectDrawer />
      <AddProjectModal />
      <CommandPalette />
      <Toaster />
    </div>
  );
}
