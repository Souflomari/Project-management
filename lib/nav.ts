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

export function navItemForPath(pathname: string): NavItem {
  const exact = NAV_ITEMS.find((n) => n.href === pathname);
  if (exact) return exact;
  const match = NAV_ITEMS.find((n) => n.href !== "/" && pathname.startsWith(n.href));
  return match ?? NAV_ITEMS[0];
}
