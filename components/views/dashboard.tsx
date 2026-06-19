"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

import { CalendrierIcon, CheckIcon, FlagIcon } from "../icons";
import { Card, EmptyState, Gauge, rowProps, Sparkline, StatusPill } from "../ui";
import {
  buildBudget,
  buildHistory,
  buildKanban,
  buildTeamLoad,
  computeKpis,
  statusDistribution,
  upcomingRendus,
  vigilanceAlerts,
  type DerivedProject,
} from "@/lib/derive";
import { fmtEur, formatDays, pct, REFERENCE_DATE, WEEK_LABEL, weekRange, shiftISO } from "@/lib/format";
import { useCountUp } from "@/lib/use-count-up";
import { useProjects } from "@/lib/store/projects-context";
import { C, num, PHASE_COLORS, R, SPRING, SURFACE, STATUS_META, TX } from "@/lib/tokens";

const STALE_DAYS = 90;
const VIGILANCE_VISIBLE = 4;

export function Dashboard() {
  const { allDerived, team, openProject, setFilter, setCalMode, setPhaseFilter } = useProjects();
  const router = useRouter();

  const goProjects = (f: "all" | "en retard" | "à risque" | "à jour" | "terminé") => { setFilter(f); router.push("/projets"); };
  const goWeek = () => { setCalMode("semaine"); router.push("/calendrier"); };
  const goPhase = (i: number) => { setPhaseFilter(i); router.push("/projets"); };
  const goTeam = () => router.push("/equipe");

  const phaseCols = buildKanban(allDerived);

  const kpis = computeKpis(allDerived);
  const dist = statusDistribution(allDerived);
  const distTotal = Math.max(1, allDerived.length);
  const empty = allDerived.length === 0;

  const history = buildHistory(allDerived);
  const lastH = history[history.length - 1];
  const prevH = history[history.length - 2] ?? lastH;
  const avgDelta = lastH.avg - prevH.avg;

  // Portfolio health: composite the director can read at a glance — but the
  // denominator EXCLUDES terminé so an archive of finished work can't mask
  // burning active projects (a 90%-done portfolio of mostly-archived files used
  // to read "Sous contrôle" while every live project was late).
  // à jour counts fully, à risque half, en retard zero.
  const countOf = (s: string) => dist.find((d) => d.status === s)?.count ?? 0;
  const onTrack = countOf("à jour");
  const atRisk = countOf("à risque");
  const lateCount = countOf("en retard");
  const done = countOf("terminé");
  const activeDenom = onTrack + atRisk + lateCount; // terminé excluded
  // Empty / all-archived portfolio: no live work to grade → don't fire a red
  // 0/100 alarm; show a neutral 100 "rien en tension" reading instead.
  const hasLiveWork = activeDenom > 0;
  const health = hasLiveWork ? Math.round((100 * (onTrack + atRisk * 0.5)) / activeDenom) : 100;

  // Banded gauge: red < 55, amber 55–74, green ≥ 75 — at the SAME thresholds the
  // label uses, so colour and words can never disagree.
  const healthAnim = useCountUp(health);
  const band = !hasLiveWork ? "neutral" : health >= 75 ? "green" : health >= 55 ? "amber" : "red";
  const healthColor = band === "neutral" ? C.ink400 : band === "green" ? C.brand : band === "amber" ? "#B45309" : C.danger;
  const healthLabel = !hasLiveWork
    ? (empty ? "Portefeuille vide" : "Rien en tension")
    : health >= 75 ? "Sous contrôle" : health >= 55 ? "À surveiller" : "Sous tension";

  // --- Money & decisions (EVM via buildBudget — was computed but unused) -------
  // TODO(derive): replace with the portfolio-margin / overBudget-count selectors
  // the orchestrator is adding to lib/derive.ts (buildBudget is per-project).
  const budgets = useMemo(() => allDerived.map((p) => ({ p, b: buildBudget(p, team) })), [allDerived, team]);
  const feesTotal = budgets.reduce((s, x) => s + x.b.feesEur, 0);
  const marginTotal = budgets.reduce((s, x) => s + x.b.marginEur, 0);
  const marginPct = feesTotal ? Math.round((marginTotal / feesTotal) * 100) : 0;
  const overBudget = budgets.filter((x) => x.b.overBudget);
  const overCount = overBudget.length;

  // --- Team charge / workload signal -----------------------------------------
  // Uses the corrected, non-double-counting allocation charge (chargeAllocPct)
  // so the dashboard agrees with the Équipe view instead of showing inflated peaks.
  const teamLoad = useMemo(() => {
    const range = { start: weekRange(REFERENCE_DATE).start, end: shiftISO(weekRange(REFERENCE_DATE).start, 27) };
    return buildTeamLoad(allDerived, team, range, "week");
  }, [allDerived, team]);
  const avgCharge = teamLoad.length ? Math.round(teamLoad.reduce((s, m) => s + m.chargeAllocPct, 0) / teamLoad.length) : 0;
  const overloaded = teamLoad.filter((m) => m.chargeAllocPct > 100).length;
  const peak = teamLoad.reduce((acc, m) => (m.chargeAllocPct > acc.chargeAllocPct ? m : acc), teamLoad[0] ?? null);

  // --- Rendus livrés (7 derniers jours) — activity, not the upcoming list ------
  // TODO(derive): replace with the rendus-livrés selector.
  const deliveredRecent = useMemo(() => {
    const since = shiftISO(REFERENCE_DATE, -7);
    const out: { id: number; name: string; taskName: string; end: string }[] = [];
    for (const p of allDerived) {
      for (const s of p.subtasksD) {
        if (s.done && s.end > since && s.end <= REFERENCE_DATE) {
          out.push({ id: p.id, name: p.name, taskName: s.name, end: s.end });
        }
      }
    }
    return out.sort((a, b) => b.end.localeCompare(a.end)).slice(0, 6);
  }, [allDerived]);

  // Animated figures (~750ms ramp on load).
  const lateAnim = useCountUp(kpis.late);
  const avgAnim = useCountUp(kpis.avg);
  const onTrackAnim = useCountUp(onTrack);
  const marginAnim = useCountUp(marginTotal);
  const marginPctAnim = useCountUp(marginPct);
  const overAnim = useCountUp(overCount);
  const atRiskAnim = useCountUp(atRisk);
  const chargeAnim = useCountUp(avgCharge);

  const isStale = (renduDays: number | null) => renduDays !== null && renduDays < -STALE_DAYS;
  const staleCount = allDerived.filter((p) => p.nextTask && isStale(p.renduDays)).length;
  const upcoming = upcomingRendus(allDerived.filter((p) => !isStale(p.renduDays)));

  // Vigilance with a CAUSE + severity sort; de-duped against the hero (which
  // already shows the status counts) by carrying *why* each item is flagged.
  const alerts = useMemo(() => buildVigilance(allDerived), [allDerived]);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, VIGILANCE_VISIBLE);
  const overflow = alerts.length - VIGILANCE_VISIBLE;

  function goLate() {
    setFilter("en retard");
    router.push("/projets");
  }

  return (
    <>
      {/* period / date context — anchors every figure below to a window */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ ...TX.caption, color: C.ink500 }}>
          Vue d’ensemble du portefeuille — <span style={{ color: C.ink700, fontWeight: 560 }}>{WEEK_LABEL}</span>
        </div>
        <div style={{ ...TX.nano, color: C.ink400 }}>{kpis.total} projet{kpis.total > 1 ? "s" : ""} suivi{kpis.total > 1 ? "s" : ""}</div>
      </div>

      <div className="bento enter-stagger">
        {/* portfolio-health hero — the 2x2 anchor tile */}
        <div className="b-hero">
          <Card elevation={1} radius={R.xxl} padding="22px 24px" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ ...TX.overline, color: C.ink500 }}>Santé du portefeuille</div>

            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
              <Gauge
                value={healthAnim}
                size={128}
                thickness={11}
                color={healthColor}
                label={<span style={{ ...num(38), color: healthColor }}>{Math.round(healthAnim)}</span>}
                sublabel={<span style={{ ...TX.nano, color: C.ink400 }}>/ 100</span>}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: healthColor, flexShrink: 0 }} />
                  <span style={{ ...TX.bodyStrong, color: C.ink900, fontSize: 16 }}>{healthLabel}</span>
                </div>
                <div style={{ ...TX.caption, color: C.ink500, marginTop: 6, maxWidth: 200 }}>
                  {hasLiveWork
                    ? `Composite pondéré des ${activeDenom} projet${activeDenom > 1 ? "s" : ""} actif${activeDenom > 1 ? "s" : ""} (terminés exclus).`
                    : "Aucun projet actif à évaluer pour le moment."}
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
                    className="anim-bar"
                    style={{ width: `${(s.count / distTotal) * 100}%`, minWidth: 6, ["--fill" as string]: `${(s.count / distTotal) * 100}%`, background: s.color, border: "none", padding: 0, cursor: "pointer" }}
                  />
                ) : null,
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 12 }}>
              {dist.map((s) => (
                <button key={s.status} onClick={() => goProjects(s.status)} className="soft-hover" style={{ display: "inline-flex", alignItems: "center", gap: 6, ...TX.caption, color: C.ink500, background: "none", border: "none", padding: "2px 4px", borderRadius: R.xs, cursor: "pointer" }}>
                  <span style={{ width: 8, height: 8, borderRadius: R.xs, background: s.color, flexShrink: 0 }} />
                  {s.label}{" "}
                  <span style={{ ...num(13), color: s.status === "à jour" ? C.brand : C.ink900 }}>
                    {s.status === "à jour" ? Math.round(onTrackAnim) : s.count}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...TX.caption, color: C.ink500 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>Avancement moyen <Delta v={avgDelta} unit="pts" /></span>
                <span style={{ ...num(15), color: C.brand }}>{pct(Math.round(avgAnim))}</span>
              </div>
              <div style={{ marginTop: 10, paddingRight: 30 }}>
                <Sparkline values={history.map((h) => h.avg)} height={46} gradient endLabel={pct(kpis.avg)} />
              </div>
              <div style={{ ...TX.nano, color: C.ink400, marginTop: 4 }}>8 dernières semaines</div>
            </div>
          </Card>
        </div>

        {/* director-grade KPI row: urgency, money, decisions */}
        <Kpi
          className="b-late"
          title="En retard"
          value={Math.round(lateAnim)}
          sub={lateCount > 0 ? "à traiter en priorité" : "rien en retard"}
          subColor={lateCount > 0 ? STATUS_META["en retard"].color : undefined}
          dot={lateCount > 0 ? STATUS_META["en retard"].color : undefined}
          onClick={lateCount > 0 ? goLate : undefined}
        />
        <Kpi
          className="b-rendus7"
          title="Marge projetée"
          value={fmtEur(marginAnim)}
          sub={`${marginPct >= 0 ? "+" : "−"}${pct(Math.abs(Math.round(marginPctAnim)))} des honoraires`}
          subColor={marginTotal < 0 ? C.danger : marginPct < 10 ? "#B45309" : C.ink400}
          dot={marginTotal < 0 ? C.danger : marginPct < 10 ? "#B45309" : undefined}
          onClick={() => goProjects("all")}
        />
        <Kpi
          className="b-active"
          title="Projets sous l’eau"
          value={Math.round(overAnim)}
          sub={overCount > 0 ? "coût engagé > honoraires" : "marge préservée"}
          subColor={overCount > 0 ? "#B45309" : undefined}
          dot={overCount > 0 ? "#B45309" : undefined}
          onClick={overCount > 0 ? () => goProjects("all") : undefined}
        />
        <Kpi
          className="b-budget"
          title="À risque"
          value={Math.round(atRiskAnim)}
          sub={atRisk > 0 ? "marge ou délai menacés" : "aucun signal"}
          subColor={atRisk > 0 ? STATUS_META["à risque"].color : undefined}
          dot={atRisk > 0 ? STATUS_META["à risque"].color : undefined}
          onClick={atRisk > 0 ? () => goProjects("à risque") : undefined}
        />

        <PhaseStrip className="b-phase" columns={phaseCols} total={allDerived.length} onPhase={goPhase} />

        {/* workload + recent-activity pillars — one full-width row that auto-fits
            to a single column on narrow screens (no media query needed). */}
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px,100%), 1fr))", gap: 16 }}>
          {/* workload / capacity tile — was unused (buildTeamLoad available) */}
          <WorkloadTile
            avgCharge={chargeAnim}
            band={loadBand(avgCharge)}
            overloaded={overloaded}
            members={teamLoad.length}
            peakName={peak?.member.name ?? "—"}
            peakPct={peak?.chargeAllocPct ?? 0}
            onClick={goTeam}
          />

          {/* recent activity — rendus livrés (7 j) */}
          <Card padding="6px 20px 14px" style={{ height: "100%" }}>
            <h2 style={{ ...TX.h2, margin: "14px 0 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
              Rendus livrés <span style={{ ...TX.nano, color: C.ink400, fontWeight: 500 }}>· 7 derniers jours</span>
              <span style={{ ...num(13), color: C.ink400, marginLeft: "auto" }}>{deliveredRecent.length}</span>
            </h2>
            {deliveredRecent.length === 0 ? (
              <div style={{ borderTop: `1px solid ${C.line}` }}>
                <EmptyState compact icon={<CheckIcon size={22} />} title="Aucun rendu livré" hint="Les tâches achevées de la semaine s’afficheront ici." />
              </div>
            ) : null}
            {deliveredRecent.map((d, i) => (
              <motion.div
                key={`${d.id}-${d.taskName}-${i}`}
                {...rowProps(() => openProject(d.id))}
                className="row-hover row-focus"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.gentle, delay: i * 0.03 }}
                style={{ display: "flex", gap: 11, alignItems: "center", padding: "8px 6px", borderTop: `1px solid ${C.line}`, cursor: "pointer", borderRadius: 4 }}
              >
                <span style={{ display: "flex", color: C.brand, flexShrink: 0 }}><CheckIcon size={15} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...TX.bodyStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.taskName}</div>
                  <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                </div>
              </motion.div>
            ))}
          </Card>
        </div>

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
                <div style={{ ...TX.eyebrow, color: C.ink500, marginTop: 1 }}>{r.renduMon}</div>
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
              {staleCount} projet{staleCount > 1 ? "s" : ""} en souffrance (plus de {formatDays(STALE_DAYS)})
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
          <AnimatePresence initial={false}>
            {visibleAlerts.map((a) => (
              <motion.div
                key={a.id}
                layout
                {...rowProps(() => openProject(a.id))}
                className="row-hover row-focus"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING.gentle}
                style={{ display: "flex", gap: 11, alignItems: "center", padding: "8px 6px", borderTop: `1px solid ${C.line}`, cursor: "pointer", borderRadius: 4, overflow: "hidden" }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: a.statusColor }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...TX.bodyStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                  <div style={{ ...TX.caption, color: C.ink500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ color: a.causeColor, fontWeight: 560 }}>{a.cause}</span> · {a.responsable.name}
                  </div>
                </div>
                <StatusPill color={a.statusColor} bg={a.statusBg} label={a.statusLabel} filled />
              </motion.div>
            ))}
          </AnimatePresence>
          {overflow > 0 ? (
            <button
              onClick={() => setShowAllAlerts((v) => !v)}
              className="soft-hover row-focus"
              style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 6px", borderTop: `1px solid ${C.line}`, background: "none", border: "none", cursor: "pointer", ...TX.caption, color: C.ink500, fontWeight: 560 }}
            >
              {showAllAlerts ? "Réduire" : `Voir tout (${alerts.length})`}
            </button>
          ) : null}
        </Card>
        </div>
      </div>
    </>
  );
}

