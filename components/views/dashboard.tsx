"use client";

import { useRouter } from "next/navigation";

import { computeKpis, statusDistribution, upcomingRendus, vigilanceAlerts } from "@/lib/derive";
import { WEEK_SHORT } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E6E0",
  borderRadius: 4,
};

const STALE_DAYS = 90;

export function Dashboard() {
  const { allDerived, openProject, setFilter } = useProjects();
  const router = useRouter();

  const kpis = computeKpis(allDerived);
  const dist = statusDistribution(allDerived);
  const distTotal = Math.max(1, allDerived.length);

  const isStale = (renduDays: number | null) => renduDays !== null && renduDays < -STALE_DAYS;
  const staleCount = allDerived.filter((p) => p.nextTask && isStale(p.renduDays)).length;
  const upcoming = upcomingRendus(allDerived.filter((p) => !isStale(p.renduDays)));
  const alerts = vigilanceAlerts(allDerived);

  function goLate() {
    setFilter("en retard");
    router.push("/projets");
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 9, marginBottom: 14 }}>
        <Kpi title="Projets actifs" value={kpis.active} sub={`portefeuille · ${kpis.total}`} />
        <Kpi title="Rendus 7 jours" value={kpis.rendus} sub={WEEK_SHORT} color="#17823D" />
        <Kpi title="En retard" value={kpis.late} sub="action requise" color="#A42421" />
        <div style={{ ...card, padding: "11px 13px" }}>
          <div style={{ fontSize: 11.5, color: "#6F6F6F", fontWeight: 600 }}>Avancement moyen</div>
          <div style={{ fontFamily: FONT_NUM, fontSize: 34, fontWeight: 600, marginTop: 2, lineHeight: 1 }}>
            {kpis.avg}%
          </div>
          {/* Status distribution — portfolio composition at a glance */}
          <div style={{ display: "flex", height: 8, borderRadius: 3, overflow: "hidden", marginTop: 11, background: "#EEF1EC" }}>
            {dist.map((s) =>
              s.count > 0 ? (
                <div
                  key={s.status}
                  title={`${s.label} · ${s.count}`}
                  style={{ width: `${(s.count / distTotal) * 100}%`, background: s.color }}
                />
              ) : null,
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 9px", marginTop: 6 }}>
            {dist.map((s) => (
              <span key={s.status} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "#6F6F6F" }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: s.color }} />
                {s.count}
              </span>
            ))}
          </div>
        </div>
        <Kpi title="Honoraires engagés" value={kpis.budgetFmt} sub={`${kpis.total} projets`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, alignItems: "start" }}>
        {/* Prochains rendus */}
        <div style={{ ...card, padding: "13px 15px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Prochains rendus</h2>
            <span style={{ fontSize: 11, color: "#6F6F6F", textTransform: "uppercase", letterSpacing: ".07em" }}>échéancier</span>
          </div>
          <p style={{ margin: "0 0 2px", fontSize: 12, color: "#6F6F6F" }}>Livrables triés par date d&apos;échéance.</p>
          {upcoming.map((r) => (
            <div
              key={r.id}
              onClick={() => openProject(r.id)}
              className="row-hover"
              style={{ display: "flex", gap: 13, alignItems: "center", padding: "6px 4px", borderTop: "1px solid #EEF1EC", cursor: "pointer" }}
            >
              <div style={{ textAlign: "center", minWidth: 42 }}>
                <div style={{ fontFamily: FONT_NUM, fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{r.renduDay}</div>
                <div style={{ fontSize: 9, textTransform: "uppercase", color: "#9AA39B", letterSpacing: ".06em", marginTop: 1 }}>{r.renduMon}</div>
              </div>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 1, background: r.renduDueColor }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.renduLabel}</div>
                <div style={{ fontSize: 11.5, color: "#6F6F6F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap", color: r.renduDueColor }}>{r.renduDaysLabel}</span>
            </div>
          ))}
          {staleCount > 0 ? (
            <div
              onClick={goLate}
              className="row-hover"
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 4px", borderTop: "1px solid #EEF1EC", cursor: "pointer", color: "#B4532E", fontSize: 11.5, fontWeight: 600 }}
            >
              <span style={{ fontSize: 13 }}>⚑</span>
              {staleCount} projet{staleCount > 1 ? "s" : ""} en souffrance (&gt; {STALE_DAYS} j) — voir →
            </div>
          ) : null}
        </div>

        {/* Points de vigilance */}
        <div style={{ ...card, padding: "13px 15px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Points de vigilance</h2>
          <p style={{ margin: "0 0 2px", fontSize: 12, color: "#6F6F6F" }}>Projets en retard ou à risque.</p>
          {alerts.map((a) => (
            <div
              key={a.id}
              onClick={() => openProject(a.id)}
              className="row-hover"
              style={{ display: "flex", gap: 11, alignItems: "center", padding: "6px 4px", borderTop: "1px solid #EEF1EC", cursor: "pointer" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: a.statusColor, alignSelf: "center" }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: "#6F6F6F" }}>{a.phaseLabel} · {a.responsable.name}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap", color: a.statusColor, background: a.statusBg, padding: "2px 7px", borderRadius: 3 }}>
                {a.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Kpi({
  title,
  value,
  sub,
  color,
}: {
  title: string;
  value: string | number;
  sub: string;
  color?: string;
}) {
  return (
    <div style={{ ...card, padding: "11px 13px" }}>
      <div style={{ fontSize: 11.5, color: "#6F6F6F", fontWeight: 600 }}>{title}</div>
      <div style={{ fontFamily: FONT_NUM, fontSize: 34, fontWeight: 600, marginTop: 2, lineHeight: 1, color }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "#6F6F6F", marginTop: 5 }}>{sub}</div>
    </div>
  );
}
