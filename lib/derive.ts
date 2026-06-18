// View-model derivation: turns domain data into ready-to-render values.
// Progress, the next deliverable, planning bars, calendar events and team
// workload are all derived from each project's tasks.

import {
  daysFromToday,
  dueLabel,
  dueLabelFull,
  fmtBudget,
  fmtFull,
  fmtShort,
  MONS,
  MONS_LONG,
  overlapWorkingDays,
  REFERENCE_TS,
  taskEnd,
  toDate,
  weekdaysInRange,
  weeksInRange,
  workingDaysBetween,
  type DateRange,
} from "./format";
import { PHASES, PHASES_FULL, STATUSES, type Project, type Status, type Subtask, type TeamMember } from "./types";
import { dueColor, PHASE_COLORS, ringColor, STATUS_META } from "./tokens";

export interface DerivedSubtask extends Subtask {
  end: string;
  assignee: TeamMember;
  color: string;
}

export interface DerivedProject extends Project {
  phaseLabel: string;
  phaseFull: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  ring: string;
  responsable: TeamMember;
  members: TeamMember[];
  budgetFmt: string;
  /** Derived from task completion (by planned days). */
  progress: number;
  totalDays: number;
  doneDays: number;
  subtasksD: DerivedSubtask[];
  /** Earliest incomplete task, or null. */
  nextTask: DerivedSubtask | null;
  renduLabel: string;
  renduFmt: string;
  renduFull: string;
  renduDay: number | null;
  renduMon: string;
  renduDays: number | null;
  renduDaysLabel: string;
  renduDueColor: string;
  deadlineFull: string;
  deadlineDaysLabel: string;
}

const FALLBACK_MEMBER: TeamMember = {
  id: -1, name: "—", initials: "—", color: "#9AA39B", role: "",
};

export function deriveProject(p: Project, team: TeamMember[]): DerivedProject {
  const meta = STATUS_META[p.status];
  const ring = ringColor(p.status);
  const findMember = (id: number) => team.find((m) => m.id === id) ?? FALLBACK_MEMBER;

  const subtasksD: DerivedSubtask[] = p.subtasks.map((s) => {
    const assignee = findMember(s.assigneeId);
    return {
      ...s,
      end: taskEnd(s.start, s.plannedDays),
      assignee,
      color: s.done ? "#9AA39B" : assignee.color,
    };
  });

  const totalDays = subtasksD.reduce((sum, s) => sum + s.plannedDays, 0);
  const doneDays = subtasksD.filter((s) => s.done).reduce((sum, s) => sum + s.plannedDays, 0);
  const progress = totalDays ? Math.round((doneDays / totalDays) * 100) : 0;

  const incomplete = subtasksD
    .filter((s) => !s.done)
    .sort((a, b) => a.end.localeCompare(b.end));
  const nextTask = incomplete[0] ?? null;

  const responsable = findMember(p.responsableId);
  const memberIds = Array.from(new Set([p.responsableId, ...p.subtasks.map((s) => s.assigneeId)]));
  const members = memberIds.map(findMember).filter((m) => m.id !== -1);

  const renduDays = nextTask ? daysFromToday(nextTask.end) : null;
  const rdate = nextTask ? toDate(nextTask.end) : null;

  return {
    ...p,
    phaseLabel: PHASES[p.phaseIndex],
    phaseFull: PHASES_FULL[p.phaseIndex],
    statusLabel: meta.label,
    statusColor: meta.color,
    statusBg: meta.bg,
    ring,
    responsable,
    members,
    budgetFmt: fmtBudget(p.budget),
    progress,
    totalDays,
    doneDays,
    subtasksD,
    nextTask,
    renduLabel: nextTask ? nextTask.name : p.subtasks.length ? "Tous les livrables rendus" : "Aucune tâche",
    renduFmt: nextTask ? fmtShort(nextTask.end) : "—",
    renduFull: nextTask ? fmtFull(nextTask.end) : "—",
    renduDay: rdate ? rdate.getDate() : null,
    renduMon: rdate ? MONS[rdate.getMonth()] : "",
    renduDays,
    renduDaysLabel: nextTask ? dueLabel(renduDays as number) : p.subtasks.length ? "Livré ✓" : "—",
    renduDueColor: nextTask ? dueColor(renduDays as number, false) : "#9AA39B",
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
    .filter((p) => p.nextTask)
    .sort((a, b) => (a.nextTask!.end).localeCompare(b.nextTask!.end))
    .slice(0, limit);
}

export function vigilanceAlerts(all: DerivedProject[], limit = 6): DerivedProject[] {
  return all
    .filter((p) => p.status === "en retard" || p.status === "à risque")
    .sort((a, b) => (a.status === "en retard" ? 0 : 1) - (b.status === "en retard" ? 0 : 1))
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
    (p) => p.renduDays !== null && p.renduDays >= 0 && p.renduDays <= 6,
  ).length;
  const late = all.filter((p) => p.status === "en retard").length;
  const avg = all.length ? Math.round(all.reduce((s, p) => s + p.progress, 0) / all.length) : 0;
  const budgetFmt = fmtBudget(all.reduce((s, p) => s + p.budget, 0));
  return { active, rendus, late, avg, budgetFmt, total: all.length };
}

