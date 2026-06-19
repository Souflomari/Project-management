// View-model derivation: turns domain data into ready-to-render values.
// Progress, the next deliverable, planning bars, calendar events and team
// workload are all derived from each project's tasks.

import {
  daysFromToday,
  dueLabel,
  fmtBudget,
  fmtFull,
  fmtShort,
  isWeekday,
  MONS,
  MONS_LONG,
  overlapWorkingDays,
  REFERENCE_DATE,
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
  /** Total float in working days (0 = on the critical path). */
  float: number;
  /** True when the task lies on a zero-float (critical) chain. */
  onCriticalPath: boolean;
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
  id: -1, name: "—", initials: "—", color: "#A8A29E", role: "", costPerDay: 0,
};

// ------------------------------------------------------------------ CPM
//
// Critical-path method over the Finish-to-Start `dependsOn` graph. Durations are
// the tasks' planned working days; the pass is purely topological (it ignores the
// calendar `start`, so float is the pure schedule slack the network allows).
//
// Cycle-guarded: the seed is a clean chain, but user edits can introduce cycles.
// We compute a topological order with Kahn's algorithm and only run the passes on
// the acyclic subset; any task caught in / fed by a cycle is treated as having no
// usable float (float 0, not on the critical path) rather than looping forever.

export interface CpmResult {
  /** subtaskId → total float in working days. */
  float: Map<number, number>;
  /** subtaskId → on the critical (zero-float) path. */
  critical: Map<number, boolean>;
}

