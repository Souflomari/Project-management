// View-model derivation: turns domain data into ready-to-render values.
// Progress, the next deliverable, planning bars, calendar events and team
// workload are all derived from each project's tasks.
//
// Conventions shared by every derivation below:
//   • dates are ISO calendar dates; a task's `end` is INCLUSIVE (its last working
//     day). Anything drawn on a timeline uses `end + 1 day` as the exclusive edge.
//   • effort is `effortDays(plannedDays)` — whole working days, min 1.
//   • a task with an unparseable start is "unscheduled": it still counts towards
//     effort/progress/budget but is left out of anything placed on a calendar.
//   • calendar arithmetic is done in whole days (see format.ts), never in ms.

import {
  daysBetween,
  daysFromToday,
  dueLabel,
  effortDays,
  epochDay,
  fmtBudget,
  fmtFull,
  fmtShort,
  fromEpochDay,
  MONS,
  overlapWorkingDays,
  REFERENCE_DATE,
  shiftISO,
  taskEnd,
  toDate,
  toISODate,
  weekdaysInRange,
  weeksInRange,
  workingDaysBetween,
  type DateRange,
} from "./format";
import { PHASES, PHASES_FULL, STATUSES, type Project, type Status, type Subtask, type TeamMember } from "./types";
import { dueColor, PHASE_COLORS, ringColor, STATUS_META } from "./tokens";

export interface DerivedSubtask extends Subtask {
  /** Normalised ISO start ("" when the stored value isn't a valid date). */
  start: string;
  /** Normalised effort — `effortDays(plannedDays)`: whole days, min 1. */
  plannedDays: number;
  /** Inclusive ISO end date ("" when unscheduled). */
  end: string;
  /** False when the task has no valid start date (kept off calendars/timelines). */
  scheduled: boolean;
  assignee: TeamMember;
  color: string;
  /** Total float in working days (0 = on the critical path). */
  float: number;
  /** True when the task lies on a zero-float (critical) chain. */
  onCriticalPath: boolean;
}

export interface DerivedProject extends Project {
  /** Normalised ISO start / deadline ("" when the stored value is invalid). */
  start: string;
  deadline: string;
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
  /** Earliest-ending incomplete *scheduled* task, or null. */
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
  id: -1, name: "—", initials: "—", color: "#A8A29E", role: "", costPerDay: 0,
};

/** Share of `part` in `total` as a rounded percentage — the ONE formula used by
 *  project progress and its history, so the two can never round differently. */
function percentOf(part: number, total: number): number {
  return total ? Math.round((part * 100) / total) : 0;
}

// ------------------------------------------------------------------ CPM
//
// Critical-path method over the Finish-to-Start `dependsOn` graph. Durations are
// the tasks' planned working days; the pass is purely topological (it ignores the
// calendar `start`, so float is the pure schedule slack the network allows).
//
// Defensive: user edits (or bad rows) can introduce cycles, self-dependencies,
// dangling ids, duplicate ids or a missing `dependsOn`. Dangling/self edges are
// dropped; a topological order is computed with Kahn's algorithm and the passes
// only run on the acyclic subset — any task caught in / fed by a cycle is treated
// as having no usable float (float 0, not on the critical path). Linear time; no
// recursion and no argument spreading, so it can't blow the stack either.

export interface CpmResult {
  /** subtaskId → total float in working days. */
  float: Map<number, number>;
  /** subtaskId → on the critical (zero-float) path. */
  critical: Map<number, boolean>;
}

export function computeCpm(subtasks: Subtask[]): CpmResult {
  const float = new Map<number, number>();
  const critical = new Map<number, boolean>();
  const byId = new Map<number, Subtask>();
  for (const s of subtasks) if (!byId.has(s.id)) byId.set(s.id, s);
  const ids = Array.from(byId.keys());
  for (const id of ids) { float.set(id, 0); critical.set(id, false); }
  if (ids.length === 0) return { float, critical };

  const dur = (id: number) => effortDays(byId.get(id)!.plannedDays);
  // Keep only (deduplicated) dependency edges that point at real sibling tasks.
  const preds = new Map<number, number[]>();
  for (const id of ids) {
    const deps = byId.get(id)!.dependsOn;
    const list = Array.isArray(deps) ? deps : [];
    preds.set(id, Array.from(new Set(list.filter((d) => d !== id && byId.has(d)))));
  }
  const succs = new Map<number, number[]>(ids.map((id) => [id, []]));
  for (const id of ids) for (const p of preds.get(id)!) succs.get(p)!.push(id);

  // Kahn topological sort — nodes left out of `order` are in / behind a cycle.
  const indeg = new Map<number, number>(ids.map((id) => [id, preds.get(id)!.length]));
  const order: number[] = ids.filter((id) => indeg.get(id) === 0);
  for (let head = 0; head < order.length; head++) {
    for (const s of succs.get(order[head])!) {
      const left = indeg.get(s)! - 1;
      indeg.set(s, left);
      if (left === 0) order.push(s);
    }
  }
  if (order.length === 0) return { float, critical }; // fully cyclic — bail safely

  // Forward pass: earliest start / finish (offsets in working days). Every
  // predecessor of an ordered node is itself ordered (it reached in-degree 0).
  const es = new Map<number, number>();
  const ef = new Map<number, number>();
  let projectFinish = 0;
  for (const id of order) {
    let start = 0;
    for (const p of preds.get(id)!) start = Math.max(start, ef.get(p) ?? 0);
    es.set(id, start);
    ef.set(id, start + dur(id));
    projectFinish = Math.max(projectFinish, start + dur(id));
  }

  // Backward pass: latest finish / start over acyclic successors only.
  const ls = new Map<number, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    let latestFinish = projectFinish;
    for (const s of succs.get(id)!) {
      const sl = ls.get(s);
      if (sl !== undefined) latestFinish = Math.min(latestFinish, sl);
    }
    ls.set(id, latestFinish - dur(id));
  }

  for (const id of order) {
    const fl = Math.max(0, ls.get(id)! - es.get(id)!);
    float.set(id, fl);
    critical.set(id, fl === 0);
  }
  return { float, critical };
}

