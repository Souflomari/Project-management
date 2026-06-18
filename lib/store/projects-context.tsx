"use client";

// Client-side store for the portfolio.
//
// Reads are seeded from the repository on the server (see app/layout.tsx) and
// held in React state. Writes go through the same `repository` singleton and the
// returned record is merged back into state — so the data seam is genuinely
// exercised today. When Supabase is wired in, these actions become server
// actions delegating to a SupabaseRepository; the components calling them do not
// change.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { repository } from "../data";
import {
  buildFilters,
  deriveAll,
  type DerivedProject,
  type FilterDef,
} from "../derive";
import { FINAL_PHASE_INDEX, type Project, type Status, type TeamMember } from "../types";

type FilterKey = "all" | Status;

interface ProjectsContextValue {
  // raw data
  projects: Project[];
  team: TeamMember[];

  // derived
  allDerived: DerivedProject[];
  searched: DerivedProject[];
  filtered: DerivedProject[];
  filters: FilterDef[];
  selected: Project | null;

  // ui state
  search: string;
  filter: FilterKey;
  selectedId: number | null;
  showAdd: boolean;
  calYear: number;
  calMonth: number;
  newName: string;
  newClient: string;
  newResp: number;
  commentDraft: string;

  // ui actions
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
  calPrev: () => void;
  calNext: () => void;

  // data actions
  advancePhase: (id: number) => void;
  setPhase: (id: number, phaseIndex: number) => void;
  setStatus: (id: number, status: Status) => void;
  toggleRendu: (id: number) => void;
  toggleDeliverable: (id: number, index: number) => void;
  addComment: (id: number) => void;
  /** Returns true when a project was created. */
  submitAdd: () => Promise<boolean>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({
  initialProjects,
  initialTeam,
  children,
}: {
  initialProjects: Project[];
  initialTeam: TeamMember[];
  children: ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [team] = useState<TeamMember[]>(initialTeam);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(5); // June
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newResp, setNewResp] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");

  const applyUpdate = useCallback((updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  // ---- data actions (delegate to the repository seam) ----
  const advancePhase = useCallback(
    (id: number) => {
      const current = projects.find((p) => p.id === id);
      if (!current) return;
      const next = Math.min(current.phaseIndex + 1, FINAL_PHASE_INDEX);
      repository.setPhase(id, next).then(applyUpdate);
    },
    [projects, applyUpdate],
  );

  const setPhase = useCallback(
    (id: number, phaseIndex: number) => {
      repository.setPhase(id, phaseIndex).then(applyUpdate);
    },
    [applyUpdate],
  );

  const setStatus = useCallback(
    (id: number, status: Status) => {
      repository.setStatus(id, status).then(applyUpdate);
    },
    [applyUpdate],
  );

  const toggleRendu = useCallback(
    (id: number) => {
      repository.toggleRendu(id).then(applyUpdate);
    },
    [applyUpdate],
  );

  const toggleDeliverable = useCallback(
    (id: number, index: number) => {
      repository.toggleDeliverable(id, index).then(applyUpdate);
    },
    [applyUpdate],
  );

  const addComment = useCallback(
    (id: number) => {
      const text = commentDraft.trim();
      if (!text) return;
      repository.addComment(id, text).then((updated) => {
        applyUpdate(updated);
        setCommentDraft("");
      });
    },
    [commentDraft, applyUpdate],
  );

  const submitAdd = useCallback(async () => {
    if (!newName.trim()) return false;
    const created = await repository.createProject({
      name: newName,
      client: newClient,
      responsableId: newResp,
    });
    setProjects((prev) => [created, ...prev]);
    setShowAdd(false);
    return true;
  }, [newName, newClient, newResp]);

  // ---- ui actions ----
  const openProject = useCallback((id: number) => setSelectedId(id), []);
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const openAdd = useCallback(() => {
    setNewName("");
    setNewClient("");
    setNewResp(0);
    setShowAdd(true);
  }, []);
  const closeAdd = useCallback(() => setShowAdd(false), []);
  const calPrev = useCallback(() => {
    setCalMonth((m) => {
      if (m === 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);
  const calNext = useCallback(() => {
    setCalMonth((m) => {
      if (m === 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  // ---- derived ----
  const allDerived = useMemo(() => deriveAll(projects, team), [projects, team]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDerived;
    return allDerived.filter((p) =>
      `${p.name} ${p.client} ${p.discipline} ${p.responsable.name}`
        .toLowerCase()
        .includes(q),
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
    allDerived,
    searched,
    filtered,
    filters,
    selected,
    search,
    filter,
    selectedId,
    showAdd,
    calYear,
    calMonth,
    newName,
    newClient,
    newResp,
    commentDraft,
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
    calPrev,
    calNext,
    advancePhase,
    setPhase,
    setStatus,
    toggleRendu,
    toggleDeliverable,
    addComment,
    submitAdd,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectsProvider");
  return ctx;
}
