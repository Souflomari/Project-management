"use client";

import { useRouter } from "next/navigation";

import { CalendrierIcon, CheckIcon, FlagIcon } from "../icons";
import { Card, EmptyState, Gauge, rowProps, Sparkline, StatusPill } from "../ui";
import { buildHistory, buildKanban, computeKpis, statusDistribution, upcomingRendus, vigilanceAlerts } from "@/lib/derive";
import { WEEK_SHORT } from "@/lib/format";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, PHASE_COLORS, R, SURFACE, STATUS_META, TX } from "@/lib/tokens";

const STALE_DAYS = 90;

export function Dashboard() {
  const { allDerived, openProject, setFilter, setCalMode, setPhaseFilter } = useProjects();
  const router = useRouter();

  const goProjects = (f: "all" | "en retard" | "à risque" | "à jour" | "terminé") => { setFilter(f); router.push("/projets"); };
  const goWeek = () => { setCalMode("semaine"); router.push("/calendrier"); };
  const goPhase = (i: number) => { setPhaseFilter(i); router.push("/projets"); };

  const phaseCols = buildKanban(allDerived);

  const kpis = computeKpis(allDerived);
  const dist = statusDistribution(allDerived);
  const distTotal = Math.max(1, allDerived.length);

  const history = buildHistory(allDerived);
  const lastH = history[history.length - 1];
  const prevH = history[history.length - 2] ?? lastH;
  const avgDelta = lastH.avg - prevH.avg;
  const rendusDelta = lastH.rendus - prevH.rendus;

  // Portfolio health: a single composite the director can read at a glance.
  // à jour & terminé count fully, à risque half, en retard zero.
  const countOf = (s: string) => dist.find((d) => d.status === s)?.count ?? 0;
  const onTrack = countOf("à jour");
  const atRisk = countOf("à risque");
  const lateCount = countOf("en retard");
  const done = countOf("terminé");
  const health = Math.round((100 * (onTrack + done + atRisk * 0.5)) / distTotal);
  const healthColor = health >= 75 ? C.brand : health >= 55 ? "#B45309" : C.danger;
  const healthLabel = health >= 75 ? "Sous contrôle" : health >= 55 ? "À surveiller" : "Sous tension";

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
      <div className="bento">
        {/* portfolio-health hero — the 2x2 anchor tile, raised tone + larger
            radius so it commands the bento over the flat KPI tiles. */}
        <div className="b-hero">
          <Card elevation={1} radius={R.xxl} padding="22px 24px" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ ...TX.eyebrow, color: C.ink400 }}>Santé du portefeuille</div>

            {/* command-viz: radial health gauge on the governed load ramp */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
              <Gauge
                value={health}
                size={128}
                thickness={11}
                color={healthColor}
                label={<span style={{ ...num(38), color: healthColor }}>{health}</span>}
                sublabel={<span style={{ ...TX.nano, color: C.ink400 }}>/ 100</span>}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: healthColor, flexShrink: 0 }} />
                  <span style={{ ...TX.bodyStrong, color: C.ink900, fontSize: 16 }}>{healthLabel}</span>
                </div>
                <div style={{ ...TX.caption, color: C.ink500, marginTop: 6, maxWidth: 200 }}>
                  Composite pondéré de l&apos;état des {distTotal} projet{distTotal > 1 ? "s" : ""} du portefeuille.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", height: 8, borderRadius: R.pill, overflow: "hidden", marginTop: 18, background: SURFACE.containerHigh, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 12 }}>
              {dist.map((s) => (
                <button key={s.status} onClick={() => goProjects(s.status)} className="soft-hover" style={{ display: "inline-flex", alignItems: "center", gap: 6, ...TX.caption, color: C.ink500, background: "none", border: "none", padding: "2px 4px", borderRadius: R.xs, cursor: "pointer" }}>
                  <span style={{ width: 8, height: 8, borderRadius: R.xs, background: s.color, flexShrink: 0 }} />
                  {s.label} <span style={{ ...num(13), color: C.ink900 }}>{s.count}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...TX.caption, color: C.ink500 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>Avancement moyen <Delta v={avgDelta} unit="pts" /></span>
                <span style={{ ...num(15), color: C.ink900 }}>{kpis.avg}&#8239;%</span>
              </div>
              <div style={{ marginTop: 10, paddingRight: 30 }}>
                <Sparkline values={history.map((h) => h.avg)} height={46} gradient endLabel={`${kpis.avg}%`} />
              </div>
              <div style={{ ...TX.nano, color: C.ink400, marginTop: 4 }}>8 dernières semaines</div>
            </div>
          </Card>
        </div>

        <Kpi className="b-late" title="En retard" value={kpis.late} sub="à traiter" color={STATUS_META["en retard"].color} accent={kpis.late > 0 ? STATUS_META["en retard"].color : undefined} onClick={kpis.late > 0 ? goLate : undefined} />
        <Kpi className="b-rendus7" title="Rendus 7 jours" value={kpis.rendus} sub={WEEK_SHORT} color={C.brand} delta={rendusDelta} onClick={goWeek} />
        <Kpi className="b-active" title="Projets actifs" value={kpis.active} sub={`portefeuille · ${kpis.total}`} onClick={() => goProjects("all")} />
        <Kpi className="b-budget" title="Honoraires engagés" value={kpis.budgetFmt} sub={`${kpis.total} projets`} onClick={() => goProjects("all")} />

        <PhaseStrip className="b-phase" columns={phaseCols} total={allDerived.length} onPhase={goPhase} />

        <div className="b-upcoming">
        <Card padding="6px 20px 14px" style={{ height: "100%" }}>
          <h2 style={{ ...TX.h2, margin: "14px 0 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            Prochains rendus <span style={{ ...num(13), color: C.ink400 }}>{upcoming.length}</span>
          </h2>
          {upcoming.length === 0 ? (
            <div style={{ borderTop: `1px solid ${C.line}` }}>
              <EmptyState compact icon={<CalendrierIcon size={22} />} title="Aucun rendu à venir" hint="Les prochaines échéances du portefeuille apparaîtront ici." />
            </div>
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
        </div>

        <div className="b-vigilance">
        <Card padding="6px 20px 14px" style={{ height: "100%" }}>
          <h2 style={{ ...TX.h2, margin: "14px 0 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
            Points de vigilance <span style={{ ...num(13), color: C.ink400 }}>{alerts.length}</span>
          </h2>
          {alerts.length === 0 ? (
            <div style={{ borderTop: `1px solid ${C.line}` }}>
              <EmptyState compact icon={<span style={{ color: C.brand, display: "flex" }}><CheckIcon size={22} /></span>} title="Aucun point de vigilance" hint="Tous les projets actifs sont à jour ou sous contrôle." />
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
      </div>
    </>
  );
}

/** Week-over-week delta chip; neutral when flat. `goodUp` flips the colour sense. */
function Delta({ v, unit, goodUp = true }: { v: number; unit?: string; goodUp?: boolean }) {
  if (!v) return <span style={{ ...TX.nano, color: C.ink400 }}>±0{unit ? ` ${unit}` : ""}</span>;
  const up = v > 0;
  const good = up === goodUp;
  return (
    <span style={{ ...TX.nano, fontWeight: 600, color: good ? C.brand : STATUS_META["à risque"].color, display: "inline-flex", alignItems: "center", gap: 1 }}>
      {up ? "↑" : "↓"}{Math.abs(v)}{unit ? ` ${unit}` : ""}
    </span>
  );
}

function Kpi({ title, value, sub, color, accent, delta, onClick, className }: { title: string; value: string | number; sub: string; color?: string; accent?: string; delta?: number; onClick?: () => void; className?: string }) {
  const cls = [className, onClick ? "lift-hover row-focus" : ""].filter(Boolean).join(" ") || undefined;
  const display = value;
  return (
    <div className={cls} {...(onClick ? rowProps(onClick) : {})} style={{ borderRadius: R.lg, ...(onClick ? { cursor: "pointer" } : {}) }}>
      <Card padding="16px 18px" style={{ height: "100%", ...(accent ? { borderTop: `2px solid ${accent}` } : {}) }}>
        <div style={{ ...TX.eyebrow, color: C.ink400 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
          <span style={{ ...num(36), color: color ?? C.ink900 }}>{display}</span>
          {delta !== undefined ? <Delta v={delta} /> : null}
        </div>
        <div style={{ ...TX.nano, color: C.ink400, marginTop: 7 }}>{sub}</div>
      </Card>
    </div>
  );
}

/** Full-width phase-distribution strip — a stacked bar segmented by study phase,
 *  echoing the hero's status bar. Each segment filters Projets by that phase. */
function PhaseStrip({ className, columns, total, onPhase }: { className?: string; columns: { phaseIndex: number; label: string; full: string; count: number }[]; total: number; onPhase: (i: number) => void }) {
  const denom = Math.max(1, total);
  return (
    <div className={className}>
      <Card padding="14px 18px" style={{ height: "100%" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ ...TX.eyebrow, color: C.ink400 }}>Répartition par phase</div>
          <div style={{ ...TX.nano, color: C.ink400 }}>{total} projets</div>
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: R.pill, overflow: "hidden", marginTop: 12, background: C.subtle }}>
          {columns.map((c) =>
            c.count > 0 ? (
              <button
                key={c.phaseIndex}
                onClick={() => onPhase(c.phaseIndex)}
                title={`${c.full} · ${c.count} — filtrer`}
                aria-label={`Filtrer : ${c.full}`}
                style={{ width: `${(c.count / denom) * 100}%`, background: PHASE_COLORS[c.phaseIndex], border: "none", padding: 0, cursor: "pointer" }}
              />
            ) : null,
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 12 }}>
          {columns.map((c) =>
            c.count > 0 ? (
              <button key={c.phaseIndex} onClick={() => onPhase(c.phaseIndex)} className="soft-hover" title={c.full} style={{ display: "inline-flex", alignItems: "center", gap: 6, ...TX.caption, color: C.ink500, background: "none", border: "none", padding: "2px 4px", borderRadius: R.xs, cursor: "pointer" }}>
                <span style={{ width: 8, height: 8, borderRadius: R.xs, background: PHASE_COLORS[c.phaseIndex], flexShrink: 0 }} />
                {c.label} <span style={{ ...num(13), color: C.ink900 }}>{c.count}</span>
              </button>
            ) : null,
          )}
        </div>
      </Card>
    </div>
  );
}