export function deriveProject(p: Project, team: TeamMember[]): DerivedProject {
  const meta = STATUS_META[p.status];
  const ring = ringColor(p.status);
  const findMember = (id: number) => team.find((m) => m.id === id) ?? FALLBACK_MEMBER;

  const cpm = computeCpm(p.subtasks);
  const subtasksD: DerivedSubtask[] = p.subtasks.map((s) => {
    const assignee = findMember(s.assigneeId);
    const start = toISODate(s.start) ?? "";
    const plannedDays = effortDays(s.plannedDays);
    return {
      ...s,
      start,
      plannedDays,
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn : [],
      end: start ? taskEnd(start, plannedDays) : "",
      scheduled: start !== "",
      assignee,
      color: s.done ? "#A8A29E" : assignee.color,
      float: cpm.float.get(s.id) ?? 0,
      onCriticalPath: cpm.critical.get(s.id) ?? false,
    };
  });

  const totalDays = subtasksD.reduce((sum, s) => sum + s.plannedDays, 0);
  const doneDays = subtasksD.filter((s) => s.done).reduce((sum, s) => sum + s.plannedDays, 0);
  const progress = percentOf(doneDays, totalDays);

  const incomplete = subtasksD.filter((s) => !s.done);
  const nextTask =
    incomplete
      .filter((s) => s.scheduled)
      .sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start))[0] ?? null;

  const responsable = findMember(p.responsableId);
  const memberIds = Array.from(new Set([p.responsableId, ...p.subtasks.map((s) => s.assigneeId)]));
  const members = memberIds.map(findMember).filter((m) => m.id !== -1);

  const renduDays = nextTask ? daysFromToday(nextTask.end) : null;
  const rdate = nextTask ? toDate(nextTask.end) : null;
  const deadline = toISODate(p.deadline) ?? "";

  return {
    ...p,
    start: toISODate(p.start) ?? "",
    deadline,
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
    renduLabel: nextTask
      ? nextTask.name
      : incomplete.length
        ? "Tâches à planifier"
        : p.subtasks.length ? "Tous les rendus livrés" : "Aucune tâche planifiée",
    renduFmt: nextTask ? fmtShort(nextTask.end) : "—",
    renduFull: nextTask ? fmtFull(nextTask.end) : "—",
    renduDay: rdate ? rdate.getDate() : null,
    renduMon: rdate ? MONS[rdate.getMonth()] : "",
    renduDays,
    renduDaysLabel: nextTask
      ? dueLabel(renduDays as number)
      : incomplete.length ? "Non planifié" : p.subtasks.length ? "Livré" : "—",
    renduDueColor: nextTask ? dueColor(renduDays as number, false) : "#A8A29E",
    deadlineFull: fmtFull(deadline),
    // Compact "Dans X j" everywhere (was the prose dueLabelFull "Dans X jours"),
    // so the countdown format is identical across Liste / Kanban / détail — an
    // audit flagged the j/jours split as a consistency tell.
    deadlineDaysLabel: dueLabel(daysFromToday(deadline)),
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

export interface Kpis {
  /** Open (non-terminé) projects. */
  active: number;
  /** Projects with an undelivered task due within the next 7 days (today incl.). */
  rendus: number;
  /** Projects in status "en retard". */
  late: number;
  /** Mean task-completion progress (by planned days) over all projects. */
  avg: number;
  budgetFmt: string;
  total: number;
}

// ---- KPI definitions "as of" a date — ONE basis for the KPIs and their history ----
//
// Tasks carry no completion timestamp, so history is reconstructed from the
// schedule: a done task is taken as delivered on its end date, or today if it
// was finished ahead of schedule. At D = today every definition below reduces
// exactly to the live KPI, so the last history point always equals the KPI and
// week-over-week deltas compare like with like.

/** Date a task was delivered (done tasks only; null when still open). */
function deliveredAt(s: DerivedSubtask): string | null {
  if (!s.done) return null;
  return s.end && s.end < REFERENCE_DATE ? s.end : REFERENCE_DATE;
}

function doneBy(s: DerivedSubtask, d: string): boolean {
  const at = deliveredAt(s);
  return at !== null && at <= d;
}

/** Task-completion progress as of `d` (equals `p.progress` at today). */
function progressAsOf(p: DerivedProject, d: string): number {
  let done = 0;
  for (const s of p.subtasksD) if (doneBy(s, d)) done += s.plannedDays;
  return percentOf(done, p.totalDays);
}

/** Open as of `d`: not archived yet. A "terminé" project is taken as closed
 *  from its last delivery (it counts as open before that). */
function openAsOf(p: DerivedProject, d: string): boolean {
  if (p.status !== "terminé") return true;
  let closed = "";
  for (const s of p.subtasksD) {
    const at = deliveredAt(s);
    if (at && at > closed) closed = at;
  }
  return closed !== "" && d < closed;
}

/** "En retard" as of `d`: the project is declared late today AND the schedule
 *  already showed it slipping at `d` (an open task past its end, or the deadline
 *  passed). A late status with no schedule evidence counts from today only. */
function lateAsOf(p: DerivedProject, d: string): boolean {
  if (p.status !== "en retard") return false;
  let since = REFERENCE_DATE;
  for (const s of p.subtasksD) {
    if (!s.done && s.scheduled && s.end < REFERENCE_DATE) {
      const from = shiftISO(s.end, 1);
      if (from < since) since = from;
    }
  }
  if (p.deadline && p.deadline < REFERENCE_DATE) {
    const from = shiftISO(p.deadline, 1);
    if (from < since) since = from;
  }
  return since <= d;
}

/** A deliverable due within 7 days of `d` (d … d+6) and not delivered by `d`. */
function renduDueAsOf(p: DerivedProject, d: string): boolean {
  const horizon = shiftISO(d, 6);
  return p.subtasksD.some((s) => s.scheduled && s.end >= d && s.end <= horizon && !doneBy(s, d));
}

interface Snapshot {
  avg: number;
  rendus: number;
  late: number;
  active: number;
}

function snapshotAsOf(all: DerivedProject[], d: string): Snapshot {
  let sum = 0;
  let rendus = 0;
  let late = 0;
  let active = 0;
  for (const p of all) {
    sum += progressAsOf(p, d);
    if (renduDueAsOf(p, d)) rendus++;
    if (lateAsOf(p, d)) late++;
    if (openAsOf(p, d)) active++;
  }
  return { avg: all.length ? Math.round(sum / all.length) : 0, rendus, late, active };
}

// ---- portfolio history (schedule-derived, deterministic — for trends/deltas) ----

export interface HistoryPoint {
  date: string;
  /** Mean task-completion progress (same definition as `Kpis.avg`). */
  avg: number;
  /** Projects with a deliverable due within 7 days (same as `Kpis.rendus`). */
  rendus: number;
  /** Late projects as of this date (same definition as `Kpis.late`). */
  late: number;
  /** Open projects as of this date (same definition as `Kpis.active`). */
  active: number;
}

/** Weekly portfolio metrics over the trailing `points` weeks, ending today.
 *  The last point equals `computeKpis` exactly. */
export function buildHistory(all: DerivedProject[], points = 8, stepDays = 7): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const date = shiftISO(REFERENCE_DATE, -i * stepDays);
    out.push({ date, ...snapshotAsOf(all, date) });
  }
  return out;
}

