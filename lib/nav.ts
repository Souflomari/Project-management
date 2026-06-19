// Navigation config shared by the sidebar and the header.

export type ViewKey =
  | "dash"
  | "projets"
  | "planning"
  | "calendrier"
  | "kanban"
  | "equipe";

export interface NavItem {
  key: ViewKey;
  href: string;
  label: string;
  /** Header subtitle. Empty for views whose subtitle is computed at runtime. */
  sub: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dash", href: "/", label: "Tableau de bord", sub: "" },
  { key: "projets", href: "/projets", label: "Projets", sub: "" },
  { key: "planning", href: "/planning", label: "Planning", sub: "" },
  { key: "calendrier", href: "/calendrier", label: "Calendrier", sub: "" },
  { key: "kanban", href: "/kanban", label: "Kanban", sub: "" },
  { key: "equipe", href: "/equipe", label: "Équipe", sub: "" },
];

// The four dataset views are lenses on ONE "Projets" workspace, not separate
// destinations. The sidebar shows three top-level entries; the workspace's
// lenses are switched from a header control.
export const WORKSPACE_KEYS: ViewKey[] = ["projets", "planning", "calendrier", "kanban"];

/** Top-level sidebar entries (the four dataset views collapse under "Projets"). */
export const SIDEBAR_ITEMS: NavItem[] = NAV_ITEMS.filter((n) => ["dash", "projets", "equipe"].includes(n.key));

/** Lenses of the Projets workspace, for the header view-switcher. */
export const WORKSPACE_VIEWS: { key: ViewKey; href: string; label: string }[] = [
  { key: "projets", href: "/projets", label: "Liste" },
  { key: "planning", href: "/planning", label: "Planning" },
  { key: "calendrier", href: "/calendrier", label: "Calendrier" },
  { key: "kanban", href: "/kanban", label: "Kanban" },
];

export function navItemForPath(pathname: string): NavItem {
  const exact = NAV_ITEMS.find((n) => n.href === pathname);
  if (exact) return exact;
  const match = NAV_ITEMS.find((n) => n.href !== "/" && pathname.startsWith(n.href));
  return match ?? NAV_ITEMS[0];
}

/** True when the path is one of the Projets workspace lenses. */
export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_KEYS.includes(navItemForPath(pathname).key);
}

/** Which top-level sidebar entry should read as active for a path. */
export function sidebarKeyForPath(pathname: string): ViewKey {
  return isWorkspacePath(pathname) ? "projets" : navItemForPath(pathname).key;
}

/** Which workspace lens (if any) is active. `null` outside the workspace. */
export function workspaceLensForPath(pathname: string): ViewKey | null {
  return isWorkspacePath(pathname) ? navItemForPath(pathname).key : null;
}

/**
 * A project detail route (`/projets/[id]`). The list lens is `/projets` exactly;
 * anything deeper under `/projets/` is a single-project page that wants a
 * breadcrumb and NO list-search/count chrome.
 */
export function isProjectDetailPath(pathname: string): boolean {
  return pathname.startsWith("/projets/") && pathname !== "/projets";
}

/** Routes for the account menu. `/parametres` is a minimal stub for now. */
export const ACCOUNT_ROUTES = {
  profil: "/parametres",
  parametres: "/parametres",
} as const;

// ── Recently-opened tracking (command-palette "Récents") ──────────────────
// A tiny, client-only ring buffer persisted to localStorage. Decoupled from the
// store so any surface (palette, header) can record/read without re-renders.

export interface RecentEntry {
  /** Stable id, e.g. `proj-12` or `nav-equipe`. */
  id: string;
  /** Unix ms of last access — newest first. */
  at: number;
}

const RECENTS_KEY = "setec:recents";
const RECENTS_MAX = 8;

export function readRecents(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecent(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const next: RecentEntry[] = [
      { id, at: Date.now() },
      ...readRecents().filter((r) => r.id !== id),
    ].slice(0, RECENTS_MAX);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are best-effort */
  }
}
