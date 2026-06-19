// Realistic sample data for the Setec portfolio. Each project is seeded with a
// set of editable tasks (sous-tâches); progress and the "prochain rendu" are
// derived from them. Swapping to Supabase replaces the repository, not this file.

import { REFERENCE_DATE, shiftISO, taskEnd, taskStartForEnd, workingDaysBetween } from "../format";
import type { Project, Status, Subtask, TeamMember } from "../types";

// costPerDay = loaded daily rate in € (charge journalière) — seniors/directors
// command higher rates than engineers, in line with French engineering-firm TJM.
export const TEAM: TeamMember[] = [
  { id: 0, name: "C. Mercier", initials: "CM", color: "#15803D", role: "Cheffe de projet senior", costPerDay: 920 },
  { id: 1, name: "A. Lefèvre", initials: "AL", color: "#2C7A8C", role: "Ingénieur OA", costPerDay: 680 },
  { id: 2, name: "N. Diallo", initials: "ND", color: "#4C8AA3", role: "Ingénieure hydraulique", costPerDay: 660 },
  { id: 3, name: "M. Caron", initials: "MC", color: "#B45309", role: "Chef de projet géotech.", costPerDay: 850 },
  { id: 4, name: "L. Petit", initials: "LP", color: "#B5392E", role: "Ingénieure VRD", costPerDay: 640 },
  { id: 5, name: "S. Roux", initials: "SR", color: "#3B7179", role: "Chef de projet énergie", costPerDay: 870 },
  { id: 6, name: "H. Bonnet", initials: "HB", color: "#8A6F5C", role: "Architecte bâtiment", costPerDay: 760 },
  { id: 7, name: "F. Aubry", initials: "FA", color: "#2F4A63", role: "Directeur ferroviaire", costPerDay: 1150 },
];

// [name, client, discipline, leadIdx, phaseIndex, progress, status, budget(k€), start, deadline, renduLabel, renduDate]
type Row = [
  string, string, string, number, number, number, Status, number, string, string, string, string,
];