export function computeCpm(subtasks: Subtask[]): CpmResult {
  const float = new Map<number, number>();
  const critical = new Map<number, boolean>();
  const ids = subtasks.map((s) => s.id);
  for (const id of ids) { float.set(id, 0); critical.set(id, false); }
  if (subtasks.length === 0) return { float, critical };

  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const dur = (id: number) => Math.max(1, Math.floor(byId.get(id)?.plannedDays ?? 1));
  // Keep only dependency edges that point at real sibling tasks.
  const preds = new Map<number, number[]>(
    subtasks.map((s) => [s.id, s.dependsOn.filter((d) => byId.has(d) && d !== s.id)]),
  );
  const succs = new Map<number, number[]>(ids.map((id) => [id, []]));
  for (const id of ids) for (const p of preds.get(id)!) succs.get(p)!.push(id);

  // Kahn topological sort — nodes left out of `order` are part of a cycle.
  const indeg = new Map<number, number>(ids.map((id) => [id, preds.get(id)!.length]));
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const order: number[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succs.get(id)!) {
      indeg.set(s, indeg.get(s)! - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }
  const acyclic = new Set(order);
  if (order.length === 0) return { float, critical }; // fully cyclic — bail safely

  // Forward pass: earliest start / finish (offsets in working days).
  const es = new Map<number, number>();
  const ef = new Map<number, number>();
  for (const id of order) {
    const start = Math.max(0, ...preds.get(id)!.filter((p) => acyclic.has(p)).map((p) => ef.get(p) ?? 0));
    es.set(id, start);
    ef.set(id, start + dur(id));
  }
  const projectFinish = Math.max(0, ...order.map((id) => ef.get(id)!));

  // Backward pass: latest finish / start.
  const lf = new Map<number, number>();
  const ls = new Map<number, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const downstream = succs.get(id)!.filter((s) => acyclic.has(s));
    const latestFinish = downstream.length
      ? Math.min(...downstream.map((s) => ls.get(s) ?? projectFinish))
      : projectFinish;
    lf.set(id, latestFinish);
    ls.set(id, latestFinish - dur(id));
  }

  for (const id of order) {
    const fl = Math.max(0, (ls.get(id) ?? 0) - (es.get(id) ?? 0));
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
    return {
      ...s,
      end: taskEnd(s.start, s.plannedDays),
      assignee,
      color: s.done ? "#A8A29E" : assignee.color,
      float: cpm.float.get(s.id) ?? 0,
      onCriticalPath: cpm.critical.get(s.id) ?? false,
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
    // Compact "Dans X j" everywhere (was the prose dueLabelFull "Dans X jours"),
    // so the countdown format is identical across Liste / Kanban / détail — an
    // audit flagged the j/jours split as a consistency tell.
    deadlineDaysLabel: dueLabel(daysFromToday(p.deadline)),
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
  /** Projects whose final deadline had elapsed by this date but were unfinished
   *  (schedule-derived late count) — lets KPIs show a late-count delta. */
  late: number;
  /** Projects already started but not yet finished as of this date (active count). */
  active: number;
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
    let late = 0;
    let active = 0;
    for (const p of all) {
      const prog = progressAsOf(p, dISO, dTs);
      sum += prog;
      if (p.subtasksD.some((s) => s.end > dISO && s.end <= d7ISO)) rendus++;
      // "as of" status, schedule-derived: started but not 100% done = active;
      // deadline elapsed yet incomplete = late.
      const started = p.start <= dISO;
      const finished = prog >= 100;
      if (started && !finished) active++;
      if (p.deadline < dISO && !finished) late++;
    }
    out.push({
      date: dISO,
      avg: all.length ? Math.round(sum / all.length) : 0,
      rendus,
      late,
      active,
    });
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

// ---- portfolio health (banded; excludes `terminé` from the denominator) ----

export type HealthBand = "critique" | "fragile" | "sain" | "excellent";

export interface PortfolioHealth {
  /** 0..100 health score over ACTIVE (non-terminé) projects only. */
  score: number;
  /** Banded interpretation of the score. */
  band: HealthBand;
  /** Active (non-terminé) projects — the denominator. */
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
 *  Score weights: à jour = 1, à risque = 0.5, en retard = 0. */
export function portfolioHealth(all: DerivedProject[]): PortfolioHealth {
  const activeProjects = all.filter((p) => p.status !== "terminé");
  const activeTotal = activeProjects.length;
  const onTrack = activeProjects.filter((p) => p.status === "à jour").length;
  const atRisk = activeProjects.filter((p) => p.status === "à risque").length;
  const late = activeProjects.filter((p) => p.status === "en retard").length;
  const score = activeTotal
    ? Math.round((100 * (onTrack + atRisk * 0.5)) / activeTotal)
    : 100;
  const band: HealthBand =
    score >= 85 ? "excellent" : score >= 60 ? "sain" : score >= 35 ? "fragile" : "critique";
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
  /** Total float in working days (0 = critical). */
  float: number;
  /** On the critical (zero-float) path — rendered distinctly. */
  onCriticalPath: boolean;
  /** Width (% of timeline) of the float ghost trailing the bar, 0 when none. */
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
        const sg = geom(s.start, s.end);
        // Float ghost: extend the bar by `float` working days past its end so the
        // view can render the slack as a faint trailing extension.
        const floatEnd = s.float > 0 ? taskEnd(s.end, s.float + 1) : s.end;
        const fg = s.float > 0 ? geom(s.end, floatEnd) : { width: 0 };
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

  return { months, rows, todayLeft: pctOf(REFERENCE_TS), spanDays: Math.round(span / DAY_MS), windowStart: toISO(new Date(winStart)) };
}

// --------------------------------------------------------------- budget / EVM
//
// Earned-value control derived from the same effort-in-days model:
//   • plannedCost  = Σ task.plannedDays × assignee.costPerDay   (budget at completion)
//   • earnedValue  = Σ done task.plannedDays × rate             (BCWP / valeur acquise)
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
    const cost = Math.max(1, Math.floor(s.plannedDays)) * rateOf(s.assigneeId);
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
 *  `windowDays` (default 7) of the reference date — recent-activity feed.
 *  Schedule-derived: a done task whose end date falls in [today−window, today]. */
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
  const fromTs = REFERENCE_TS - windowDays * DAY;
  const out: RecentRendu[] = [];
  for (const p of all) {
    for (const s of p.subtasksD) {
      if (!s.done) continue;
      const ts = toDate(s.end).getTime();
      if (ts > REFERENCE_TS || ts < fromTs) continue;
      out.push({
        projectId: p.id,
        projectName: p.name,
        taskName: s.name,
        date: s.end,
        daysAgo: Math.round((REFERENCE_TS - ts) / DAY),
        assigneeInitials: s.assignee.initials,
        assigneeColor: s.assignee.color,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Top over-capacity members over a range — workload summary tile.
 *  Uses the corrected allocation (`chargeAllocPct`), not the double-counting sum. */
export interface WorkloadSummaryMember {
  member: TeamMember;
  chargePct: number;
  projectsActive: number;
  overCapacity: boolean;
}

export interface WorkloadSummary {
  members: WorkloadSummaryMember[];
  overCapacityCount: number;
  /** Mean charge across all members (corrected allocation), percentage. */
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

const [REF_Y, REF_M, REF_D] = REFERENCE_DATE.split("-").map(Number);

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
      // Skip tasks whose work window doesn't intersect the visible range.
      if (s.end < range.start || s.start > range.end) continue;
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

export interface TeamTask {
  projectId: number;
  projectName: string;
  taskName: string;
  daysInPeriod: number;
  start: string;
  end: string;
  done: boolean;
}

/** Per-project contribution within a single heat bucket (for a stacked heatmap). */
export interface HeatProjectSplit {
  projectId: number;
  projectName: string;
  /** Allocated working days this project consumes in the bucket (corrected). */
  days: number;
}

/** One heatmap cell — a sub-period (week or day) of the selected range. */
export interface HeatBucket {
  start: string;
  end: string;
  label: string;
  /** Raw summed overlap days (legacy — double-counts parallel tasks). */
  days: number;
  /** Working-day capacity available in the bucket (calendar working days). */
  capacity: number;
  /** Legacy charge: raw `days` ÷ capacity (can exceed 100 by double-count). */
  pct: number;
  // ---- corrected allocation (additive) ----
  /** Capacity scaled by the member's FTE (weeklyCapacityDays ÷ 5). */
  capacityFte: number;
  /** Corrected allocated days: per calendar day, work is capped at the member's
   *  daily availability, so parallel tasks no longer double-count. */
  allocDays: number;
  /** Corrected charge: allocDays ÷ capacityFte, percentage. */
  allocPct: number;
  /** Per-project split of `allocDays` for a stacked bar. */
  projectSplit: HeatProjectSplit[];
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
  // ---- corrected model + cost (additive) ----
  /** The member's configured weekly capacity in working days (default 5). */
  weeklyCapacityDays: number;
  /** Period capacity scaled by FTE (capacity × weeklyCapacityDays ÷ 5). */
  capacityFte: number;
  /** Corrected allocated days over the period (parallel tasks no longer summed). */
  allocDays: number;
  /** Corrected charge: allocDays ÷ capacityFte, percentage (no 290% artifact). */
  chargeAllocPct: number;
  /** Cost of the allocated work over the period: allocDays × member.costPerDay, €. */
  costEur: number;
  /** Per-project split of `allocDays` across the whole period (stacked totals). */
  projectSplit: HeatProjectSplit[];
}

/** Per-member configurable weekly capacity in working days. Keyed by member id;
 *  defaults to 5 (full-time) when a member is absent. */
export type CapacityConfig = Record<number, number>;

const DEFAULT_WEEKLY_CAPACITY = 5;

/** Corrected allocation for one member within a date window: for each calendar
 *  working day, the member can apply at most `dailyAvail` days of effort split
 *  across whatever tasks are active that day — so two parallel tasks share the
 *  day instead of each counting a full day. Returns total allocated days plus a
 *  per-project split. */
function allocateInWindow(
  active: { projectId: number; start: string; end: string }[],
  winStart: string,
  winEnd: string,
  dailyAvail: number,
): { allocDays: number; byProject: Map<number, number> } {
  const byProject = new Map<number, number>();
  let allocDays = 0;
  const cur = toDate(winStart);
  const end = toDate(winEnd);
  while (cur <= end) {
    if (isWeekday(cur)) {
      const iso = toISO(cur);
      const onDay = active.filter((t) => t.start <= iso && iso <= t.end);
      if (onDay.length) {
        // Cap the day's total effort at the member's daily availability, shared
        // equally across the tasks active that day.
        const perTask = dailyAvail / onDay.length;
        for (const t of onDay) {
          byProject.set(t.projectId, (byProject.get(t.projectId) ?? 0) + perTask);
          allocDays += perTask;
        }
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return { allocDays, byProject };
}

function splitFromMap(map: Map<number, number>, names: Map<number, string>): HeatProjectSplit[] {
  return Array.from(map.entries())
    .map(([projectId, days]) => ({
      projectId,
      projectName: names.get(projectId) ?? "—",
      days: Math.round(days * 100) / 100,
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
    const fte = weeklyCapacityDays / DEFAULT_WEEKLY_CAPACITY;
    const dailyAvail = fte; // days of effort available per calendar working day
    const tasks: TeamTask[] = [];
    const bucketDays = bucketRanges.map(() => 0);
    // Tasks active for this member (clamped to range), for the corrected model.
    const memberTasks: { projectId: number; start: string; end: string }[] = [];

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
          memberTasks.push({
            projectId: p.id,
            start: s.start < range.start ? range.start : s.start,
            end: s.end > range.end ? range.end : s.end,
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
      const capFte = cap * fte;
      const alloc = allocateInWindow(memberTasks, b.start, b.end, dailyAvail);
      return {
        start: b.start,
        end: b.end,
        label: String(toDate(b.start).getDate()),
        days: bucketDays[i],
        capacity: cap,
        pct: cap ? Math.round((bucketDays[i] / cap) * 100) : 0,
        capacityFte: capFte,
        allocDays: Math.round(alloc.allocDays * 100) / 100,
        allocPct: capFte ? Math.round((alloc.allocDays / capFte) * 100) : 0,
        projectSplit: splitFromMap(alloc.byProject, projectNames),
      };
    });

    const capacityFte = capacity * fte;
    const periodAlloc = allocateInWindow(memberTasks, range.start, range.end, dailyAvail);
    const allocDays = Math.round(periodAlloc.allocDays * 100) / 100;

    return {
      member,
      periodDays,
      capacity,
      chargePct: capacity ? Math.round((periodDays / capacity) * 100) : 0,
      projectsActive,
      tasks: tasks.sort((a, b) => a.start.localeCompare(b.start)),
      buckets,
      weeklyCapacityDays,
      capacityFte,
      allocDays,
      chargeAllocPct: capacityFte ? Math.round((allocDays / capacityFte) * 100) : 0,
      costEur: Math.round(allocDays * member.costPerDay),
      projectSplit: splitFromMap(periodAlloc.byProject, projectNames),
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
