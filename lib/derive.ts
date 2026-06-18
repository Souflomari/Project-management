// View-model derivation: turns domain data into ready-to-render values
// (labels, formatted dates, colours, positions). Pure + UI-agnostic so it can
// be unit-tested and reused. Mirrors the design's renderVals() computations.

import {
  daysFromToday,
  dueLabel,
  dueLabelFull,
  fmtBudget,
  fmtFull,
  fmtShort,
  MONS,
  MONS_LONG,
  REFERENCE_DATE,
  REFERENCE_TS,
  toDate,
} from "./format";
import { PHASES, PHASES_FULL, type Project, type Status, type TeamMember } from "./types";
import { dueColor, ringColor, STATUS_META } from "./tokens";

export interface DerivedProject extends Project {
  phaseLabel: string;
  phaseFull: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  /** Colour for progress bars / gantt fills / donut rings. */
  ring: string;
  responsable: TeamMember;
  members: TeamMember[];
  budgetFmt: string;
  /** Next deliverable, short date "18 juin". */
  renduFmt: string;
  /** Next deliverable, full date "18 juin 2026". */
  renduFull: string;
  renduDay: number;
  renduMon: string;
  renduDays: number;
  renduDaysLabel: string;
  renduDueColor: string;
  deadlineFull: string;
  deadlineDaysLabel: string;
}

export function deriveProject(p: Project, team: TeamMember[]): DerivedProject {
  const meta = STATUS_META[p.status];
  const renduDays = daysFromToday(p.rendu.date);
  const rdate = toDate(p.rendu.date);
  const responsable =
    team.find((m) => m.id === p.responsableId) ?? team[0];
  const members = p.memberIds
    .map((id) => team.find((m) => m.id === id))
    .filter((m): m is TeamMember => Boolean(m));

  return {
    ...p,
    phaseLabel: PHASES[p.phaseIndex],
    phaseFull: PHASES_FULL[p.phaseIndex],
    statusLabel: meta.label,
    statusColor: meta.color,
    statusBg: meta.bg,
    ring: ringColor(p.status),
    responsable,
    members,
    budgetFmt: fmtBudget(p.budget),
    renduFmt: fmtShort(p.rendu.date),
    renduFull: fmtFull(p.rendu.date),
    renduDay: rdate.getDate(),
    renduMon: MONS[rdate.getMonth()],
    renduDays,
    renduDaysLabel: p.renduDone ? "Livré ✓" : dueLabel(renduDays),
    renduDueColor: dueColor(renduDays, p.renduDone),
    deadlineFull: fmtFull(p.deadline),
    deadlineDaysLabel: dueLabelFull(daysFromToday(p.deadline)),
  };
}

export function deriveAll(projects: Project[], team: TeamMember[]): DerivedProject[] {
  return projects.map((p) => deriveProject(p, team));
}

// ---------------------------------------------------------------- dashboard

export function upcomingRendus(all: DerivedProject[], limit = 7): DerivedProject[] {
  return all
    .filter((p) => !p.renduDone)
    .sort((a, b) => toDate(a.rendu.date).getTime() - toDate(b.rendu.date).getTime())
    .slice(0, limit);
}

export function vigilanceAlerts(all: DerivedProject[], limit = 6): DerivedProject[] {
  return all
    .filter((p) => p.status === "en retard" || p.status === "à risque")
    .sort(
      (a, b) =>
        (a.status === "en retard" ? 0 : 1) - (b.status === "en retard" ? 0 : 1),
    )
    .slice(0, limit);
}

export interface Kpis {
  active: number;
  rendus: number;
  late: number;
  avg: number;
  budgetFmt: string;
  total: number;
}

export function computeKpis(all: DerivedProject[]): Kpis {
  const active = all.filter((p) => p.status !== "terminé").length;
  const rendus = all.filter(
    (p) => !p.renduDone && p.renduDays >= 0 && p.renduDays <= 6,
  ).length;
  const late = all.filter((p) => p.status === "en retard").length;
  const avg = all.length
    ? Math.round(all.reduce((s, p) => s + p.progress, 0) / all.length)
    : 0;
  const budgetFmt = fmtBudget(all.reduce((s, p) => s + p.budget, 0));
  return { active, rendus, late, avg, budgetFmt, total: all.length };
}

// ------------------------------------------------------------------- gantt

const GANTT_START = toDate("2026-01-01").getTime();
const GANTT_END = toDate("2027-06-30").getTime();
const GANTT_SPAN = GANTT_END - GANTT_START;
const pctOf = (ts: number) => ((ts - GANTT_START) / GANTT_SPAN) * 100;

export interface GanttMonth {
  label: string;
  left: number;
  width: number;
}

export interface GanttRow {
  id: number;
  name: string;
  responsable: string;
  /** bar geometry, percentages of the timeline width */
  left: number;
  width: number;
  color: string;
  /** progress fill, percentage of the bar */
  fill: number;
  /** rendu marker position (percent), or null when off-range */
  markerLeft: number | null;
}