// Budgets are the engineering-study fees (honoraires) for the modeled scope, in
// k€ — sized so the planned labour cost (Σ plannedDays × rate, see derive.ts)
// lands at a realistic ~half of the fee. They keep their relative ranking but are
// study-package fees, not whole-mission envelopes, so earned-value reads credibly
// (coût engagé ≈ 50 %, marge ≈ 50 %) instead of the old 0 % / +100 %.
const ROWS: Row[] = [
  ["Ligne 18 — Viaduc T2A", "Société du Grand Paris", "Ouvrages d'art", 0, 4, 62, "à risque", 455, "2025-03-01", "2026-09-30", "DCE — Lot T2A", "2026-06-18"],
  ["Échangeur A480 Sud", "DIR Centre-Est", "VRD / Mobilités", 1, 4, 74, "à jour", 335, "2025-06-15", "2026-07-22", "Dossier PRO", "2026-06-26"],
  ["STEP Aquaval — Tranche 2", "Régie des Eaux", "Hydraulique", 2, 2, 41, "à jour", 250, "2025-11-01", "2026-08-14", "Rapport APD", "2026-07-03"],
  ["Tunnel de Belledonne", "SNCF Réseau", "Tunnels / Géotechnique", 3, 5, 88, "à jour", 435, "2024-09-01", "2026-10-05", "Plans d'exécution — visa", "2026-06-16"],
  ["Quartier Rive-Étoile", "Métropole de Lyon", "Bâtiment / VRD", 4, 1, 28, "à risque", 395, "2026-01-10", "2026-09-10", "Rapport APS", "2026-06-20"],
  ["Pont de l'Estuaire — Inspection", "CD44", "Ouvrages d'art", 1, 3, 70, "en retard", 95, "2025-09-01", "2026-06-08", "Rapport diagnostic", "2026-05-28"],
  ["Parc éolien Vent d'Oc", "EnR Sud", "Énergie", 5, 0, 12, "à jour", 350, "2026-04-01", "2026-11-20", "Étude de faisabilité", "2026-07-15"],
  ["Réseau de chaleur Centre", "Ville de Lyon", "Énergie / VRD", 2, 4, 69, "à risque", 320, "2025-05-01", "2026-07-08", "DCE", "2026-06-19"],
  ["Gare multimodale Nord", "Région Hauts-de-France", "Bâtiment / Mobilités", 0, 2, 47, "à jour", 405, "2025-10-01", "2026-08-28", "Rapport APD", "2026-07-10"],
  ["Digue maritime Port-Vendres", "Grand Port Maritime", "Maritime / Hydraulique", 3, 3, 53, "à jour", 375, "2025-07-01", "2026-09-18", "Dossier PRO", "2026-06-30"],
  ["Requalification Bd Sud", "Ville de Nantes", "VRD", 4, 6, 100, "terminé", 285, "2024-06-01", "2026-06-10", "DOE", "2026-06-05"],
  ["Pôle hospitalier Est", "CHU de Bordeaux", "Bâtiment", 5, 5, 81, "à jour", 515, "2024-11-01", "2026-12-15", "Visa exécution", "2026-06-17"],
  ["LGV Sud-Ouest — Section 3", "SNCF Réseau", "Infrastructure ferroviaire", 7, 2, 38, "à jour", 540, "2025-09-15", "2027-03-30", "Rapport APD", "2026-07-22"],
  ["Passerelle Confluence", "Métropole de Lyon", "Ouvrages d'art", 0, 4, 64, "à jour", 345, "2025-08-01", "2026-08-05", "DCE", "2026-06-29"],
  ["Station épuration Garonne", "Bordeaux Métropole", "Hydraulique", 2, 1, 22, "à risque", 380, "2026-02-01", "2026-10-30", "Rapport APS", "2026-06-24"],
  ["Tramway T9 — Extension", "Île-de-France Mobilités", "Mobilités", 1, 3, 58, "à jour", 405, "2025-04-01", "2026-11-15", "Dossier PRO", "2026-07-06"],
  ["Barrage de Serre — Réfection", "EDF", "Hydraulique / Géotech.", 3, 5, 76, "à risque", 550, "2024-12-01", "2026-09-25", "Visa note de calcul EXE", "2026-06-23"],
  ["Centre logistique A7", "Groupe Argan", "Bâtiment / VRD", 6, 4, 71, "à jour", 395, "2025-06-01", "2026-07-30", "DCE", "2026-07-01"],
  ["Échangeur ferroviaire Est", "SNCF Réseau", "Infrastructure ferroviaire", 7, 2, 44, "à jour", 505, "2025-10-15", "2026-12-20", "Rapport APD", "2026-07-13"],
  ["Front de mer La Rochelle", "Ville de La Rochelle", "Aménagement urbain", 4, 1, 19, "à jour", 250, "2026-03-01", "2026-10-10", "Rapport APS", "2026-07-18"],
  ["Usine hydroélectrique Drac", "EDF", "Énergie / Hydraulique", 5, 3, 70, "en retard", 540, "2025-02-01", "2026-06-05", "Dossier PRO", "2026-05-20"],
  ["Hôtel de Région — Réhab", "Région Occitanie", "Bâtiment", 6, 4, 67, "à jour", 405, "2025-07-15", "2026-08-20", "DCE", "2026-07-04"],
  ["Voie verte des Gaves", "Département 64", "VRD / Aménagement", 1, 0, 8, "à jour", 205, "2026-05-01", "2027-01-15", "Étude de faisabilité", "2026-08-05"],
  ["Pont levant du Port", "Grand Port Maritime", "Ouvrages d'art", 0, 6, 100, "terminé", 420, "2024-03-01", "2026-05-20", "DOE", "2026-05-15"],
  ["Data center Sud — Lot CVC", "OVHcloud", "Bâtiment / Énergie", 3, 5, 84, "à jour", 460, "2025-01-01", "2026-09-05", "Visa exécution", "2026-06-21"],
];

const SEED_COMMENTS: Record<number, { ri: number; text: string; when: string }[]> = {
  1: [{ ri: 7, text: "Coordination interfaces avec le lot génie civil à caler avant le DCE.", when: "il y a 2 j" }],
  6: [{ ri: 1, text: "Accès à l'ouvrage soumis à autorisation — relance du MOA en cours.", when: "hier" }],
  21: [{ ri: 5, text: "Validation MOA en attente, planning à réajuster.", when: "il y a 4 j" }],
};

// Effort model. Each project's five tasks share a total planned effort sized so
// the labour cost (Σ plannedDays × rate) is ~half the fee — that's what makes the
// earned-value panel read believably (committed ≈ 50 %, margin ≈ 50 %). The total
// is split across the five tasks by these fractions (a study ramps up then closes
// out), giving per-task work-packages of a few weeks to ~3 months — realistic for
// a small staffed team, and large enough that the cost is a meaningful share.
const COMMIT_FRACTION = 0.5; // planned labour cost as a fraction of the fee
const EFFORT_SPLIT = [0.18, 0.24, 0.2, 0.24, 0.14]; // by chronological task position

