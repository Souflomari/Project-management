"use client";

// Client body of /projets/[id] (the route file is a server component that 404s
// unknown ids in Supabase mode before this renders).

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  ProjectBudget,
  ProjectComments,
  ProjectIdentity,
  ProjectProperties,
  ProjectTasks,
} from "./project-detail";
import { Skeleton } from "./skeleton";
import { sampleRepository } from "@/lib/data";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, TX } from "@/lib/tokens";

// Main-column tabs (the right rail — properties + EVM — is always visible).
const TABS = [
  { key: "taches", label: "Tâches & planning" },
  { key: "activite", label: "Activité" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const isTab = (v: string | null): v is TabKey => TABS.some((t) => t.key === v);

export function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = Number(rawId);
  const { allDerived, serverBacked } = useProjects();
  const p = allDerived.find((x) => x.id === id) ?? null;
  const idBase = useId();

  // Sample (demo) mode: projects created in this browser live in localStorage,
  // which the server-rendered seed doesn't know about. Until the store has
  // re-hydrated, "not in the list" means "not loaded yet" — so ask the browser
  // repository directly and only declare the project missing when IT has none.
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (p || serverBacked || !Number.isInteger(id)) return;
    let alive = true;
    sampleRepository.getProject(id).then((found) => { if (alive && !found) setMissing(true); }).catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [p, serverBacked, id]);
  const notFound = !p && (serverBacked || missing || !Number.isInteger(id));

  // Active tab synced to the URL (?onglet=…), shareable + refresh-proof. A URL
  // change (back/forward, drawer deep link) is adopted during render.
  const urlTab = searchParams.get("onglet");
  const [tab, setTab] = useState<TabKey>(isTab(urlTab) ? urlTab : "taches");
  const [seenUrlTab, setSeenUrlTab] = useState(urlTab);
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab);
    if (isTab(urlTab)) setTab(urlTab);
  }

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

  if (!p && notFound) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {back}
        <h1 style={{ ...TX.h2, color: C.ink900, margin: 0 }}>Projet introuvable</h1>
        <p style={{ ...TX.body, color: C.ink500, marginTop: 6 }}>Ce projet n&apos;existe pas ou a été supprimé.</p>
      </div>
    );
  }

  if (!p) {
    // Still hydrating the browser copy (sample mode) — hold the layout.
    return (
      <div style={{ maxWidth: 1120, margin: "0 auto" }} aria-busy="true" aria-label="Chargement du projet">
        {back}
        <Skeleton w="min(420px, 70%)" h={30} r={8} />
        <Skeleton w={220} h={14} style={{ marginTop: 10 }} />
        <div className="detail-grid" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton h={38} />
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={40} />)}
          </div>
          <Skeleton h={420} r={12} />
        </div>
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
      {/* Stacks below 900px (globals.css `.detail-grid`). */}
      <div className="detail-grid" style={{ marginTop: 24 }}>
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
                  id={`${idBase}-tab-${t.key}`}
                  aria-controls={`${idBase}-panel`}
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTab(t.key)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className="btn"
                  style={{
                    ...TX.bodyStrong,
                    fontSize: 14,
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

          <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${tab}`} style={{ paddingTop: 22 }}>
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
