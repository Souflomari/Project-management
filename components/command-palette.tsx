"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { NAV_ICONS, SearchIcon } from "./icons";
import { Avatar } from "./ui";
import { NAV_ITEMS } from "@/lib/nav";
import { useProjects } from "@/lib/store/projects-context";
import { C, R, SH, TX } from "@/lib/tokens";

interface Cmd {
  id: string;
  label: string;
  sub?: string;
  leading: React.ReactNode;
  run: () => void;
}

/** Open the palette from anywhere (e.g. the header launcher). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("setec:command"));
}

export function CommandPalette() {
  const { allDerived, team, openProject, setSearch, openAdd } = useProjects();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("setec:command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("setec:command", onOpen); };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const close = (fn: () => void) => () => { fn(); setOpen(false); };
    const navCmds: Cmd[] = NAV_ITEMS.map((n) => {
      const Icon = NAV_ICONS[n.key];
      return { id: `nav-${n.key}`, label: n.label, sub: "Aller à la vue", leading: <span style={{ color: C.ink500, display: "flex" }}><Icon /></span>, run: close(() => router.push(n.href)) };
    });
    const action: Cmd = { id: "new", label: "Nouveau projet", sub: "Créer", leading: <span style={{ color: C.ink500, display: "flex", fontSize: 16, fontWeight: 600 }}>+</span>, run: close(openAdd) };
    const projCmds: Cmd[] = allDerived.map((p) => ({
      id: `proj-${p.id}`,
      label: p.name,
      sub: `${p.client} · ${p.phaseLabel}`,
      leading: <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.statusColor, flexShrink: 0 }} />,
      run: close(() => openProject(p.id)),
    }));
    const memCmds: Cmd[] = team.map((m) => ({
      id: `mem-${m.id}`,
      label: m.name,
      sub: `${m.role} · voir ses projets`,
      leading: <Avatar initials={m.initials} color={m.color} size={20} fontSize={9} />,
      run: close(() => { setSearch(m.name); router.push("/projets"); }),
    }));
    return [action, ...navCmds, ...projCmds, ...memCmds];
  }, [allDerived, team, router, openProject, setSearch, openAdd]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cmds.slice(0, 7);
    return cmds.filter((c) => `${c.label} ${c.sub ?? ""}`.toLowerCase().includes(s)).slice(0, 12);
  }, [cmds, q]);

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
            placeholder="Rechercher un projet, une personne, une vue…"
            style={{ flex: 1, border: "none", padding: 0, fontSize: 15, outline: "none", color: C.ink900, fontFamily: "inherit", background: "transparent" }}
          />
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ ...TX.caption, color: C.ink500, padding: "22px", textAlign: "center" }}>Aucun résultat</div>
          ) : (
            results.map((it, i) => (
              <button
                key={it.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(i)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: "9px 12px", borderRadius: R.sm, border: "none", cursor: "pointer", background: i === active ? C.subtle : "transparent" }}
              >
                <span style={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0 }}>{it.leading}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ ...TX.bodyStrong, color: C.ink900, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                  {it.sub ? <span style={{ ...TX.micro, color: C.ink500, display: "block" }}>{it.sub}</span> : null}
                </span>
              </button>
            ))
          )}
        </div>
        <div style={{ display: "flex", gap: 14, padding: "8px 14px", borderTop: `1px solid ${C.line}`, ...TX.micro, color: C.ink400 }}>
          <span>↑ ↓ naviguer</span><span>↵ ouvrir</span><span>échap fermer</span>
        </div>
      </div>
    </div>
  );
}
