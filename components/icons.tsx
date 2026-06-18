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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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

// ── action icons (stroke, currentColor)

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
export function ChevronLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}
export function ChevronRightIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}
export function CaretDownIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
export function EditIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
export function TrashIcon({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
export function FlagIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
export function MinusIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