// ------------------------------------------------------------------- gantt

const GANTT_START = toDate("2026-01-01").getTime();
const GANTT_END = toDate("2027-06-30").getTime();
const GANTT_SPAN = GANTT_END - GANTT_START;
const pctOf = (ts: number) => ((ts - GANTT_START) / GANTT_SPAN) * 100;

function barGeom(startIso: string, endIso: string): { left: number; width: number; visible: boolean } {
  const s = Math.max(toDate(startIso).getTime(), GANTT_START);
  const e = Math.min(toDate(endIso).getTime(), GANTT_END);
  if (e < GANTT_START || s > GANTT_END) return { left: 0, width: 0, visible: false };
  const left = pctOf(s);
  const width = Math.max(0.8, ((e - s) / GANTT_SPAN) * 100);
  return { left, width, visible: true };
}

export interface GanttMonth {
  label: string;
  left: number;
  width: number;
}

export interface GanttBar {
  id: number;
  name: string;
  left: number;
  width: number;
  color: string;
  done: boolean;
  assigneeInitials: string;
  /** Whether the bar falls inside the visible timeline window. */
  visible: boolean;
  /** Predecessor task ids (Finish-to-Start), for dependency arrows. */
  dependsOn: number[];
}

export interface GanttRow {
  id: number;
  name: string;
  responsable: string;
  progress: number;
  taskCount: number;
  left: number;
  width: number;
  color: string;
  fill: number;
  subtasks: GanttBar[];
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
    const mo = i % 12;
    const ms = new Date(y, mo, 1).getTime();
    const me = new Date(y, mo + 1, 1).getTime();
    months.push({
      label: MONS[mo] + (mo === 0 ? ` '${String(y).slice(2)}` : ""),
      left: pctOf(ms),
      width: ((me - ms) / GANTT_SPAN) * 100,
    });
  }

  const rows: GanttRow[] = filtered.map((p) => {
    const g = barGeom(p.start, p.deadline);
    return {
      id: p.id,
      name: p.name,
      responsable: p.responsable.name,
      progress: p.progress,
      taskCount: p.subtasks.length,
      left: g.left,
      width: g.width,
      color: p.ring,
      fill: p.progress,
      subtasks: p.subtasksD.map((s) => {
        const sg = barGeom(s.start, s.end);
        return {
          id: s.id,
          name: s.name,
          left: sg.left,
          width: sg.width,
          color: s.color,
          done: s.done,
          assigneeInitials: s.assignee.initials,
          visible: sg.visible,
          dependsOn: s.dependsOn,
        };
      }),
    };
  });

  return { months, rows, todayLeft: pctOf(REFERENCE_TS) };
}

// ---------------------------------------------------------------- calendar

export interface TaskEvent {
  projectId: number;
  subtaskId: number;
  projectName: string;
  taskName: string;
  /** Deadline (task end). */
  date: string;
  start: string;
  plannedDays: number;
  phaseIndex: number;
  /** Phase accent (grey when done). */
  color: string;
  /** Project status colour (used for the status dot). */
  statusColor: string;
  assigneeInitials: string;
  assigneeColor: string;
  done: boolean;
}

export function buildTaskEvents(projects: DerivedProject[]): TaskEvent[] {
  const events: TaskEvent[] = [];
  for (const p of projects) {
    for (const s of p.subtasksD) {
      events.push({
        projectId: p.id,
        subtaskId: s.id,
        projectName: p.name,
        taskName: s.name,
        date: s.end,
        start: s.start,
        plannedDays: s.plannedDays,
        phaseIndex: p.phaseIndex,
        color: s.done ? "#9AA39B" : PHASE_COLORS[p.phaseIndex],
        statusColor: p.statusColor,
        assigneeInitials: s.assignee.initials,
        assigneeColor: s.assignee.color,
        done: s.done,
      });
    }
  }
  return events;
}

export interface CalCell {
  day: number | null;
  iso: string | null;
  isToday: boolean;
  events: TaskEvent[];
}

const [REF_Y, REF_M, REF_D] = "2026-06-15".split("-").map(Number);

