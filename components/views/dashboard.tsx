"use client";

import { useRouter } from "next/navigation";

import { FlagIcon } from "../icons";
import { Card, rowProps, StatusPill } from "../ui";
import { computeKpis, statusDistribution, upcomingRendus, vigilanceAlerts } from "@/lib/derive";
import { WEEK_SHORT } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, R, STATUS_META, TX } from "@/lib/tokens";

const STALE_DAYS = 90;

export function Dashboard() {
  const { allDerived, openProject, setFilter, setCalMode } = useProjects();
  const router = useRouter();

  const goProjects = (f: "all" | "en retard" | "à risque" | "à jour" | "terminé") => { setFilter(f); router.push("/projets"); };
  const goWeek = () => { setCalMode("semaine"); router.push("/calendrier"); };

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 20 }}>
        <Kpi title="Projets actifs" value={kpis.active} sub={`portefeuille · ${kpis.total}`} onClick={() => goProjects("all")} />
        <Kpi title="Rendus 7 jours" value={kpis.rendus} sub={WEEK_SHORT} color={C.brand} onClick={goWeek} />
        <Kpi title="En retard" value={kpis.late} sub="à traiter" color={STATUS_META["en retard"].color} accent={kpis.late > 0 ? STATUS_META["en retard"].color : undefined} onClick={kpis.late > 0 ? goLate : undefined} />
        <Card padding="16px 18px">
          <div style={{ ...TX.overline, color: C.ink400 }}>Répartition par statut</div>
          <div style={{ display: "flex", height: 8, borderRadius: R.pill, overflow: "hidden", marginTop: 10, background: C.subtle }}>
            {dist.map((s) =>
              s.count > 0 ? (
                <button
                  key={s.status}
                  onClick={() => goProjects(s.status)}
                  title={`${s.label} · ${s.count} — filtrer`}
                  aria-label={`Filtrer : ${s.label}`}
                  style={{ width: `${(s.count / distTotal) * 100}%`, background: s.color, border: "none", padding: 0, cursor: "pointer" }}
                />
              ) : null,
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", marginTop: 10 }}>
            {dist.map((s) => (
              <button key={s.status} onClick={() => goProjects(s.status)} className="soft-hover" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.ink500, background: "none", border: "none", padding: "1px 3px", borderRadius: R.xs, cursor: "pointer" }}>
                <span style={{ width: 7, height: 7, borderRadius: R.xs, background: s.color, flexShrink: 0 }} />
                {s.label} <span style={{ ...num(11), color: C.ink700 }}>{s.count}</span>
              </button>
            ))}
          </div>
        </Card>
        <Kpi title="Honoraires engagés" value={kpis.budgetFmt} sub={`${kpis.total} projets`} onClick={() => goProjects("all")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20, alignItems: "start" }}>
        <Card padding="6px 20px 14px">
          <h2 style={{ ...TX.h2, margin: "14px 0 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            Prochains rendus <span style={{ ...num(13), color: C.ink400 }}>{upcoming.length}</span>
          </h2>
          {upcoming.length === 0 ? (
            <div style={{ ...TX.caption, color: C.ink500, padding: "10px 6px", borderTop: `1px solid ${C.line}` }}>Aucun rendu à venir.</div>
          ) : null}
          {upcoming.map((r) => (
            <div
              key={r.id}
              {...rowProps(() => openProject(r.id))}
              className="row-hover row-focus"
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 6px", borderTop: `1px solid ${C.line}`, cursor: "pointer", borderRadius: 4 }}
            >
              <div style={{ textAlign: "center", minWidth: 42 }}>
                <div style={num(20)}>{r.renduDay}</div>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: C.ink400, letterSpacing: ".06em", marginTop: 1 }}>{r.renduMon}</div>
              </div>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: r.renduDueColor }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...TX.bodyStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.renduLabel}</div>
                <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: r.renduDueColor }}>{r.renduDaysLabel}</span>
            </div>
          ))}
          {staleCount > 0 ? (
            <div
              {...rowProps(goLate)}
              className="row-hover row-focus"
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 6px", borderTop: `1px solid ${C.line}`, cursor: "pointer", color: STATUS_META["en retard"].color, fontSize: 12, fontWeight: 600, borderRadius: R.xs }}
            >
              <FlagIcon size={14} />
              {staleCount} projet{staleCount > 1 ? "s" : ""} en souffrance (plus de {STALE_DAYS}&#8239;j)
            </div>
          ) : null}
        </Card>

        <Card padding="6px 20px 14px">
          <h2 style={{ ...TX.h2, margin: "14px 0 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            Points de vigilance <span style={{ ...num(13), color: C.ink400 }}>{alerts.length}</span>
          </h2>
          {alerts.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, ...TX.caption, color: C.ink500, padding: "10px 6px", borderTop: `1px solid ${C.line}` }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.brand, flexShrink: 0 }} />
              Aucun point de vigilance.
            </div>
          ) : null}
          {alerts.map((a) => (
            <div
              key={a.id}
              {...rowProps(() => openProject(a.id))}
              className="row-hover row-focus"
              style={{ display: "flex", gap: 11, alignItems: "center", padding: "8px 6px", borderTop: `1px solid ${C.line}`, cursor: "pointer", borderRadius: 4 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: a.statusColor }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...TX.bodyStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ ...TX.caption, color: C.ink500 }}>{a.phaseLabel} · {a.responsable.name}</div>
              </div>
              <StatusPill color={a.statusColor} bg={a.statusBg} label={a.statusLabel} filled />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function Kpi({ title, value, sub, color, accent, onClick }: { title: string; value: string | number; sub: string; color?: string; accent?: string; onClick?: () => void }) {
  return (
    <div {...(onClick ? { ...rowProps(onClick), className: "lift-hover row-focus" } : {})} style={onClick ? { borderRadius: R.lg, cursor: "pointer" } : undefined}>
      <Card padding="16px 18px" style={accent ? { borderTop: `2px solid ${accent}` } : undefined}>
        <div style={{ ...TX.overline, color: C.ink400 }}>{title}</div>
        <div style={{ ...num(34), marginTop: 10, color: color ?? C.ink900 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: C.ink400, marginTop: 7 }}>{sub}</div>
      </Card>
    </div>
  );
}