export function computeKpis(all: DerivedProject[]): Kpis {
  const now = snapshotAsOf(all, REFERENCE_DATE);
  const budgetFmt = fmtBudget(all.reduce((s, p) => s + p.budget, 0));
  return { active: now.active, rendus: now.rendus, late: now.late, avg: now.avg, budgetFmt, total: all.length };
}

// ---- portfolio health (banded; excludes `terminé` from the denominator) ----

/** sain ≥ 75 · fragile 55–74 · critique < 55. */
export type HealthBand = "critique" | "fragile" | "sain";

export interface PortfolioHealth {
  /** 0..100 health score over ACTIVE (non-terminé) projects only. */
  score: number;
  /** Banded interpretation of the score. */
  band: HealthBand;
  /** Active (non-terminé) projects — the denominator (= `Kpis.active`). */
  activeTotal: number;
  /** Counts of active projects per status. */
  onTrack: number;
  atRisk: number;
  late: number;
  /** True when there are no active projects (avoids a false red "0/100"). */
  empty: boolean;
}

/** Banded portfolio health. Archived (`terminé`) projects are EXCLUDED from the
 *  denominator so a pile of finished work can't mask burning active projects.
 *  Score weights: à jour = 1, à risque = 0.5, en retard = 0. The bands are
 *  deliberately demanding — a portfolio where most live projects are merely "à
 *  risque" must not read as healthy. */
