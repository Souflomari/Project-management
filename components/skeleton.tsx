"use client";

import { usePathname } from "next/navigation";

import { NAV_ICONS } from "./icons";
import { NAV_ITEMS, navItemForPath } from "@/lib/nav";
import { C, FONT_DISPLAY, R } from "@/lib/tokens";

/** A single shimmering placeholder block. */
export function Skeleton({ w, h, r = 6, style, className }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties; className?: string }) {
  return <div className={className ? `skeleton ${className}` : "skeleton"} style={{ width: w ?? "100%", height: h ?? 14, borderRadius: r, ...style }} />;
}

function SkelCard({ children, padding = 18 }: { children?: React.ReactNode; padding?: number }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, padding }}>{children}</div>
  );
}

/** Full-app loading state shown while the server fetches projects/team.
 *  Mirrors the real shell (sidebar + header) so the swap-in is seamless. */
export function AppSkeleton() {
  const pathname = usePathname();
  const item = navItemForPath(pathname);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.canvas, color: C.ink900 }}>
      {/* static sidebar shell */}
      <aside
        className="app-sidebar"
        style={{ width: 232, flexShrink: 0, background: C.canvas, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", padding: "20px 12px 16px", position: "sticky", top: 0, height: "100vh" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 19, fontWeight: 600, fontFamily: FONT_DISPLAY, letterSpacing: "-.02em", color: C.ink900, padding: "2px 10px 0" }}>
          <span className="rail-hide">setec</span>
          <span style={{ color: C.brandDot }}>.</span>
        </div>
        <div className="rail-hide" style={{ height: 16 }} />
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
          {NAV_ITEMS.map((nav) => {
            const Icon = NAV_ICONS[nav.key];
            const active = nav.key === item.key;
            return (
              <div key={nav.key} className="app-nav-link" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: R.sm, background: active ? C.subtle : "transparent", color: C.ink400 }}>
                <span style={{ display: "flex", opacity: 0.5 }}><Icon /></span>
                <span className="rail-hide"><Skeleton w={72} h={9} r={4} /></span>
              </div>
            );
          })}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* header shell */}
        <header style={{ minHeight: 64, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, padding: "12px 28px" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: FONT_DISPLAY, color: C.ink900, letterSpacing: "-.02em" }}>{item.label}</div>
            <div style={{ marginTop: 7 }}><Skeleton w={120} h={9} r={4} /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton className="header-search" w={240} h={36} r={8} />
            <Skeleton w={132} h={36} r={8} />
          </div>
        </header>

        <div className="app-main" style={{ maxWidth: 1320, width: "100%", margin: "0 auto" }}>
          <ContentSkeleton viewKey={item.key} />
        </div>
      </div>
    </div>
  );
}

function ContentSkeleton({ viewKey }: { viewKey: string }) {
  switch (viewKey) {
    case "projets":
      return <TableSkeleton />;
    case "planning":
      return <GanttSkeleton />;
    case "calendrier":
      return <CalendarSkeleton />;
    case "equipe":
      return <CardsSkeleton />;
    case "kanban":
      return <KanbanSkeleton />;
    default:
      return <DashboardSkeleton />;
  }
}

function DashboardSkeleton() {
  return (
    <>
      <div className="dash-top" style={{ marginBottom: 20 }}>
        <div className="dash-hero">
          <SkelCard padding={20}>
            <Skeleton w={120} h={9} r={4} />
            <div style={{ marginTop: 16 }}><Skeleton w={120} h={40} /></div>
            <div style={{ marginTop: 22 }}><Skeleton h={8} r={999} /></div>
            <div style={{ marginTop: 28 }}><Skeleton h={34} /></div>
          </SkelCard>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkelCard key={i}>
            <Skeleton w={90} h={9} r={4} />
            <div style={{ marginTop: 14 }}><Skeleton w={70} h={28} /></div>
            <div style={{ marginTop: 12 }}><Skeleton w={110} h={9} r={4} /></div>
          </SkelCard>
        ))}
      </div>
      <div className="dash-bottom" style={{ alignItems: "start" }}>
        {[0, 1].map((c) => (
          <SkelCard key={c} padding={16}>
            <Skeleton w={160} h={14} />
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} h={30} />))}
            </div>
          </SkelCard>
        ))}
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} w={92} h={32} r={8} />))}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, overflow: "hidden" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <Skeleton w={18} h={18} r={4} />
            <div style={{ flex: 2 }}><Skeleton w="70%" /></div>
            <div style={{ flex: 1 }}><Skeleton w={60} h={20} r={999} /></div>
            <div style={{ flex: 1 }}><Skeleton w="80%" /></div>
            <div style={{ flex: 1 }}><Skeleton h={7} r={999} /></div>
            <Skeleton w={30} h={30} r={999} />
          </div>
        ))}
      </div>
    </>
  );
}

function GanttSkeleton() {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, overflow: "hidden" }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "13px 18px", borderTop: i ? `1px solid ${C.line}` : "none" }}>
          <div style={{ width: 220 }}><Skeleton w="80%" /></div>
          <div style={{ flex: 1, paddingLeft: `${(i % 4) * 12}%` }}><Skeleton w={`${30 + (i % 5) * 10}%`} h={16} r={4} /></div>
        </div>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Skeleton w={200} h={28} />
        <Skeleton w={120} h={28} r={8} style={{ marginLeft: "auto" }} />
      </div>
      <div className="cal-scroll">
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, overflow: "hidden", minWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} style={{ minHeight: 98, borderRight: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: 6 }}>
                <Skeleton w={18} h={18} r={999} />
                {i % 3 === 0 ? <div style={{ marginTop: 8 }}><Skeleton h={16} r={4} /></div> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function CardsSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px,100%),1fr))", gap: 18 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkelCard key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton w={42} h={42} r={999} />
            <div style={{ flex: 1 }}><Skeleton w="60%" /><div style={{ marginTop: 8 }}><Skeleton w="40%" h={9} r={4} /></div></div>
          </div>
          <div style={{ marginTop: 16 }}><Skeleton w={70} h={24} /></div>
          <div style={{ marginTop: 12, display: "flex", gap: 4 }}>
            {Array.from({ length: 5 }).map((_, j) => (<Skeleton key={j} h={42} r={4} />))}
          </div>
        </SkelCard>
      ))}
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ width: 256, flexShrink: 0, background: C.subtle, borderRadius: R.md, border: `1px solid ${C.line}`, padding: 12 }}>
          <Skeleton w="60%" h={13} />
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.md, padding: 12 }}>
                <Skeleton w="85%" />
                <div style={{ marginTop: 10 }}><Skeleton h={6} r={999} /></div>
                <div style={{ marginTop: 12 }}><Skeleton w={24} h={22} r={999} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
