// Realistic sample data for the Setec portfolio. Each project is seeded with a
// set of editable tasks (sous-tâches); progress and the "prochain rendu" are
// derived from them. Swapping to Supabase replaces the repository, not this file.

import { shiftISO, taskEnd, taskStartForEnd } from "../format";
import type { Project, Status, Subtask, TeamMember } from "../types";

export const TEAM: TeamMember[] = [
  { id: 0, name: "C. Mercier", initials: "CM", color: "#17823D", role: "Cheffe de projet senior" },
  { id: 1, name: "A. Lefèvre", initials: "AL", color: "#3A9095", role: "Ingénieur OA" },
  { id: 2, name: "N. Diallo", initials: "ND", color: "#4C8AA3", role: "Ingénieure hydraulique" },
  { id: 3, name: "M. Caron", initials: "MC", color: "#E1832F", role: "Chef de projet géotech." },
  { id: 4, name: "L. Petit", initials: "LP", color: "#A42421", role: "Ingénieure VRD" },
  { id: 5, name: "S. Roux", initials: "SR", color: "#3B7179", role: "Chef de projet énergie" },
  { id: 6, name: "H. Bonnet", initials: "HB", color: "#9C7257", role: "Architecte bâtiment" },
  { id: 7, name: "F. Aubry", initials: "FA", color: "#1D4459", role: "Directeur ferroviaire" },
];

// [name, client, discipline, leadIdx, phaseIndex, progress, status, budget(k€), start, deadline, renduLabel, renduDate]
type Row = [
  string, string, string, number, number, number, Status, number, string, string, string, string,
];

const ROWS: Row[] = [
  ["Ligne 18 — Viaduc T2A", "Société du Grand Paris", "Ouvrages d'art", 0, 3, 62, "à risque", 4200, "2025-03-01", "2026-09-30", "DCE — Lot T2A", "2026-06-18"],
  ["Échangeur A480 Sud", "DIR Centre-Est", "VRD / Mobilités", 1, 4, 74, "à jour", 1850, "2025-06-15", "2026-07-22", "Dossier PRO", "2026-06-26"],
  ["STEP Aquaval — Tranche 2", "Régie des Eaux", "Hydraulique", 2, 2, 41, "à jour", 980, "2025-11-01", "2026-08-14", "Rapport APD", "2026-07-03"],
  ["Tunnel de Belledonne", "SNCF Réseau", "Tunnels / Géotechnique", 3, 5, 88, "à jour", 7600, "2024-09-01", "2026-10-05", "Note de calcul", "2026-06-16"],
  ["Quartier Rive-Étoile", "Métropole de Lyon", "Bâtiment / VRD", 4, 1, 28, "à risque", 3100, "2026-01-10", "2026-09-10", "Rapport APS", "2026-06-20"],
  ["Pont de l'Estuaire — Inspection", "CD44", "Ouvrages d'art", 1, 3, 55, "en retard", 420, "2025-09-01", "2026-06-30", "Rapport diagnostic", "2026-06-12"],
  ["Parc éolien Vent d'Oc", "EnR Sud", "Énergie", 5, 0, 12, "à jour", 2400, "2026-04-01", "2026-11-20", "Étude de faisabilité", "2026-07-15"],
  ["Réseau de chaleur Centre", "Ville de Lyon", "Énergie / VRD", 2, 4, 69, "à risque", 1500, "2025-05-01", "2026-07-08", "DCE", "2026-06-19"],
  ["Gare multimodale Nord", "Région Hauts-de-France", "Bâtiment / Mobilités", 0, 2, 47, "à jour", 5400, "2025-10-01", "2026-08-28", "Rapport APD", "2026-07-10"],
  ["Digue maritime Port-Vendres", "Grand Port Maritime", "Maritime / Hydraulique", 3, 3, 53, "à jour", 2900, "2025-07-01", "2026-09-18", "Dossier PRO", "2026-06-30"],
  ["Requalification Bd Sud", "Ville de Nantes", "VRD", 4, 6, 100, "terminé", 740, "2024-06-01", "2026-06-10", "DOE", "2026-06-05"],
  ["Pôle hospitalier Est", "CHU de Bordeaux", "Bâtiment", 5, 5, 81, "à jour", 9800, "2024-11-01", "2026-12-15", "Visa exécution", "2026-06-17"],
  ["LGV Sud-Ouest — Section 3", "SNCF Réseau", "Infrastructure ferroviaire", 7, 2, 38, "à jour", 12500, "2025-09-15", "2027-03-30", "Rapport APD", "2026-07-22"],
  ["Passerelle Confluence", "Métropole de Lyon", "Ouvrages d'art", 0, 4, 64, "à jour", 1300, "2025-08-01", "2026-08-05", "DCE", "2026-06-29"],
  ["Station épuration Garonne", "SIAAP", "Hydraulique", 2, 1, 22, "à risque", 4600, "2026-02-01", "2026-10-30", "Rapport APS", "2026-06-24"],
  ["Tramway T9 — Extension", "Île-de-France Mobilités", "Mobilités", 1, 3, 58, "à jour", 8200, "2025-04-01", "2026-11-15", "Dossier PRO", "2026-07-06"],
  ["Barrage de Serre — Réfection", "EDF", "Hydraulique / Géotech.", 3, 5, 76, "à risque", 5900, "2024-12-01", "2026-09-25", "Note de calcul", "2026-06-23"],
  ["Centre logistique A7", "Groupe Argan", "Bâtiment / VRD", 6, 4, 71, "à jour", 2200, "2025-06-01", "2026-07-30", "DCE", "2026-07-01"],
  ["Échangeur ferroviaire Est", "SNCF Réseau", "Infrastructure ferroviaire", 7, 2, 44, "à jour", 6700, "2025-10-15", "2026-12-20", "Rapport APD", "2026-07-13"],
  ["Front de mer La Rochelle", "Ville de La Rochelle", "Aménagement urbain", 4, 1, 19, "à jour", 1100, "2026-03-01", "2026-10-10", "Rapport APS", "2026-07-18"],
  ["Usine hydroélectrique Drac", "EDF", "Énergie / Hydraulique", 5, 3, 51, "en retard", 8800, "2025-02-01", "2026-06-28", "Dossier PRO", "2026-06-10"],
  ["Hôtel de Région — Réhab", "Région Occitanie", "Bâtiment", 6, 4, 67, "à jour", 3400, "2025-07-15", "2026-08-20", "DCE", "2026-07-04"],
  ["Voie verte des Gaves", "Département 64", "VRD / Aménagement", 1, 0, 8, "à jour", 560, "2026-05-01", "2027-01-15", "Étude de faisabilité", "2026-08-05"],
  ["Pont levant du Port", "Grand Port Maritime", "Ouvrages d'art", 0, 6, 100, "terminé", 4100, "2024-03-01", "2026-05-20", "DOE", "2026-05-15"],
  ["Data center Sud — Lot CVC", "OVHcloud", "Bâtiment / Énergie", 3, 5, 84, "à jour", 5200, "2025-01-01", "2026-09-05", "Visa exécution", "2026-06-21"],
];