// Discipline-specific task vocabularies so projects don't all share the same
// five generic task names. Index [0],[1],[3] become tasks 1,2,4; task 3 is the
// phase deliverable (renduLabel) and task 5 is a phase-aware closeout.
const TASK_POOLS: Record<string, string[]> = {
  oa: ["Reconnaissance & relevés de l'ouvrage", "Note d'hypothèses générales", "Modélisation aux éléments finis", "Plans de coffrage & ferraillage"],
  vrd: ["Recueil des données d'entrée", "Levé topographique & réseaux", "Profils en long & en travers", "Dimensionnement des chaussées"],
  hydraulique: ["Diagnostic de l'existant", "Bilan file eau / file boue", "Dimensionnement des ouvrages", "Note de calcul hydraulique"],
  tunnels: ["Campagne géotechnique", "Note d'hypothèses géotechniques", "Modélisation du soutènement", "Note de calcul de structure"],
  energie: ["Étude de gisement", "Bilan de puissance", "Étude de raccordement", "Note de dimensionnement"],
  batiment: ["Programme & faisabilité", "Esquisse architecturale", "Notices techniques (CCTP)", "Synthèse tous corps d'état"],
  ferroviaire: ["Recueil des contraintes d'exploitation", "Étude de tracé & signalisation", "Dimensionnement de la voie", "Plans de pose"],
  maritime: ["Étude bathymétrique & houle", "Note d'hypothèses maritimes", "Dimensionnement de l'ouvrage", "Note de stabilité"],
  amenagement: ["Diagnostic de site", "Concertation & esquisse", "Plan d'aménagement", "Chiffrage des travaux"],
  generic: ["Cadrage & collecte de données", "Études préliminaires & relevés", "Analyse & dimensionnement", "Revue interne"],
};

function poolFor(discipline: string): string[] {
  const d = discipline.toLowerCase();
  if (d.includes("ferro")) return TASK_POOLS.ferroviaire;
  if (d.includes("tunnel") || d.includes("géotech")) return TASK_POOLS.tunnels;
  if (d.includes("maritime")) return TASK_POOLS.maritime;
  if (d.includes("hydraul")) return TASK_POOLS.hydraulique;
  if (d.includes("énergie") || d.includes("energie")) return TASK_POOLS.energie;
  if (d.includes("ouvrages d'art")) return TASK_POOLS.oa;
  if (d.includes("aménagement") || d.includes("urbain")) return TASK_POOLS.amenagement;
  if (d.includes("bâtiment")) return TASK_POOLS.batiment;
  if (d.includes("vrd") || d.includes("mobilités")) return TASK_POOLS.vrd;
  return TASK_POOLS.generic;
}

/** Per-task planned effort (working days). The total is sized so the labour cost
 *  is ~COMMIT_FRACTION of the fee, then split by EFFORT_SPLIT. For normal projects
 *  the total is also clamped to fit the [start, deadline] window so the five-task
 *  chain stays inside the schedule. */
function plannedDaysFor(row: Row, assigneeIds: number[], windowWD: number, late: boolean): number[] {
  const feeEur = row[7] * 1000;
  const avgRate =
    assigneeIds.reduce((s, id) => s + (TEAM[id]?.costPerDay ?? 0), 0) / assigneeIds.length;
  let totalDays = Math.max(5, Math.round((COMMIT_FRACTION * feeEur) / avgRate));
  if (!late) totalDays = Math.min(totalDays, Math.max(25, windowWD - 8)); // leave room for gaps
  return EFFORT_SPLIT.map((f) => Math.max(5, Math.round(totalDays * f)));
}

/** Place five Finish-to-Start tasks on the calendar without overlaps.
 *  • Normal projects: spread the first four across the window, then anchor the last
 *    task to END on the deadline — so the bars span the whole project window and the
 *    closeout always lands on the (future) deadline, leaving a pending deliverable.
 *  • "en retard": back-schedule from the (past) deadline, so the earliest still-open
 *    task lands a moderate amount overdue vs today — exactly what an "en retard"
 *    project should show, instead of months in the past. */
