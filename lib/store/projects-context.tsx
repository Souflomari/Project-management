"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  addCommentAction,
  addSubtaskAction,
  addTeamMemberAction,
  createProjectAction,
  deleteSubtaskAction,
  deleteTeamMemberAction,
  setPhaseAction,
  setStatusAction,
  updateSubtaskAction,
  updateTeamMemberAction,
} from "@/app/actions";
import { sampleRepository } from "../data";
import type { SubtaskPatch, TeamMemberPatch } from "../data/repository";
import { buildFilters, deriveAll, type DerivedProject, type FilterDef } from "../derive";
import { toISO, toDate } from "../format";
import {
  FINAL_PHASE_INDEX,
  type NewSubtaskInput,
  type NewTeamMemberInput,
  type Project,
  type Status,
  type TeamMember,
} from "../types";

type FilterKey = "all" | Status;
export type CalMode = "mois" | "semaine" | "agenda";
export type TeamMode = "semaine" | "mois";

interface ProjectsContextValue {
  projects: Project[];
  team: TeamMember[];
  serverBacked: boolean;

  allDerived: DerivedProject[];
  searched: DerivedProject[];
  filtered: DerivedProject[];
  filters: FilterDef[];
  selected: Project | null;

  search: string;
  filter: FilterKey;
  selectedId: number | null;
  showAdd: boolean;
  newName: string;
  newClient: string;
  newResp: number;
  commentDraft: string;

  calMode: CalMode;
  calAnchor: string;
  calProjectFilter: number | null;

  teamMode: TeamMode;
  teamAnchor: string;

  setSearch: (v: string) => void;
  setFilter: (f: FilterKey) => void;
  openProject: (id: number) => void;
  closeDrawer: () => void;
  openAdd: () => void;
  closeAdd: () => void;
  setNewName: (v: string) => void;
  setNewClient: (v: string) => void;
  setNewResp: (i: number) => void;
  setCommentDraft: (v: string) => void;

  setCalMode: (m: CalMode) => void;
  calPrev: () => void;
  calNext: () => void;
  setCalProjectFilter: (id: number | null) => void;

  setTeamMode: (m: TeamMode) => void;
  teamPrev: () => void;
  teamNext: () => void;

  advancePhase: (id: number) => void;
  setPhase: (id: number, phaseIndex: number) => void;
  setStatus: (id: number, status: Status) => void;
  addComment: (id: number) => void;
  submitAdd: () => Promise<boolean>;

  addSubtask: (projectId: number, input: NewSubtaskInput) => void;
  updateSubtask: (projectId: number, subtaskId: number, patch: SubtaskPatch) => void;
  deleteSubtask: (projectId: number, subtaskId: number) => void;