export function portfolioHealth(all: DerivedProject[]): PortfolioHealth {
  const activeProjects = all.filter((p) => p.status !== "terminé");
  const activeTotal = activeProjects.length;
  const onTrack = activeProjects.filter((p) => p.status === "à jour").length;
  const atRisk = activeProjects.filter((p) => p.status === "à risque").length;
  const late = activeProjects.filter((p) => p.status === "en retard").length;
  const score = activeTotal
    ? Math.round((100 * (onTrack + atRisk * 0.5)) / activeTotal)
    : 100;
  const band: HealthBand = score >= 75 ? "sain" : score >= 55 ? "fragile" : "critique";
  return {
    score,
    band,
    activeTotal,
    onTrack,
    atRisk,
    late,
    empty: activeTotal === 0,
  };
}

// ------------------------------------------------------------------- gantt

export interface GanttMonth {
  label: string;
  left: number;
  width: number;
}

export interface GanttBar {
  id: number;
  name: string;
  /** % of the timeline from the window start to the task's first day. */
  left: number;
  /** % of the timeline covered by [start, end] — end INCLUSIVE, so a Mon–Fri
   *  task spans 5 days and a 1-day task exactly one day. */
  width: number;
  color: string;
  done: boolean;
  assigneeInitials: string;
  /** Whether the bar falls inside the visible timeline window (false when unscheduled). */
  visible: boolean;
  /** Predecessor task ids (Finish-to-Start), for dependency arrows. */
  dependsOn: number[];
  /** Raw schedule values so the view can drag-to-reschedule/resize. */
  start: string;
  end: string;
  plannedDays: number;
  /** Total float in working days (0 = critical). */
  float: number;
  /** On the critical (zero-float) path — rendered distinctly. */
  onCriticalPath: boolean;
  /** Width (% of timeline) of the float ghost starting at `left + width`, 0 when none. */
  floatWidth: number;
}

export interface GanttRow {
  id: number;
  name: string;
  responsable: string;
  client: string;
  discipline: string;
  responsableInitials: string;
  responsableColor: string;
  responsableRole: string;
  statusColor: string;
  statusBg: string;
  statusLabel: string;
  phaseLabel: string;
  progress: number;
  taskCount: number;
  /** Project bar over [start, deadline] (deadline inclusive); 0/0 when either is invalid. */
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
  /** % position of the START of today's day column. */
  todayLeft: number;
  /** Whole calendar days in the window — `left`/`width` are fractions of it, so
   *  1 day = 100 / spanDays %. */
  spanDays: number;
  /** ISO date of the window start (first of a month) — for week-grid alignment. */
  windowStart: string;
}

export function buildGantt(filtered: DerivedProject[]): GanttData {
  // Window spans the actual portfolio (+ today), snapped to whole months, with a
  // little padding so bars don't kiss the edges. Invalid dates are skipped so a
  // single bad row can never poison the window.
  const today = epochDay(REFERENCE_DATE);
  let minDay = today;
  let maxDay = today;
  const include = (iso: string) => {
    const d = epochDay(iso);
    if (Number.isNaN(d)) return;
    if (d < minDay) minDay = d;
    if (d > maxDay) maxDay = d;
  };
  for (const p of filtered) {
    include(p.start);
    include(p.deadline);
    for (const s of p.subtasksD) {
      if (!s.scheduled) continue;
      include(s.start);
      include(s.end);
    }
  }
  // Month arithmetic in UTC day numbers (Date.UTC normalises month overflow).
  const monthStart = (y: number, m: number) => Date.UTC(y, m, 1) / 86_400_000;
  const [y0, m0] = fromEpochDay(minDay).split("-").map(Number);
  const [y1, m1] = fromEpochDay(maxDay).split("-").map(Number);
  const winStart = monthStart(y0, m0 - 1);
  const winEnd = monthStart(y1, m1); // first day of the month after the last date (exclusive)
  const span = Math.max(1, winEnd - winStart);
  const pctOf = (day: number) => ((day - winStart) / span) * 100;

  /** Geometry of the inclusive day range [startIso, endIso]: the bar runs from
   *  the start of its first day to the END of its last day (exclusive edge =
   *  end + 1), so a Mon–Fri task covers 5 days and a 1-day task one full day. */
  const geom = (startIso: string, endIso: string) => {
    const a = epochDay(startIso);
    const b = epochDay(endIso);
    if (Number.isNaN(a) || Number.isNaN(b)) return { left: 0, width: 0, visible: false };
    const s = Math.max(a, winStart);
    const e = Math.min(Math.max(b, a) + 1, winEnd);
    if (e <= s) return { left: 0, width: 0, visible: false };
    return { left: pctOf(s), width: ((e - s) / span) * 100, visible: true };
  };

  const months: GanttMonth[] = [];
  for (let i = 0; monthStart(y0, m0 - 1 + i) < winEnd; i++) {
    const cur = monthStart(y0, m0 - 1 + i);
    const next = monthStart(y0, m0 + i);
    const [yr, mo] = fromEpochDay(cur).split("-").map(Number);
    months.push({
      label: MONS[mo - 1] + (mo === 1 ? ` '${String(yr).slice(2)}` : ""),
      left: pctOf(cur),
      width: ((next - cur) / span) * 100,
    });
  }

  const rows: GanttRow[] = filtered.map((p) => {
    const g = geom(p.start, p.deadline);
    return {
      id: p.id,
      name: p.name,
      responsable: p.responsable.name,
      client: p.client,
      discipline: p.discipline,
      responsableInitials: p.responsable.initials,
      responsableColor: p.responsable.color,
      responsableRole: p.responsable.role,
      statusColor: p.statusColor,
      statusBg: p.statusBg,
      statusLabel: p.statusLabel,
      phaseLabel: p.phaseLabel,
      progress: p.progress,
      taskCount: p.subtasks.length,
      left: g.left,
      width: g.width,
      color: p.ring,
      fill: p.progress,
      start: p.start,
      deadline: p.deadline,
      subtasks: p.subtasksD.map((s) => {
        const sg = s.scheduled ? geom(s.start, s.end) : { left: 0, width: 0, visible: false };
        // Float ghost: the `float` working days that follow the bar, drawn from
        // the bar's exclusive edge (end + 1) to the last day of slack, inclusive.
        const floatEnd = s.float > 0 && s.scheduled ? taskEnd(s.end, s.float + 1) : "";
        const fg = floatEnd ? geom(shiftISO(s.end, 1), floatEnd) : { width: 0 };
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
          float: s.float,
          onCriticalPath: s.onCriticalPath,
          floatWidth: Math.max(0, fg.width),
        };
      }),
    };
  });

  return { months, rows, todayLeft: pctOf(today), spanDays: span, windowStart: fromEpochDay(winStart) };
}