export interface GanttData {
  months: GanttMonth[];
  rows: GanttRow[];
  todayLeft: number;
}

export function buildGantt(filtered: DerivedProject[]): GanttData {
  const months: GanttMonth[] = [];
  for (let i = 0; i < 18; i++) {
    const y = 2026 + Math.floor(i / 12);
    const m = i % 12;
    const ms = new Date(y, m, 1).getTime();
    const me = new Date(y, m + 1, 1).getTime();
    months.push({
      label: MONS[m] + (m === 0 ? ` '${String(y).slice(2)}` : ""),
      left: pctOf(ms),
      width: ((me - ms) / GANTT_SPAN) * 100,
    });
  }

  const rows: GanttRow[] = filtered.map((p) => {
    const s = Math.max(toDate(p.start).getTime(), GANTT_START);
    const e = Math.min(toDate(p.deadline).getTime(), GANTT_END);
    const left = pctOf(s);
    const width = Math.max(1.4, ((e - s) / GANTT_SPAN) * 100);
    const mk = pctOf(toDate(p.rendu.date).getTime());
    return {
      id: p.id,
      name: p.name,
      responsable: p.responsable.name,
      left,
      width,
      color: p.ring,
      fill: p.progress,
      markerLeft: mk >= 0 && mk <= 100 ? mk : null,
    };
  });

  return { months, rows, todayLeft: pctOf(REFERENCE_TS) };
}

// ---------------------------------------------------------------- calendar

export interface CalEvent {
  projectId: number;
  label: string;
  color: string;
  bg: string;
}

export interface CalCell {
  day: number | null;
  isToday: boolean;
  events: CalEvent[];
}

export interface CalendarData {
  cells: CalCell[];
  label: string;
}

const [REF_Y, REF_M, REF_D] = REFERENCE_DATE.split("-").map(Number);

export function buildCalendar(
  year: number,
  month: number,
  all: DerivedProject[],
): CalendarData {
  const first = new Date(year, month, 1);
  const startW = (first.getDay() + 6) % 7; // Monday-based
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: CalCell[] = [];

  for (let i = 0; i < startW; i++) {
    cells.push({ day: null, isToday: false, events: [] });
  }
  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const events: CalEvent[] = all
      .filter((p) => p.rendu.date === iso)
      .map((p) => ({
        projectId: p.id,
        label: p.rendu.label,
        color: p.statusColor,
        bg: p.statusBg,
      }));
    cells.push({
      day: d,
      isToday: year === REF_Y && month === REF_M - 1 && d === REF_D,
      events,
    });
  }
  return { cells, label: `${MONS_LONG[month]} ${year}` };
}

// ------------------------------------------------------------------ kanban

export interface KanbanColumn {
  phaseIndex: number;
  label: string;
  count: number;
  cards: DerivedProject[];
}

export function buildKanban(filtered: DerivedProject[]): KanbanColumn[] {
  return PHASES.map((label, i) => {
    const cards = filtered.filter((p) => p.phaseIndex === i);
    return { phaseIndex: i, label, count: cards.length, cards };
  });
}

// -------------------------------------------------------------------- team

export interface TeamLoad {
  member: TeamMember;
  active: number;
  budgetFmt: string;
  loadPct: number;
  projects: { id: number; short: string }[];
}

export function buildTeamLoad(all: DerivedProject[], team: TeamMember[]): TeamLoad[] {
  const activeCountFor = (id: number) =>
    all.filter((p) => p.responsableId === id && p.status !== "terminé").length;
  const maxActive = Math.max(1, ...team.map((m) => activeCountFor(m.id)));

  return team.map((member) => {
    const mine = all.filter((p) => p.responsableId === member.id);
    const active = mine.filter((p) => p.status !== "terminé").length;
    const budget = mine.reduce((s, p) => s + p.budget, 0);
    return {
      member,
      active,
      budgetFmt: fmtBudget(budget),
      loadPct: Math.round((active / maxActive) * 100),
      projects: mine.slice(0, 5).map((p) => ({
        id: p.id,
        short: p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name,
      })),
    };
  });
}

// ----------------------------------------------------------------- filters

export interface FilterDef {
  key: "all" | Status;
  label: string;
  count: number;
  active: boolean;
}

export function buildFilters(
  searched: DerivedProject[],
  current: "all" | Status,
): FilterDef[] {
  const cnt = (k: Status) => searched.filter((p) => p.status === k).length;
  const defs: { key: "all" | Status; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: searched.length },
    { key: "à jour", label: "À jour", count: cnt("à jour") },
    { key: "à risque", label: "À risque", count: cnt("à risque") },
    { key: "en retard", label: "En retard", count: cnt("en retard") },
    { key: "terminé", label: "Terminés", count: cnt("terminé") },
  ];
  return defs.map((d) => ({ ...d, active: d.key === current }));
}