export function buildMonthGrid(year: number, month: number, events: TaskEvent[]): CalCell[] {
  const first = new Date(year, month, 1);
  const startW = (first.getDay() + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const byDate = groupByDate(events);
  const cells: CalCell[] = [];
  for (let i = 0; i < startW; i++) cells.push({ day: null, iso: null, isToday: false, events: [] });
  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      day: d,
      iso,
      isToday: year === REF_Y && month === REF_M - 1 && d === REF_D,
      events: byDate.get(iso) ?? [],
    });
  }
  return cells;
}

function groupByDate(events: TaskEvent[]): Map<string, TaskEvent[]> {
  const map = new Map<string, TaskEvent[]>();
  for (const e of events) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return map;
}

export function eventsInRange(events: TaskEvent[], range: DateRange): TaskEvent[] {
  return events
    .filter((e) => e.date >= range.start && e.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ------------------------------------------------------------------ kanban

export interface KanbanColumn {
  phaseIndex: number;
  label: string;
  full: string;
  count: number;
  cards: DerivedProject[];
}

export function buildKanban(filtered: DerivedProject[]): KanbanColumn[] {
  return PHASES.map((label, i) => {
    const cards = filtered.filter((p) => p.phaseIndex === i);
    return { phaseIndex: i, label, full: PHASES_FULL[i], count: cards.length, cards };
  });
}

// -------------------------------------------------------------------- team

export interface TeamTask {
  projectId: number;
  projectName: string;
  taskName: string;
  daysInPeriod: number;
  start: string;
  end: string;
  done: boolean;
}

/** One heatmap cell — a sub-period (week or day) of the selected range. */
export interface HeatBucket {
  start: string;
  end: string;
  label: string;
  days: number;
  capacity: number;
  pct: number;
}

export interface TeamLoad {
  member: TeamMember;
  periodDays: number;
  capacity: number;
  chargePct: number;
  projectsActive: number;
  tasks: TeamTask[];
  /** Per-week (month view) or per-day (week view) breakdown for the heatmap. */
  buckets: HeatBucket[];
}

export function buildTeamLoad(
  projects: DerivedProject[],
  team: TeamMember[],
  range: DateRange,
  bucketMode: "week" | "day" = "week",
): TeamLoad[] {
  const capacity = workingDaysBetween(range.start, range.end);
  const bucketRanges = bucketMode === "day" ? weekdaysInRange(range) : weeksInRange(range);

  return team.map((member) => {
    const tasks: TeamTask[] = [];
    const bucketDays = bucketRanges.map(() => 0);

    for (const p of projects) {
      for (const s of p.subtasksD) {
        if (s.assigneeId !== member.id) continue;
        const daysInPeriod = overlapWorkingDays(s.start, s.end, range.start, range.end);
        if (daysInPeriod > 0) {
          tasks.push({
            projectId: p.id,
            projectName: p.name,
            taskName: s.name,
            daysInPeriod,
            start: s.start,
            end: s.end,
            done: s.done,
          });
        }
        bucketRanges.forEach((b, i) => {
          bucketDays[i] += overlapWorkingDays(s.start, s.end, b.start, b.end);
        });
      }
    }

    const periodDays = tasks.reduce((sum, t) => sum + t.daysInPeriod, 0);
    const projectsActive = new Set(tasks.map((t) => t.projectId)).size;
    const buckets: HeatBucket[] = bucketRanges.map((b, i) => {
      const cap = workingDaysBetween(b.start, b.end);
      return {
        start: b.start,
        end: b.end,
        label: String(toDate(b.start).getDate()),
        days: bucketDays[i],
        capacity: cap,
        pct: cap ? Math.round((bucketDays[i] / cap) * 100) : 0,
      };
    });

    return {
      member,
      periodDays,
      capacity,
      chargePct: capacity ? Math.round((periodDays / capacity) * 100) : 0,
      projectsActive,
      tasks: tasks.sort((a, b) => a.start.localeCompare(b.start)),
      buckets,
    };
  });
}

// --------------------------------------------------------------- dashboard mix

export interface StatusSlice {
  status: Status;
  label: string;
  color: string;
  count: number;
}

export function statusDistribution(all: DerivedProject[]): StatusSlice[] {
  return STATUSES.map((status) => ({
    status,
    label: STATUS_META[status].label,
    color: STATUS_META[status].color,
    count: all.filter((p) => p.status === status).length,
  }));
}

// ----------------------------------------------------------------- filters

export interface FilterDef {
  key: "all" | Status;
  label: string;
  count: number;
  active: boolean;
}

export function buildFilters(searched: DerivedProject[], current: "all" | Status): FilterDef[] {
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