// --------------------------------------------------------------- budget / EVM
//
// Earned-value control derived from the same effort-in-days model:
//   • plannedCost  = Σ effortDays(task) × assignee.costPerDay   (budget at completion)
//   • earnedValue  = Σ done effortDays × rate                   (BCWP / valeur acquise)
//   • the project's `budget` (honoraires) is in k€ — multiply by 1000 to compare.
// No calendar/Date.now() — purely schedule-driven, consistent with the rest of derive.

export interface ProjectBudget {
  /** Honoraires (fees) in euros — project.budget × 1000. */
  feesEur: number;
  /** Planned cost at completion (coût engagé prévisionnel), euros. */
  plannedCostEur: number;
  /** Earned value — done work valued at its rate (valeur acquise), euros. */
  earnedValueEur: number;
  /** earnedValue ÷ plannedCost, 0..100 (work-value consumed). */
  spentPct: number;
  /** plannedCost ÷ fees, 0..100+ (how much of the fee the plan commits). */
  committedPct: number;
  /** Projected margin = fees − plannedCost, euros (can be negative). */
  marginEur: number;
  /** marginEur ÷ fees, percentage (can be negative). */
  marginPct: number;
  /** True when the plan commits more than the fees (margin under water). */
  overBudget: boolean;
}

export function buildBudget(p: Project, team: TeamMember[]): ProjectBudget {
  const rateOf = (id: number) => team.find((m) => m.id === id)?.costPerDay ?? 0;
  let plannedCostEur = 0;
  let earnedValueEur = 0;
  for (const s of p.subtasks) {
    const cost = effortDays(s.plannedDays) * rateOf(s.assigneeId);
    plannedCostEur += cost;
    if (s.done) earnedValueEur += cost;
  }
  const feesEur = p.budget * 1000;
  const marginEur = feesEur - plannedCostEur;
  return {
    feesEur,
    plannedCostEur,
    earnedValueEur,
    spentPct: plannedCostEur ? Math.round((earnedValueEur / plannedCostEur) * 100) : 0,
    committedPct: feesEur ? Math.round((plannedCostEur / feesEur) * 100) : 0,
    marginEur,
    marginPct: feesEur ? Math.round((marginEur / feesEur) * 100) : 0,
    overBudget: plannedCostEur > feesEur,
  };
}

// ----------------------------------------------------- portfolio money/decisions
//
// Dashboard-facing selectors that re-anchor the top of the page on MONEY and
// DECISIONS. All reuse `buildBudget`, so the figures are consistent with the
// drawer/detail EVM. Schedule-driven, no Date.now().