function placeTasks(
  start: string,
  deadline: string,
  days: number[],
  late: boolean,
): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  const last = days.length - 1;
  if (late) {
    const gap = 3;
    const ends = new Array<string>(days.length);
    const starts = new Array<string>(days.length);
    ends[last] = deadline;
    starts[last] = taskStartForEnd(deadline, days[last]);
    for (let k = last - 1; k >= 0; k--) {
      ends[k] = shiftISO(starts[k + 1], -(gap + 1));
      starts[k] = taskStartForEnd(ends[k], days[k]);
    }
    for (let k = 0; k < days.length; k++) out.push({ start: starts[k], end: ends[k] });
    return out;
  }
  const work = days.reduce((s, d) => s + d, 0);
  const slack = Math.max(0, workingDaysBetween(start, deadline) - work);
  const gap = Math.floor(slack / 4); // four gaps between five tasks span the window
  let cur = start;
  for (let k = 0; k < last; k++) {
    if (k > 0) cur = shiftISO(out[k - 1].end, gap + 1);
    out.push({ start: cur, end: taskEnd(cur, days[k]) });
  }
  // Anchor the closeout to end on the deadline (never before its predecessor).
  let lastStart = taskStartForEnd(deadline, days[last]);
  const minStart = shiftISO(out[last - 1].end, 1);
  if (lastStart < minStart) lastStart = minStart;
  out.push({ start: lastStart, end: taskEnd(lastStart, days[last]) });
  return out;
}

/** Build the editable task list for a project, with done flags ~matching progress. */
function buildSubtasks(row: Row): Subtask[] {
  const [, , discipline, lead, phaseIndex, progress, status, , start, deadline, renduLabel] = row;
  // Spread the five tasks across distinct members so no one person carries a
  // whole project in a single period (keeps the team heatmap credible).
  const m = (i: number) => (lead + i) % TEAM.length;
  const pool = poolFor(discipline);
  // DOE/closeout only makes sense in execution/réception phases; earlier phases
  // close on an internal review instead.
  const closeout = phaseIndex >= 5 ? "Clôture & DOE" : `${pool[3]} & livraison`;

  // Chronological task order: cadrage, étude, deliverable, analyse, closeout.
  const names = [pool[0], pool[1], renduLabel, pool[2], closeout];
  const assignees = [lead, m(1), lead, m(2), m(4)];
  const late = status === "en retard";
  const days = plannedDaysFor(row, assignees, workingDaysBetween(start, deadline), late);
  const slots = placeTasks(start, deadline, days, late);

  const total = days.reduce((s, d) => s + d, 0);
  const target = (progress / 100) * total;
  let running = 0;

  const subs = names.map((name, i) => {
    running += days[i];
    const done = status === "terminé" ? true : running <= target + 0.5;
    return {
      id: i + 1,
      name,
      assigneeId: assignees[i],
      start: slots[i].start,
      plannedDays: days[i],
      end: slots[i].end,
      done,
      // Linear Finish-to-Start chain: each task depends on the previous one.
      dependsOn: i === 0 ? [] : [i],
    };
  });

  // Internal consistency vs REFERENCE_DATE: an on-track ("à jour") or watched
  // ("à risque") project must not surface an overdue *incomplete* deliverable —
  // a project can't be both on-track and 200 days late. Any past-due task on such
  // a project is simply work already delivered, so mark it done. (Genuinely late
  // projects keep their overdue open task; "terminé" is already all-done.)
  if (status !== "en retard" && status !== "terminé") {
    for (const s of subs) {
      if (!s.done && s.end < REFERENCE_DATE) s.done = true;
    }
  }

  return subs.map(({ end, ...s }) => s);
}

export function buildSampleProjects(): Project[] {
  return ROWS.map((r, idx) => {
    const id = idx + 1;
    return {
      id,
      name: r[0],
      client: r[1],
      discipline: r[2],
      responsableId: r[3],
      phaseIndex: r[4],
      status: r[6],
      budget: r[7],
      start: r[8],
      deadline: r[9],
      subtasks: buildSubtasks(r),
      comments: (SEED_COMMENTS[id] || []).map((c) => ({
        author: TEAM[c.ri].name,
        initials: TEAM[c.ri].initials,
        color: TEAM[c.ri].color,
        text: c.text,
        when: c.when,
      })),
    };
  });
}

export function buildSampleTeam(): TeamMember[] {
  return TEAM.map((m) => ({ ...m }));
}