// --------------------------------------------------------------------- vigilance

interface VigilanceItem {
  id: number;
  name: string;
  responsable: { name: string };
  statusColor: string;
  statusBg: string;
  statusLabel: string;
  cause: string;
  causeColor: string;
  severity: number;
}

/** Promote each at-risk / late project to a *reasoned* alert: the row carries
 *  WHY it is flagged (overdue, imminent deadline, stalled), sorted by severity,
 *  so the panel is decision-grade rather than a duplicate of the status filter. */
function buildVigilance(all: DerivedProject[]): VigilanceItem[] {
  const items: VigilanceItem[] = [];
  for (const p of all) {
    if (p.status !== "en retard" && p.status !== "à risque") continue;
    let cause = p.phaseLabel;
    let causeColor: string = C.ink500;
    let severity = p.status === "en retard" ? 100 : 50;
    if (p.renduDays !== null && p.renduDays < 0) {
      cause = `${-p.renduDays} j de retard sur le rendu`;
      causeColor = STATUS_META["en retard"].color;
      severity += Math.min(40, -p.renduDays);
    } else if (p.renduDays !== null && p.renduDays <= 6) {
      cause = "échéance imminente";
      causeColor = STATUS_META["à risque"].color;
      severity += 20;
    } else if (!p.nextTask) {
      cause = "aucune tâche planifiée";
      causeColor = STATUS_META["à risque"].color;
      severity += 10;
    } else {
      cause = `phase ${p.phaseLabel}`;
    }
    items.push({
      id: p.id,
      name: p.name,
      responsable: { name: p.responsable.name },
      statusColor: p.statusColor,
      statusBg: p.statusBg,
      statusLabel: p.statusLabel,
      cause,
      causeColor,
      severity,
    });
  }
  return items.sort((a, b) => b.severity - a.severity);
}

