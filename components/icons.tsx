// Line icons ported from the design (24×24 viewBox, currentColor stroke).

import type { ViewKey } from "@/lib/nav";

type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
});

export function DashIcon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ProjetsIcon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3.5" y1="6" x2="3.5" y2="6" />
      <line x1="3.5" y1="12" x2="3.5" y2="12" />
      <line x1="3.5" y1="18" x2="3.5" y2="18" />
    </svg>
  );
}

export function PlanningIcon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="11" height="3.5" rx="1.5" />
      <rect x="7" y="10.5" width="14" height="3.5" rx="1.5" />
      <rect x="3" y="16" width="9" height="3.5" rx="1.5" />
    </svg>
  );
}

export function CalendrierIcon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2.5" x2="8" y2="6" />
      <line x1="16" y1="2.5" x2="16" y2="6" />
    </svg>
  );
}

export function KanbanIcon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
      <rect x="16" y="4" width="5" height="14" rx="1.5" />
    </svg>
  );
}

export function EquipeIcon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17.5" cy="8.5" r="2.6" />
      <path d="M16 14.2c2.6.2 4.5 2.1 4.5 4.8" />
    </svg>
  );
}

export function SearchIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#6F6F6F" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

export const NAV_ICONS: Record<ViewKey, (p: IconProps) => React.ReactNode> = {
  dash: DashIcon,
  projets: ProjetsIcon,
  planning: PlanningIcon,
  calendrier: CalendrierIcon,
  kanban: KanbanIcon,
  equipe: EquipeIcon,
};
