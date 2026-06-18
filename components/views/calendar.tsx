"use client";

import {
  buildMonthGrid,
  buildTaskEvents,
  eventsInRange,
  type TaskEvent,
} from "@/lib/derive";
import { MONS_LONG, MONTHS_FULL, WEEKDAYS, monthRange, toDate, weekRange } from "@/lib/format";
import { useProjects, type CalMode } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

const navBtn: React.CSSProperties = {
  border: "1px solid #E2E6E0",
  background: "#fff",
  cursor: "pointer",
  width: 34,
  height: 34,
  borderRadius: 3,
  fontSize: 16,
  color: "#3B5560",
};

const MODES: CalMode[] = ["mois", "semaine", "agenda"];
const MODE_LABEL: Record<CalMode, string> = { mois: "Mois", semaine: "Semaine", agenda: "Agenda" };

export function CalendarView() {
  const { allDerived, calMode, calAnchor, calProjectFilter, setCalMode, calPrev, calNext, setCalProjectFilter, openProject } =
    useProjects();

  const projects = calProjectFilter === null ? allDerived : allDerived.filter((p) => p.id === calProjectFilter);
  const events = buildTaskEvents(projects);
  const anchor = toDate(calAnchor);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const label =
    calMode === "semaine"
      ? weekLabel(calAnchor)
      : `${calMode === "agenda" ? "Agenda — " : ""}${MONS_LONG[month]} ${year}`;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={calPrev} style={navBtn} aria-label="Précédent">‹</button>
        <h2 style={{ margin: 0, fontFamily: FONT_NUM, fontSize: 21, fontWeight: 600, letterSpacing: ".02em", minWidth: 210 }}>{label}</h2>
        <button onClick={calNext} style={navBtn} aria-label="Suivant">›</button>

        {/* mode toggle */}
        <div style={{ display: "flex", gap: 2, background: "#EAEEE7", borderRadius: 4, padding: 3, marginLeft: 8 }}>
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setCalMode(m)}
              style={{
                border: "none",
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 3,
                background: calMode === m ? "#fff" : "transparent",
                color: calMode === m ? "#17823D" : "#6F6F6F",
              }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {/* project filter */}
        <select
          value={calProjectFilter ?? ""}
          onChange={(e) => setCalProjectFilter(e.target.value ? Number(e.target.value) : null)}
          style={{
            marginLeft: "auto",
            border: "1px solid #E2E6E0",
            background: "#fff",
            borderRadius: 3,
            padding: "8px 10px",
            font: "inherit",
            fontSize: 13,
            color: "#233038",
            maxWidth: 260,
          }}
        >
          <option value="">Tous les projets</option>
          {allDerived.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {calMode === "mois" ? (
        <MonthView year={year} month={month} events={events} onOpen={openProject} />
      ) : calMode === "semaine" ? (
        <WeekView anchorISO={calAnchor} events={events} onOpen={openProject} />
      ) : (
        <AgendaView year={year} month={month} events={events} onOpen={openProject} />
      )}
    </>
  );
}

function weekLabel(iso: string): string {
  const { start, end } = weekRange(iso);
  const a = toDate(start);
  const b = toDate(end);
  return `${a.getDate()} – ${b.getDate()} ${MONTHS_FULL[b.getMonth()]} ${b.getFullYear()}`;
}

function EventChip({ e, onOpen, compact }: { e: TaskEvent; onOpen: (id: number) => void; compact?: boolean }) {
  return (
    <div
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen(e.projectId);
      }}
      title={`${e.projectName} — ${e.taskName}`}
      style={{
        borderLeft: `3px solid ${e.color}`,
        background: "#F6F8F4",
        borderRadius: "2px",
        padding: "2px 5px",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#233038", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {e.projectName}
      </div>
      {!compact ? (
        <div style={{ fontSize: 9, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {e.taskName}
        </div>
      ) : null}
    </div>
  );
}

function MonthView({ year, month, events, onOpen }: { year: number; month: number; events: TaskEvent[]; onOpen: (id: number) => void }) {
  const cells = buildMonthGrid(year, month, events);
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#F6F8F4", borderBottom: "1px solid #E2E6E0" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ padding: "9px 12px", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#6F6F6F", fontWeight: 700 }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              minHeight: 96,
              borderRight: "1px solid #EEF1EC",
              borderBottom: "1px solid #EEF1EC",
              padding: "5px 6px",
              background: c.day === null ? "#FAFBF9" : c.isToday ? "#E6F1E9" : "#fff",
            }}
          >
            {c.day !== null ? (
              <div style={{ fontFamily: FONT_NUM, fontSize: 13, fontWeight: c.isToday ? 700 : 500, color: c.isToday ? "#17823D" : "#3B5560" }}>
                {c.day}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              {c.events.slice(0, 3).map((e, j) => (
                <EventChip key={j} e={e} onOpen={onOpen} />
              ))}
              {c.events.length > 3 ? (
                <div style={{ fontSize: 9.5, color: "#9AA39B", fontWeight: 600 }}>+{c.events.length - 3} autres</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekView({ anchorISO, events, onOpen }: { anchorISO: string; events: TaskEvent[]; onOpen: (id: number) => void }) {
  const { start } = weekRange(anchorISO);
  const startD = toDate(start);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startD);
    d.setDate(startD.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, dow: WEEKDAYS[i], num: d.getDate(), isToday: iso === "2026-06-15", events: events.filter((e) => e.date === iso) };
  });

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 6, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
      {days.map((d) => (
        <div key={d.iso} style={{ borderRight: "1px solid #EEF1EC", minHeight: 320 }}>
          <div style={{ padding: "9px 10px", background: d.isToday ? "#E6F1E9" : "#F6F8F4", borderBottom: "1px solid #E2E6E0" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#6F6F6F", fontWeight: 700 }}>{d.dow}</div>
            <div style={{ fontFamily: FONT_NUM, fontSize: 18, fontWeight: 600, color: d.isToday ? "#17823D" : "#233038" }}>{d.num}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6 }}>
            {d.events.map((e, j) => (
              <EventChip key={j} e={e} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgendaView({ year, month, events, onOpen }: { year: number; month: number; events: TaskEvent[]; onOpen: (id: number) => void }) {
  const range = monthRange(year, month);
  const list = eventsInRange(events, range);

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6E0", borderRadius: 6, overflow: "hidden" }}>
      {list.length === 0 ? (
        <div style={{ padding: 20, fontSize: 13, color: "#6F6F6F" }}>Aucune échéance ce mois-ci.</div>
      ) : (
        list.map((e, i) => {
          const d = toDate(e.date);
          return (
            <div
              key={i}
              onClick={() => onOpen(e.projectId)}
              style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 16px", borderTop: i ? "1px solid #EEF1EC" : "none", cursor: "pointer" }}
            >
              <div style={{ textAlign: "center", minWidth: 44 }}>
                <div style={{ fontFamily: FONT_NUM, fontSize: 18, fontWeight: 600, lineHeight: 1 }}>{d.getDate()}</div>
                <div style={{ fontSize: 9, textTransform: "uppercase", color: "#9AA39B", letterSpacing: ".06em" }}>{WEEKDAYS[(d.getDay() + 6) % 7]}</div>
              </div>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: e.color }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.projectName}</div>
                <div style={{ fontSize: 11.5, color: "#6F6F6F" }}>{e.taskName}</div>
              </div>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: e.assigneeColor, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {e.assigneeInitials}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