function loadBand(p: number): "low" | "ok" | "high" | "over" {
  if (p > 100) return "over";
  if (p >= 85) return "high";
  if (p >= 40) return "ok";
  return "low";
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

function Kpi({ title, value, sub, subColor, dot, delta, onClick, className }: { title: string; value: string | number; sub: string; subColor?: string; dot?: string; delta?: number; onClick?: () => void; className?: string }) {
  const cls = [className, onClick ? "lift-hover row-focus" : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cls} {...(onClick ? rowProps(onClick) : {})} style={{ borderRadius: R.lg, ...(onClick ? { cursor: "pointer" } : {}) }}>
      <Card padding="16px 18px" style={{ height: "100%" }}>
        <div style={{ ...TX.overline, color: C.ink700 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
          <span style={{ ...num(36), color: C.ink900 }}>{value}</span>
          {delta !== undefined ? <Delta v={delta} /> : null}
        </div>
        <div style={{ ...TX.nano, color: subColor ?? C.ink400, marginTop: 7, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {dot ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} /> : null}
          {sub}
        </div>
      </Card>
    </div>
  );
}

/** Team charge / capacity snapshot for the next 4 weeks — the missing workload
 *  pillar. A single calm→amber→terracotta bar + an over-capacity call-out. */
function WorkloadTile({ avgCharge, band, overloaded, members, peakName, peakPct, onClick }: { avgCharge: number; band: "low" | "ok" | "high" | "over"; overloaded: number; members: number; peakName: string; peakPct: number; onClick: () => void }) {
  const color = band === "over" ? "#C2683E" : band === "high" ? "#B45309" : C.brand;
  const shown = Math.round(avgCharge);
  return (
    <div className="lift-hover row-focus" {...rowProps(onClick)} style={{ borderRadius: R.lg, cursor: "pointer", height: "100%" }}>
      <Card padding="16px 18px" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ ...TX.overline, color: C.ink700 }}>Charge de l’équipe</div>
          <div style={{ ...TX.nano, color: C.ink400 }}>4 prochaines semaines · {members} pers.</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
          <span style={{ ...num(36), color: C.ink900 }}>{pct(shown)}</span>
          <span style={{ ...TX.nano, color: C.ink400 }}>capacité moyenne</span>
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: R.pill, overflow: "hidden", marginTop: 14, background: SURFACE.containerHigh, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
          <div className="anim-bar" style={{ width: `${Math.min(100, shown)}%`, ["--fill" as string]: `${Math.min(100, shown)}%`, background: color }} />
        </div>
        <div style={{ ...TX.nano, color: overloaded > 0 ? "#B45309" : C.ink400, marginTop: "auto", paddingTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {overloaded > 0 ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#B45309", flexShrink: 0 }} /> : null}
          {overloaded > 0
            ? `${overloaded} personne${overloaded > 1 ? "s" : ""} en surcharge — pic ${peakName} ${pct(peakPct)}`
            : `Pic : ${peakName} ${pct(peakPct)}`}
        </div>
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
          <div style={{ ...TX.overline, color: C.ink500 }}>Répartition par phase</div>
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
                className="anim-bar"
                style={{ width: `${(c.count / denom) * 100}%`, minWidth: 6, ["--fill" as string]: `${(c.count / denom) * 100}%`, background: PHASE_COLORS[c.phaseIndex], border: "none", padding: 0, cursor: "pointer" }}
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