const SEED_COMMENTS: Record<number, { ri: number; text: string; when: string }[]> = {
  1: [{ ri: 7, text: "Coordination interfaces avec le lot génie civil à caler avant le DCE.", when: "il y a 2 j" }],
  6: [{ ri: 1, text: "Accès à l'ouvrage soumis à autorisation — relance du MOA en cours.", when: "hier" }],
  21: [{ ri: 5, text: "Validation MOA en attente, planning à réajuster.", when: "il y a 4 j" }],
};

// A few duration profiles so derived progress varies across projects.
const DAY_PROFILES = [
  [8, 14, 10, 16, 8],
  [6, 12, 9, 20, 7],
  [10, 18, 12, 14, 11],
  [5, 10, 8, 12, 6],
  [9, 16, 11, 18, 9],
];

/** Build the editable task list for a project, with done flags ~matching progress. */
function buildSubtasks(row: Row, idx: number): Subtask[] {
  const [, , , lead, , progress, status, , start, deadline, renduLabel, renduDate] = row;
  const pool = [lead, (lead + 3) % 8, (lead + 5) % 8].filter((v, i, a) => a.indexOf(v) === i);
  const m = (i: number) => pool[i % pool.length];
  const d = DAY_PROFILES[idx % DAY_PROFILES.length];

  const t1Start = start;
  const t1End = taskEnd(t1Start, d[0]);
  const t2Start = shiftISO(t1End, 3);
  const t3Start = taskStartForEnd(renduDate, d[2]);
  const t4Start = shiftISO(renduDate, 4);
  const t5Start = taskStartForEnd(deadline, d[4]);

  const defs: { name: string; assigneeId: number; start: string; plannedDays: number }[] = [
    { name: "Cadrage & collecte de données", assigneeId: lead, start: t1Start, plannedDays: d[0] },
    { name: "Études préliminaires & relevés", assigneeId: m(1), start: t2Start, plannedDays: d[1] },
    { name: renduLabel, assigneeId: lead, start: t3Start, plannedDays: d[2] },
    { name: "Coordination & validations MOA", assigneeId: m(2), start: t4Start, plannedDays: d[3] },
    { name: "Clôture & DOE", assigneeId: m(1), start: t5Start, plannedDays: d[4] },
  ].sort((a, b) => a.start.localeCompare(b.start));

  const total = defs.reduce((s, d) => s + d.plannedDays, 0);
  const target = (progress / 100) * total;
  let running = 0;

  return defs.map((d, i) => {
    running += d.plannedDays;
    const done = status === "terminé" ? true : running <= target + 0.5;
    return {
      id: i + 1,
      name: d.name,
      assigneeId: d.assigneeId,
      start: d.start,
      plannedDays: d.plannedDays,
      done,
      // Linear Finish-to-Start chain: each task depends on the previous one.
      dependsOn: i === 0 ? [] : [i],
    };
  });
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
      subtasks: buildSubtasks(r, idx),
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
