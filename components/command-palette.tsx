"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { NAV_ICONS, SearchIcon } from "./icons";
import { Avatar } from "./ui";
import { NAV_ITEMS } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, DUR, EASE, R, SH, STATUS_META, TX } from "@/lib/tokens";
import { STATUSES } from "@/lib/types";

type Category = "Actions" | "Projets" | "Personnes" | "Vues";

interface Cmd {
  id: string;
  label: string;
  sub?: string;
  cat: Category;
  /** Extra haystack terms for matching (kept out of the visible label). */
  keywords?: string;
  leading: React.ReactNode;
  run: () => void;
}

/** Open the palette from anywhere (e.g. the header launcher). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("setec:command"));
}

/** Order the category headers render in. */
const CAT_ORDER: Category[] = ["Actions", "Projets", "Personnes", "Vues"];

const dot = (color: string) => (
  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

/** Consistent keyboard-hint chip, matching the header launcher's kbd. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{ ...TX.nano, color: C.ink600, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: R.xs, padding: "1px 5px", fontFamily: "inherit", minWidth: "1.6ch", textAlign: "center", lineHeight: 1.4 }}>
      {children}
    </kbd>
  );
}

/** True when focus is in a field the user is typing into — global single-key
 *  shortcuts must stay quiet there so typing is never hijacked. */
function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function CommandPalette() {
  const {
    allDerived, team, selected, selectedIds,
    openProject, setSearch, openAdd,
    savedViews, applyView, resetFilters,
    setStatus, advancePhase, updateProject,
    bulkSetStatus, bulkAdvancePhase, bulkSetResponsable,
    clearSelected,
  } = useProjects();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- global key handling: ⌘K, Esc, and light single-key shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); return; }
      if (e.key === "Escape") { setOpen(false); return; }

      // Single-key shortcuts: never while typing, never with a modifier, never
      // when the palette itself is open (it owns the keyboard then).
      if (open || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "n") { e.preventDefault(); openAdd(); }
      else if (e.key === "/") {
        e.preventDefault();
        // Focus the Projets search if present; else fall back to opening the palette.
        const search = document.querySelector<HTMLInputElement>('input[data-projets-search]');
        if (search) search.focus();
        else setOpen(true);
      }
      else if (e.key === "?") { e.preventDefault(); setOpen(true); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("setec:command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("setec:command", onOpen); };
  }, [open, openAdd]);

  useEffect(() => {
    if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const close = (fn: () => void) => () => { fn(); setOpen(false); };
    const list: Cmd[] = [];

    // ── Contextual actions on the current selection / open project (top group) ──
    const ids = [...selectedIds];
    if (ids.length > 0) {
      const n = ids.length;
      const scope = `${n} projet${n > 1 ? "s" : ""}`;
      for (const s of STATUSES) {
        list.push({
          id: `ctx-status-${s}`, cat: "Actions", label: `Statut « ${STATUS_META[s].label} »`,
          sub: `Actions sur ${scope}`, keywords: "statut selection bulk",
          leading: dot(STATUS_META[s].color),
          run: close(() => { bulkSetStatus(ids, s); clearSelected(); }),
        });
      }
      list.push({
        id: "ctx-advance", cat: "Actions", label: "Avancer la phase",
        sub: `Actions sur ${scope}`, keywords: "phase avancer selection bulk",
        leading: <span style={{ color: C.ink500, display: "flex", fontWeight: 600 }}>→</span>,
        run: close(() => { bulkAdvancePhase(ids); clearSelected(); }),
      });
      for (const m of team) {
        list.push({
          id: `ctx-resp-${m.id}`, cat: "Actions", label: `Réassigner à ${m.name}`,
          sub: `Actions sur ${scope}`, keywords: "responsable reassigner selection bulk",
          leading: <Avatar initials={m.initials} color={m.color} size={20} fontSize={9} />,
          run: close(() => { bulkSetResponsable(ids, m.id); clearSelected(); }),
        });
      }
      list.push({
        id: "ctx-clear", cat: "Actions", label: "Désélectionner tout",
        sub: `Actions sur ${scope}`, keywords: "deselectionner clear",
        leading: <span style={{ color: C.ink500, display: "flex", fontWeight: 600 }}>×</span>,
        run: close(clearSelected),
      });
    } else if (selected) {
      const p = selected;
      const scope = `« ${p.name} »`;
      for (const s of STATUSES) {
        list.push({
          id: `ctx-status-${s}`, cat: "Actions", label: `Statut « ${STATUS_META[s].label} »`,
          sub: `Actions sur ${scope}`, keywords: "statut",
          leading: dot(STATUS_META[s].color),
          run: close(() => setStatus(p.id, s)),
        });
      }
      list.push({
        id: "ctx-advance", cat: "Actions", label: "Avancer la phase",
        sub: `Actions sur ${scope}`, keywords: "phase avancer",
        leading: <span style={{ color: C.ink500, display: "flex", fontWeight: 600 }}>→</span>,
        run: close(() => advancePhase(p.id)),
      });
      for (const m of team) {
        list.push({
          id: `ctx-resp-${m.id}`, cat: "Actions", label: `Réassigner à ${m.name}`,
          sub: `Actions sur ${scope}`, keywords: "responsable reassigner",
          leading: <Avatar initials={m.initials} color={m.color} size={20} fontSize={9} />,
          run: close(() => updateProject(p.id, { responsableId: m.id })),
        });
      }
    }

    // ── Global verb actions ──
    list.push({
      id: "new", cat: "Actions", label: "Nouveau projet", sub: "Créer", keywords: "ajouter creer",
      leading: <span style={{ color: C.ink500, display: "flex", fontSize: 16, fontWeight: 600 }}>+</span>,
      run: close(openAdd),
    });
    list.push({
      id: "clear-filters", cat: "Actions", label: "Réinitialiser les filtres", sub: "Filtres",
      keywords: "reset filtres effacer",
      leading: <span style={{ color: C.ink500, display: "flex", fontWeight: 600 }}>×</span>,
      run: close(resetFilters),
    });

    // ── Navigation ──
    for (const it of NAV_ITEMS) {
      const Icon = NAV_ICONS[it.key];
      list.push({
        id: `nav-${it.key}`, cat: "Actions", label: it.label, sub: "Aller à la vue", keywords: "naviguer aller",
        leading: <span style={{ color: C.ink500, display: "flex" }}><Icon /></span>,
        run: close(() => router.push(it.href)),
      });
    }

    // ── Saved views ──
    for (const v of savedViews) {
      list.push({
        id: `view-${v.id}`, cat: "Vues", label: v.name, sub: "Appliquer la vue", keywords: "vue filtre",
        leading: <span style={{ color: C.ink500, display: "flex", fontWeight: 600 }}>▦</span>,
        run: close(() => applyView(v)),
      });
    }

    // ── Projects ──
    for (const p of allDerived) {
      list.push({
        id: `proj-${p.id}`, cat: "Projets", label: p.name, sub: `${p.client} · ${p.phaseLabel}`,
        keywords: p.discipline,
        leading: dot(p.statusColor),
        run: close(() => openProject(p.id)),
      });
    }

    // ── People ──
    for (const m of team) {
      list.push({
        id: `mem-${m.id}`, cat: "Personnes", label: m.name, sub: `${m.role} · voir ses projets`,
        keywords: "personne equipe",
        leading: <Avatar initials={m.initials} color={m.color} size={20} fontSize={9} />,
        run: close(() => { setSearch(m.name); router.push("/projets"); }),
      });
    }

    return list;
  }, [
    allDerived, team, selected, selectedIds, savedViews,
    router, openProject, setSearch, openAdd, applyView, resetFilters,
    setStatus, advancePhase, updateProject, bulkSetStatus, bulkAdvancePhase, bulkSetResponsable, clearSelected,
  ]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) {
      // No query: lead with contextual actions, then a scannable slice across groups.
      const ctx = cmds.filter((c) => c.id.startsWith("ctx-"));
      const rest = cmds.filter((c) => !c.id.startsWith("ctx-"));
      return [...ctx.slice(0, 6), ...rest.slice(0, 9)].slice(0, 14);
    }
    // Simple fuzzy: every whitespace-separated term must appear in the haystack.
    const terms = s.split(/\s+/);
    return cmds
      .filter((c) => {
        const hay = `${c.label} ${c.sub ?? ""} ${c.keywords ?? ""}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 24);
  }, [cmds, q]);

  // Render grouped by category, preserving CAT_ORDER. Build a flat index map so
  // ↑↓/↵ still operate on a single linear list across headers.
  const grouped = useMemo(() => {
    const out: { cat: Category; items: { cmd: Cmd; index: number }[] }[] = [];
    results.forEach((cmd, index) => {
      let bucket = out.find((b) => b.cat === cmd.cat);
      if (!bucket) { bucket = { cat: cmd.cat, items: [] }; out.push(bucket); }
      bucket.items.push({ cmd, index });
    });
    out.sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));
    return out;
  }, [results]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const run = (i: number) => results[i]?.run();

  return (
    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.34)", zIndex: 80, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", animation: "fadeIn .14s ease" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Recherche rapide" style={{ width: 560, maxWidth: "92%", background: C.surface, borderRadius: R.lg, boxShadow: SH.lg, overflow: "hidden", animation: "popIn .18s cubic-bezier(.2,.7,.2,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.line}`, color: C.ink400 }}>
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); run(active); }
            }}
            placeholder="Rechercher ou exécuter une action…"
            style={{ flex: 1, border: "none", padding: 0, fontSize: 15, outline: "none", color: C.ink900, fontFamily: "inherit", background: "transparent" }}
          />
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ ...TX.caption, color: C.ink500, padding: "22px", textAlign: "center" }}>Aucun résultat</div>
          ) : (
            grouped.map((group) => (
              <div key={group.cat}>
                <div style={{ ...TX.eyebrow, color: C.ink500, padding: "10px 12px 4px" }}>{group.cat}</div>
                {group.items.map(({ cmd: it, index: i }) => {
                  const sel = i === active;
                  return (
                  <button
                    key={it.id}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(i)}
                    aria-selected={sel}
                    style={{ position: "relative", width: "100%", display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: "9px 12px", borderRadius: R.sm, border: "none", cursor: "pointer", background: sel ? C.brand50 : "transparent", transition: `background ${DUR.fast} ${EASE.standard}` }}
                  >
                    <span aria-hidden style={{ position: "absolute", left: 3, top: "50%", transform: `translateY(-50%) scaleY(${sel ? 1 : 0})`, width: 3, height: 16, borderRadius: R.pill, background: C.brand, transition: `transform ${DUR.fast} ${EASE.out}` }} />
                    <span style={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0 }}>{it.leading}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ ...TX.bodyStrong, color: C.ink900, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                      {it.sub ? <span style={{ ...TX.micro, color: C.ink500, display: "block" }}>{it.sub}</span> : null}
                    </span>
                  </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div style={{ display: "flex", gap: 16, padding: "8px 14px", borderTop: `1px solid ${C.line}`, ...TX.micro, color: C.ink500 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Kbd>↑</Kbd><Kbd>↓</Kbd>naviguer</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Kbd>↵</Kbd>exécuter</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Kbd>échap</Kbd>fermer</span>
        </div>
      </div>
    </div>
  );
}
