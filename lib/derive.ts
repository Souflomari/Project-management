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
  toISO,
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
  id: -1, name: "—", initials: "—", color: "#A8A29E", role: "",
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
      color: s.done ? "#A8A29E" : assignee.color,
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
    renduLabel: nextTask ? nextTask.name : p.subtasks.length ? "Tous les rendus livrés" : "Aucune tâche planifiée",
    renduFmt: nextTask ? fmtShort(nextTask.end) : "—",
    renduFull: nextTask ? fmtFull(nextTask.end) : "—",
    renduDay: rdate ? rdate.getDate() : null,
    renduMon: rdate ? MONS[rdate.getMonth()] : "",
    renduDays,
    renduDaysLabel: nextTask ? dueLabel(renduDays as number) : p.subtasks.length ? "Livré" : "—",
    renduDueColor: nextTask ? dueColor(renduDays as number, false) : "#A8A29E",
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

// ---- portfolio history (schedule-derived, deterministic — for trends/deltas) ----

export interface HistoryPoint {
  date: string;
  avg: number; // mean schedule-progress across the portfolio
  rendus: number; // projects with a deliverable due within 7 days
}

const DAY = 86_400_000;

/** A project's progress "as of" date D, derived purely from its task schedule:
 *  task-days whose planned window has elapsed by D ÷ total task-days. */
function progressAsOf(p: DerivedProject, dISO: string, dTs: number): number {
  let total = 0;
  let done = 0;
  for (const s of p.subtasksD) {
    total += s.plannedDays;
    if (toDate(s.start).getTime() > dTs) continue;
    const upto = s.end <= dISO ? s.end : dISO;
    done += Math.min(s.plannedDays, workingDaysBetween(s.start, upto));
  }
  if (total === 0) return p.progress;
  return Math.min(100, Math.round((100 * done) / total));
}

/** Weekly portfolio metrics over the trailing `points` weeks, ending today.
 *  Derived from the schedule so the curve is real and reproducible. */
export function buildHistory(all: DerivedProject[], points = 8, stepDays = 7): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const dTs = REFERENCE_TS - i * stepDays * DAY;
    const dISO = toISO(new Date(dTs));
    const d7ISO = toISO(new Date(dTs + 7 * DAY));
    let sum = 0;
    let rendus = 0;
    for (const p of all) {
      sum += progressAsOf(p, dISO, dTs);
      if (p.subtasksD.some((s) => s.end > dISO && s.end <= d7ISO)) rendus++;
    }
    out.push({ date: dISO, avg: all.length ? Math.round(sum / all.length) : 0, rendus });
  }
  return out;
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

const DAY_MS = 86_400_000;
const MONTH_START = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const NEXT_MONTH_START = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };

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
  /** Raw schedule values so the view can drag-to-reschedule/resize. */
  start: string;
  end: string;
  plannedDays: number;
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
  start: string;
  deadline: string;
  subtasks: GanttBar[];
}

export interface GanttData {
  months: GanttMonth[];
  rows: GanttRow[];
  todayLeft: number;
  /** Calendar-day span of the (data-driven) window — lets the view map px↔days. */
  spanDays: number;
  /** ISO date of the window start (first of a month) — for week-grid alignment. */
  windowStart: string;
}

export function buildGantt(filtered: DerivedProject[]): GanttData {
  // Window spans the actual portfolio (+ today), snapped to whole months, with a
  // little padding so bars don't kiss the edges — instead of a fixed 2026 frame
  // that clamped every earlier project to January.
  let minTs = REFERENCE_TS;
  let maxTs = REFERENCE_TS;
  for (const p of filtered) {
    minTs = Math.min(minTs, toDate(p.start).getTime());
    maxTs = Math.max(maxTs, toDate(p.deadline).getTime());
    for (const s of p.subtasksD) {
      minTs = Math.min(minTs, toDate(s.start).getTime());
      maxTs = Math.max(maxTs, toDate(s.end).getTime());
    }
  }
  const winStart = MONTH_START(minTs);
  const winEnd = NEXT_MONTH_START(maxTs);
  const span = Math.max(DAY_MS, winEnd - winStart);
  const pctOf = (ts: number) => ((ts - winStart) / span) * 100;
  const geom = (startIso: string, endIso: string) => {
    const s = Math.max(toDate(startIso).getTime(), winStart);
    const e = Math.min(toDate(endIso).getTime(), winEnd);
    if (e < winStart || s > winEnd) return { left: 0, width: 0, visible: false };
    return { left: pctOf(s), width: Math.max(0.6, ((e - s) / span) * 100), visible: true };
  };

  const months: GanttMonth[] = [];
  for (let cur = winStart; cur < winEnd; cur = NEXT_MONTH_START(cur)) {
    const me = NEXT_MONTH_START(cur);
    const mo = new Date(cur).getMonth();
    months.push({
      label: MONS[mo] + (mo === 0 ? ` '${String(new Date(cur).getFullYear()).slice(2)}` : ""),
      left: pctOf(cur),
      width: ((me - cur) / span) * 100,
    });
  }

  const rows: GanttRow[] = filtered.map((p) => {
    const g = geom(p.start, p.deadline);
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
      start: p.start,
      deadline: p.deadline,
      subtasks: p.subtasksD.map((s) => {
        const sg = geom(s.start, s.end);
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
          start: s.start,
          end: s.end,
          plannedDays: s.plannedDays,
        };
      }),
    };
  });

  return { months, rows, todayLeft: pctOf(REFERENCE_TS), spanDays: Math.round(span / DAY_MS), windowStart: toISO(new Date(winStart)) };
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
        color: s.done ? "#A8A29E" : PHASE_COLORS[p.phaseIndex],
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
