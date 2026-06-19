"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ProjectBudget,
  ProjectComments,
  ProjectIdentity,
  ProjectProperties,
  ProjectTasks,
} from "@/components/project-detail";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, TX } from "@/lib/tokens";

// Main-column tabs (the right rail — properties + EVM — is always visible).
const TABS = [
  { key: "taches", label: "Tâches & planning" },
  { key: "activite", label: "Activité" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const { allDerived } = useProjects();
  const p = allDerived.find((x) => x.id === id) ?? null;

  // Active tab synced to the URL (?onglet=…), shareable + refresh-proof.
  const urlTab = searchParams.get("onglet");
  const initialTab: TabKey = TABS.some((t) => t.key === urlTab) ? (urlTab as TabKey) : "taches";
  const [tab, setTab] = useState<TabKey>(initialTab);
  useEffect(() => { if (TABS.some((t) => t.key === urlTab) && urlTab !== tab) setTab(urlTab as TabKey); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [urlTab]);

  const selectTab = useCallback((key: TabKey) => {
    setTab(key);
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    sp.set("onglet", key);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Roving arrow-key focus across the tablist.
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = TABS.length;
    const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "ArrowRight" ? (idx + 1) % n : (idx - 1 + n) % n;
    tabRefs.current[next]?.focus();
    selectTab(TABS[next].key);
  }, [selectTab]);

  const back = (
    <Link href="/projets" className="soft-hover" style={{ ...TX.caption, fontWeight: 600, color: C.ink500, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", margin: "0 0 14px -8px", borderRadius: R.sm }}>
      ← Projets
    </Link>
  );

  if (!p) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {back}
        <div style={{ ...TX.h2, color: C.ink900 }}>Projet introuvable</div>
        <p style={{ ...TX.body, color: C.ink500, marginTop: 6 }}>Ce projet n&apos;existe pas ou a été supprimé.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      {back}

      {/* Header: identity only. Status & phase are editable in the right rail —
          the header no longer duplicates them as static pills. */}
      <ProjectIdentity p={p} titleStyle={{ ...TX.display, color: C.ink900 }} />

      {/* Two-column workspace: main (tasks/activity) + right rail (properties + EVM). */}
      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 28, marginTop: 24, alignItems: "start" }}>
        {/* ── main column ── */}
        <div style={{ minWidth: 0 }}>
          <div role="tablist" aria-label="Sections du projet" style={{ display: "flex", gap: 6, borderBottom: `1px solid ${C.line}` }}>
            {TABS.map((t, i) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTab(t.key)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className="btn"
                  style={{
                    ...TX.bodyStrong,
                    fontSize: 13.5,
                    color: active ? C.ink900 : C.ink500,
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${active ? C.solid : "transparent"}`,
                    padding: "10px 8px",
                    marginBottom: -1,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ paddingTop: 22 }}>
            {tab === "taches" ? <ProjectTasks p={p} /> : null}
            {tab === "activite" ? <ProjectComments p={p} /> : null}
          </div>
        </div>

        {/* ── right rail ──
            Data-ink: one quiet container holds both property + budget sections,
            grouped by whitespace and divided by a single hairline rule rather
            than two competing bordered+shadowed boxes (box-in-box → calm list). */}
        <aside>
          {/* Static rail reads by a single hairline on the white field — no
              resting shadow (data-ink: depth is reserved for genuine lift). */}
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, padding: "20px 20px 22px" }}>
            <RailSection title="Propriétés">
              <ProjectProperties p={p} />
            </RailSection>
            <RailSection title="Honoraires et valeur acquise" divided>
              <ProjectBudget p={p} />
            </RailSection>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RailSection({ title, children, divided = false }: { title: string; children: React.ReactNode; divided?: boolean }) {
  return (
    <section style={divided ? { marginTop: 22, paddingTop: 22, borderTop: `1px solid ${C.line}` } : undefined}>
      <h3 style={{ ...TX.overline, color: C.ink700, margin: "0 0 16px" }}>{title}</h3>
      {children}
    </section>
  );
}