export interface PortfolioBudget {
  /** Σ fees (honoraires) across the portfolio, euros. */
  feesEur: number;
  /** Σ planned cost (coût engagé prévisionnel), euros. */
  plannedCostEur: number;
  /** Σ earned value (valeur acquise), euros. */
  earnedValueEur: number;
  /** Projected portfolio margin = fees − plannedCost, euros (can be negative). */
  marginEur: number;
  /** marginEur ÷ fees, percentage (can be negative). */
  marginPct: number;
  /** plannedCost ÷ fees, 0..100+ — how much of the fees is committed. */
  committedPct: number;
  /** Count of projects whose plan commits more than their fees. */
  overBudgetCount: number;
  /** Total projects considered. */
  total: number;
}

/** Portfolio-wide budget roll-up. Reuses `buildBudget` per project. */
export function portfolioBudget(all: Project[], team: TeamMember[]): PortfolioBudget {
  let feesEur = 0;
  let plannedCostEur = 0;
  let earnedValueEur = 0;
  let overBudgetCount = 0;
  for (const p of all) {
    const b = buildBudget(p, team);
    feesEur += b.feesEur;
    plannedCostEur += b.plannedCostEur;
    earnedValueEur += b.earnedValueEur;
    if (b.overBudget) overBudgetCount++;
  }
  const marginEur = feesEur - plannedCostEur;
  return {
    feesEur,
    plannedCostEur,
    earnedValueEur,
    marginEur,
    marginPct: feesEur ? Math.round((marginEur / feesEur) * 100) : 0,
    committedPct: feesEur ? Math.round((plannedCostEur / feesEur) * 100) : 0,
    overBudgetCount,
    total: all.length,
  };
}

/** Projects recently delivered (a deliverable completed) within the trailing
 *  `windowDays` days, today included — default 7 = today and the 6 days before.
 *  Schedule-derived: a done task whose end date falls in that window. */
export interface RecentRendu {
  projectId: number;
  projectName: string;
  taskName: string;
  /** ISO end date of the delivered task. */
  date: string;
  daysAgo: number;
  assigneeInitials: string;
  assigneeColor: string;
}

