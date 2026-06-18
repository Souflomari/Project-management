"use client";

import { useRouter } from "next/navigation";

import { FlagIcon } from "../icons";
import { Card, StatusPill } from "../ui";
import { computeKpis, statusDistribution, upcomingRendus, vigilanceAlerts } from "@/lib/derive";
import { WEEK_SHORT } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, TX } from "@/lib/tokens";

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
        <Kpi title="Projets actifs" value={kpis.active} sub={`portefeuille · ${kpis.total}`} />
        <Kpi title="Rendus 7 jours" value={kpis.rendus} sub={WEEK_SHORT} color={C.brand} />
        <Kpi title="En retard" value={kpis.late} sub="action requise" color="#A42421" />
        <Card padding="14px 16px">
          <div style={{ fontSize: 11.5, color: C.ink500, fontWeight: 600 }}>Avancement moyen</div>
          <div style={{ ...num(32), marginTop: 6 }}>{kpis.avg}%</div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 12, background: C.subtle }}>
            {dist.map((s) =>
              s.count > 0 ? <div key={s.status} title={`${s.label} · ${s.count}`} style={{ width: `${(s.count / distTotal) * 100}%`, background: s.color }} /> : null,
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 7 }}>
            {dist.map((s) => (
              <span key={s.status} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: C.ink500 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
                {s.count}
              </span>
            ))}
          </div>
        </Card>
        <Kpi title="Honoraires engagés" value={kpis.budgetFmt} sub={`${kpis.total} projets`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
        <Card padding="16px 20px">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{ ...TX.h2, margin: 0 }}>Prochains rendus</h2>
            <span style={{ ...TX.overline, color: C.ink400 }}>échéancier</span>
          </div>
          <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 4px" }}>Livrables triés par date d&apos;échéance.</p>
          {upcoming.map((r) => (
            <div
              key={r.id}
              onClick={() => openProject(r.id)}
              className="row-hover"
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
              onClick={goLate}
              className="row-hover"
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 6px", borderTop: `1px solid ${C.line}`, cursor: "pointer", color: "#B4532E", fontSize: 12, fontWeight: 600, borderRadius: 4 }}
            >
              <FlagIcon size={14} />
              {staleCount} projet{staleCount > 1 ? "s" : ""} en souffrance (&gt; {STALE_DAYS} j) — voir →
            </div>
          ) : null}
        </Card>

        <Card padding="16px 20px">
          <h2 style={{ ...TX.h2, margin: "0 0 4px" }}>Points de vigilance</h2>
          <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 4px" }}>Projets en retard ou à risque.</p>
          {alerts.map((a) => (
            <div
              key={a.id}
              onClick={() => openProject(a.id)}
              className="row-hover"
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

function Kpi({ title, value, sub, color }: { title: string; value: string | number; sub: string; color?: string }) {
  return (
    <Card padding="14px 16px">
      <div style={{ fontSize: 11.5, color: C.ink500, fontWeight: 600 }}>{title}</div>
      <div style={{ ...num(34), marginTop: 6, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.ink400, marginTop: 6 }}>{sub}</div>
    </Card>
  );
}