  addTeamMember: (input: NewTeamMemberInput) => void;
  updateTeamMember: (id: number, patch: TeamMemberPatch) => void;
  deleteTeamMember: (id: number) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function shiftMonth(anchor: string, delta: number): string {
  const d = toDate(anchor);
  return toISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
function shiftDays(anchor: string, delta: number): string {
  const d = toDate(anchor);
  d.setDate(d.getDate() + delta);
  return toISO(d);
}

export function ProjectsProvider({
  initialProjects,
  initialTeam,
  serverBacked,
  children,
}: {
  initialProjects: Project[];
  initialTeam: TeamMember[];
  serverBacked: boolean;
  children: ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newResp, setNewResp] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");

  const [calMode, setCalMode] = useState<CalMode>("mois");
  const [calAnchor, setCalAnchor] = useState("2026-06-15");
  const [calProjectFilter, setCalProjectFilter] = useState<number | null>(null);

  const [teamMode, setTeamMode] = useState<TeamMode>("mois");
  const [teamAnchor, setTeamAnchor] = useState("2026-06-15");

  const applyUpdate = useCallback((updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  // ---- project / task / team mutations (server actions vs sample repo) ----
  const setStatus = useCallback(
    (id: number, status: Status) => {
      (serverBacked ? setStatusAction(id, status) : sampleRepository.setStatus(id, status)).then(applyUpdate);
    },
    [serverBacked, applyUpdate],
  );

  const setPhase = useCallback(
    (id: number, phaseIndex: number) => {
      (serverBacked ? setPhaseAction(id, phaseIndex) : sampleRepository.setPhase(id, phaseIndex)).then(applyUpdate);
    },
    [serverBacked, applyUpdate],
  );

  const advancePhase = useCallback(
    (id: number) => {
      const current = projects.find((p) => p.id === id);
      if (!current) return;
      setPhase(id, Math.min(current.phaseIndex + 1, FINAL_PHASE_INDEX));
    },
    [projects, setPhase],
  );

  const addComment = useCallback(
    (id: number) => {
      const text = commentDraft.trim();
      if (!text) return;
      (serverBacked ? addCommentAction(id, text) : sampleRepository.addComment(id, text)).then((u) => {
        applyUpdate(u);
        setCommentDraft("");
      });
    },
    [serverBacked, commentDraft, applyUpdate],
  );

  const submitAdd = useCallback(async () => {
    if (!newName.trim()) return false;
    const input = { name: newName, client: newClient, responsableId: newResp };
    const created = serverBacked ? await createProjectAction(input) : await sampleRepository.createProject(input);
    setProjects((prev) => [created, ...prev]);
    setShowAdd(false);
    return true;
  }, [serverBacked, newName, newClient, newResp]);

  const addSubtask = useCallback(
    (projectId: number, input: NewSubtaskInput) => {
      (serverBacked ? addSubtaskAction(projectId, input) : sampleRepository.addSubtask(projectId, input)).then(applyUpdate);
    },
    [serverBacked, applyUpdate],
  );

  const updateSubtask = useCallback(
    (projectId: number, subtaskId: number, patch: SubtaskPatch) => {
      (serverBacked
        ? updateSubtaskAction(projectId, subtaskId, patch)
        : sampleRepository.updateSubtask(projectId, subtaskId, patch)
      ).then(applyUpdate);
    },
    [serverBacked, applyUpdate],
  );

  const deleteSubtask = useCallback(
    (projectId: number, subtaskId: number) => {
      (serverBacked
        ? deleteSubtaskAction(projectId, subtaskId)
        : sampleRepository.deleteSubtask(projectId, subtaskId)
      ).then(applyUpdate);
    },
    [serverBacked, applyUpdate],
  );

  const addTeamMember = useCallback(
    (input: NewTeamMemberInput) => {
      (serverBacked ? addTeamMemberAction(input) : sampleRepository.addTeamMember(input)).then(setTeam);
    },
    [serverBacked],
  );

  const updateTeamMember = useCallback(
    (id: number, patch: TeamMemberPatch) => {
      (serverBacked ? updateTeamMemberAction(id, patch) : sampleRepository.updateTeamMember(id, patch)).then(setTeam);
    },
    [serverBacked],
  );

  const deleteTeamMember = useCallback(
    (id: number) => {
      (serverBacked ? deleteTeamMemberAction(id) : sampleRepository.deleteTeamMember(id)).then(setTeam);
    },
    [serverBacked],
  );

  // ---- ui actions ----
  const openProject = useCallback((id: number) => setSelectedId(id), []);
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const openAdd = useCallback(() => {
    setNewName("");
    setNewClient("");
    setNewResp(team[0]?.id ?? 0);
    setShowAdd(true);
  }, [team]);
  const closeAdd = useCallback(() => setShowAdd(false), []);

  const calPrev = useCallback(() => {
    setCalAnchor((a) => (calMode === "semaine" ? shiftDays(a, -7) : shiftMonth(a, -1)));
  }, [calMode]);
  const calNext = useCallback(() => {
    setCalAnchor((a) => (calMode === "semaine" ? shiftDays(a, 7) : shiftMonth(a, 1)));
  }, [calMode]);

  const teamPrev = useCallback(() => {
    setTeamAnchor((a) => (teamMode === "semaine" ? shiftDays(a, -7) : shiftMonth(a, -1)));
  }, [teamMode]);
  const teamNext = useCallback(() => {
    setTeamAnchor((a) => (teamMode === "semaine" ? shiftDays(a, 7) : shiftMonth(a, 1)));
  }, [teamMode]);

  // ---- derived ----
  const allDerived = useMemo(() => deriveAll(projects, team), [projects, team]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDerived;
    return allDerived.filter((p) =>
      `${p.name} ${p.client} ${p.discipline} ${p.responsable.name}`.toLowerCase().includes(q),
    );
  }, [allDerived, search]);

  const filtered = useMemo(
    () => (filter === "all" ? searched : searched.filter((p) => p.status === filter)),
    [searched, filter],
  );

  const filters = useMemo(() => buildFilters(searched, filter), [searched, filter]);
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const value: ProjectsContextValue = {
    projects,
    team,
    serverBacked,
    allDerived,
    searched,
    filtered,
    filters,
    selected,
    search,
    filter,
    selectedId,
    showAdd,
    newName,
    newClient,
    newResp,
    commentDraft,
    calMode,
    calAnchor,
    calProjectFilter,
    teamMode,
    teamAnchor,
    setSearch,
    setFilter,
    openProject,
    closeDrawer,
    openAdd,
    closeAdd,
    setNewName,
    setNewClient,
    setNewResp,
    setCommentDraft,
    setCalMode,
    calPrev,
    calNext,
    setCalProjectFilter,
    setTeamMode,
    teamPrev,
    teamNext,
    advancePhase,
    setPhase,
    setStatus,
    addComment,
    submitAdd,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectsProvider");
  return ctx;
}