export function recentRendus(all: DerivedProject[], windowDays = 7): RecentRendu[] {
  const from = shiftISO(REFERENCE_DATE, -(Math.max(1, windowDays) - 1));
  const out: RecentRendu[] = [];
  for (const p of all) {
    for (const s of p.subtasksD) {
      if (!s.done || !s.scheduled) continue;
      if (s.end > REFERENCE_DATE || s.end < from) continue;
      out.push({
        projectId: p.id,
        projectName: p.name,
        taskName: s.name,
        date: s.end,
        daysAgo: daysBetween(s.end, REFERENCE_DATE),
        assigneeInitials: s.assignee.initials,
        assigneeColor: s.assignee.color,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Top over-capacity members over a range — workload summary tile.
 *  Uses the demand-based charge (`chargeAllocPct`), which can exceed 100 %. */
export interface WorkloadSummaryMember {
  member: TeamMember;
  chargePct: number;
  projectsActive: number;
  overCapacity: boolean;
}

export interface WorkloadSummary {
  /** Members ranked by charge (highest first), truncated to `limit`. */
  members: WorkloadSummaryMember[];
  overCapacityCount: number;
  /** Mean charge across ALL members, percentage. */
  avgChargePct: number;
}

export function workloadSummary(
  projects: DerivedProject[],
  team: TeamMember[],
  range: DateRange,
  limit = 5,
): WorkloadSummary {
  const loads = buildTeamLoad(projects, team, range);
  const ranked = loads
    .map((l) => ({
      member: l.member,
      chargePct: l.chargeAllocPct,
      projectsActive: l.projectsActive,
      overCapacity: l.chargeAllocPct > 100,
    }))
    .sort((a, b) => b.chargePct - a.chargePct);
  const overCapacityCount = ranked.filter((m) => m.overCapacity).length;
  const avgChargePct = ranked.length
    ? Math.round(ranked.reduce((s, m) => s + m.chargePct, 0) / ranked.length)
    : 0;
  return { members: ranked.slice(0, limit), overCapacityCount, avgChargePct };
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

/** One event per SCHEDULED task (unscheduled tasks have no date to sit on). */
export function buildTaskEvents(projects: DerivedProject[]): TaskEvent[] {
  const events: TaskEvent[] = [];
  for (const p of projects) {
    for (const s of p.subtasksD) {
      if (!s.scheduled) continue;
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

export function eventsInRange(events: TaskEvent[], range: DateRange): TaskEvent[] {
  return events
    .filter((e) => e.date >= range.start && e.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---- multi-day spans (work bars, not just end-date dots) ----
//
// Each task has a work SPAN [start, end]; the calendar can draw a bar across the
// days it occupies, plus a distinct deadline cap on the end date. A long span is
// split per week so a month/week grid can draw one segment per row.

/** One week-clamped segment of a task's work span. */
export interface TaskSpanSegment {
  /** Clamped (visible) start of this segment, ISO. */
  start: string;
  /** Clamped (visible) end of this segment, ISO. */
  end: string;
  /** True when this segment starts the actual task (draw a left cap). */
  isStart: boolean;
  /** True when this segment ends the actual task / its deadline (draw a right cap / marker). */
  isEnd: boolean;
}

/** A task as a drawable multi-day span, segmented by week, with a deadline marker. */
export interface TaskSpan {
  projectId: number;
  subtaskId: number;
  projectName: string;
  taskName: string;
  /** Work span bounds (full, unclamped). */
  start: string;
  end: string;
  plannedDays: number;
  phaseIndex: number;
  color: string;
  statusColor: string;
  assigneeInitials: string;
  assigneeColor: string;
  done: boolean;
  /** Per-week clamped segments covering [start, end]. */
  segments: TaskSpanSegment[];
  /** The deadline (task end) date — render a distinct cap/marker here. */
  deadline: string;
}

/** Build drawable multi-day spans for the given calendar range. Tasks whose work
 *  window overlaps the range are included; each is split into week-aligned
 *  segments (clamped to the range). The single-day `buildTaskEvents` export is
 *  unchanged — this is additive, for bar rendering. */
export function buildTaskSpans(projects: DerivedProject[], range: DateRange): TaskSpan[] {
  const out: TaskSpan[] = [];
  for (const p of projects) {
    for (const s of p.subtasksD) {
      // Skip unscheduled tasks and those whose window misses the visible range.
      if (!s.scheduled || s.end < range.start || s.start > range.end) continue;
      const visStart = s.start < range.start ? range.start : s.start;
      const visEnd = s.end > range.end ? range.end : s.end;
      const segments: TaskSpanSegment[] = weeksInRange({ start: visStart, end: visEnd }).map(
        (w) => ({
          start: w.start,
          end: w.end,
          isStart: w.start <= s.start && s.start <= w.end,
          isEnd: w.start <= s.end && s.end <= w.end,
        }),
      );
      out.push({
        projectId: p.id,
        subtaskId: s.id,
        projectName: p.name,
        taskName: s.name,
        start: s.start,
        end: s.end,
        plannedDays: s.plannedDays,
        phaseIndex: p.phaseIndex,
        color: s.done ? "#A8A29E" : PHASE_COLORS[p.phaseIndex],
        statusColor: p.statusColor,
        assigneeInitials: s.assignee.initials,
        assigneeColor: s.assignee.color,
        done: s.done,
        segments,
        deadline: s.end,
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
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
//
// Workload is DEMAND over CAPACITY:
//   • demand   — each task needs `effortDays` spread evenly over its working days
//                (rate = effort ÷ working days of [start, end]; 1 day/day for a
//                task whose end is derived from its effort). A member's demand in
//                a window is the sum over their tasks of rate × working days of
//                the task inside the window. Work already delivered (a done task)
//                stops loading the calendar after today.
//   • capacity — working days in the window × FTE (weeklyCapacityDays ÷ 5).
//   • charge % — demand ÷ capacity. Three parallel full-time tasks in one week
//                read 300 %: over-allocation is visible, not capped away.

export interface TeamTask {
  projectId: number;
  projectName: string;
  taskName: string;
  /** Effort (working days, rounded) this task demands inside the period. */
  daysInPeriod: number;
  start: string;
  end: string;
  done: boolean;
}

/** Per-project contribution within a single heat bucket (for a stacked heatmap). */
export interface HeatProjectSplit {
  projectId: number;
  projectName: string;
  /** Demand (working days) this project places on the member in the bucket. */
  days: number;
}

/** One heatmap cell — a sub-period (week or day) of the selected range. */
export interface HeatBucket {
  start: string;
  end: string;
  label: string;
  /** Demand in the bucket, in working days (rounded to a whole day). */
  days: number;
  /** Working-day capacity available in the bucket (calendar working days). */
  capacity: number;
  /** Charge %: demand ÷ FTE capacity — same value as `allocPct`; can exceed 100. */
  pct: number;
  /** Capacity scaled by the member's FTE (weeklyCapacityDays ÷ 5). */
  capacityFte: number;
  /** Demand in the bucket, working days (2 decimals). */
  allocDays: number;
  /** Charge: allocDays ÷ capacityFte, percentage (can exceed 100). */
  allocPct: number;
  /** Per-project split of `allocDays` for a stacked bar. */
  projectSplit: HeatProjectSplit[];
}

export interface TeamLoad {
  member: TeamMember;
  /** Demand over the period, working days (rounded to a whole day). */
  periodDays: number;
  /** Working days in the period (calendar capacity, before FTE). */
  capacity: number;
  /** Charge % over the period — same value as `chargeAllocPct`; can exceed 100. */
  chargePct: number;
  projectsActive: number;
  tasks: TeamTask[];
  /** Per-week (month view) or per-day (week view) breakdown for the heatmap. */
  buckets: HeatBucket[];
  /** The member's configured weekly capacity in working days (default 5). */
  weeklyCapacityDays: number;
  /** Period capacity scaled by FTE (capacity × weeklyCapacityDays ÷ 5). */
  capacityFte: number;
  /** Demand over the period, working days (2 decimals). */
  allocDays: number;
  /** Charge: allocDays ÷ capacityFte, percentage (> 100 = over capacity). */
  chargeAllocPct: number;
  /** Cost of the demanded work over the period: allocDays × member.costPerDay, €. */
  costEur: number;
  /** Per-project split of `allocDays` across the whole period (stacked totals). */
  projectSplit: HeatProjectSplit[];
}

/** Per-member configurable weekly capacity in working days. Keyed by member id;
 *  defaults to 5 (full-time) when a member is absent. */
export type CapacityConfig = Record<number, number>;

const DEFAULT_WEEKLY_CAPACITY = 5;

/** A member's task as a constant daily demand over [start, end]. */
interface LoadItem {
  projectId: number;
  start: string;
  end: string;
  /** Effort per working day (effort ÷ working days of the full task). */
  rate: number;
}

/** Demand placed by `items` on [winStart, winEnd], total and per project. O(items). */
function demandInWindow(
  items: LoadItem[],
  winStart: string,
  winEnd: string,
): { demand: number; byProject: Map<number, number> } {
  const byProject = new Map<number, number>();
  let demand = 0;
  for (const t of items) {
    const wd = overlapWorkingDays(t.start, t.end, winStart, winEnd);
    if (wd <= 0) continue;
    const d = wd * t.rate;
    demand += d;
    byProject.set(t.projectId, (byProject.get(t.projectId) ?? 0) + d);
  }
  return { demand, byProject };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function splitFromMap(map: Map<number, number>, names: Map<number, string>): HeatProjectSplit[] {
  return Array.from(map.entries())
    .map(([projectId, days]) => ({
      projectId,
      projectName: names.get(projectId) ?? "—",
      days: round2(days),
    }))
    .sort((a, b) => b.days - a.days);
}

export function buildTeamLoad(
  projects: DerivedProject[],
  team: TeamMember[],
  range: DateRange,
  bucketMode: "week" | "day" = "week",
  capacityConfig: CapacityConfig = {},
): TeamLoad[] {
  const capacity = workingDaysBetween(range.start, range.end);
  const bucketRanges = bucketMode === "day" ? weekdaysInRange(range) : weeksInRange(range);
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  return team.map((member) => {
    const weeklyCapacityDays = capacityConfig[member.id] ?? DEFAULT_WEEKLY_CAPACITY;
    const fte = Math.max(0, weeklyCapacityDays) / DEFAULT_WEEKLY_CAPACITY;
    const tasks: TeamTask[] = [];
    const items: LoadItem[] = [];

    for (const p of projects) {
      for (const s of p.subtasksD) {
        if (s.assigneeId !== member.id || !s.scheduled) continue;
        const span = workingDaysBetween(s.start, s.end);
        if (span <= 0) continue;
        // Delivered work frees the member's calendar from today on.
        const loadEnd = s.done && s.end > REFERENCE_DATE ? REFERENCE_DATE : s.end;
        const item = { projectId: p.id, start: s.start, end: loadEnd, rate: s.plannedDays / span };
        const inPeriod = demandInWindow([item], range.start, range.end).demand;
        if (inPeriod <= 0) continue;
        items.push(item);
        tasks.push({
          projectId: p.id,
          projectName: p.name,
          taskName: s.name,
          daysInPeriod: Math.round(inPeriod),
          start: s.start,
          end: s.end,
          done: s.done,
        });
      }
    }

    const buckets: HeatBucket[] = bucketRanges.map((b) => {
      const cap = workingDaysBetween(b.start, b.end);
      const capFte = cap * fte;
      const { demand, byProject } = demandInWindow(items, b.start, b.end);
      const allocPct = capFte ? Math.round((demand / capFte) * 100) : 0;
      return {
        start: b.start,
        end: b.end,
        label: String(toDate(b.start).getDate()),
        days: Math.round(demand),
        capacity: cap,
        pct: allocPct,
        capacityFte: capFte,
        allocDays: round2(demand),
        allocPct,
        projectSplit: splitFromMap(byProject, projectNames),
      };
    });

    const capacityFte = capacity * fte;
    const period = demandInWindow(items, range.start, range.end);
    const allocDays = round2(period.demand);
    const chargeAllocPct = capacityFte ? Math.round((period.demand / capacityFte) * 100) : 0;

    return {
      member,
      periodDays: Math.round(period.demand),
      capacity,
      chargePct: chargeAllocPct,
      projectsActive: new Set(tasks.map((t) => t.projectId)).size,
      tasks: tasks.sort((a, b) => a.start.localeCompare(b.start)),
      buckets,
      weeklyCapacityDays,
      capacityFte,
      allocDays,
      chargeAllocPct,
      costEur: Math.round(period.demand * member.costPerDay),
      projectSplit: splitFromMap(period.byProject, projectNames),
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
