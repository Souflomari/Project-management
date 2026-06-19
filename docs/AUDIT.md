# Setec Pilotage — Grand Audit (overhaul cycle)

Benchmark bar: Apple / Google / Linear / Stripe / Vercel. Severity: **P0** critical · **P1** major · **P2** minor · **P3** nit.
Status of the audit fleet: 20 parallel auditors (13 cross-cutting dimensions + 7 per-surface). This file is filled as each reports.

---

## CROSS-CUTTING ROOT CAUSE (recurring across dimensions)
**Tokens are authored but not enforced.** `SP`, `TX` weights, dot/avatar sizes, durations, and colors are defined in `lib/tokens.ts` but components free-hand ~260 spacing literals, ~126 font literals, 6 amber/red hues, 5 dot sizes, 6 avatar sizes, and 6+ hardcoded durations. ~80% of findings trace back to this. The overhaul is largely **mechanical enforcement** + a handful of structural decisions — which suits the appetite for big change.

---

## 1. TYPOGRAPHY
- **[P1]** TX docblock is stale/wrong (says "Inter Tight", "14/440" — actual is Geist, 15/450, 600 headings). Fix the spec comment.
- **[P1]** Display tier is monotone **600** from 44px→20px. Top-tier modulates weight *down* as size goes up. → introduce weight modulation (display 540-550, h1 580, h2 600) + `fontOpticalSizing`.
- **[P1]** ~126 inline font literals; 9-16px band is a free-for-all (9/10/10.5/11/11.5/12/12.5/13/13.5/14/16 invented inline). Same datum (due label, member name, wordmark) renders at 3 different sizes. → add missing rungs (`label/14`, `11`, `control`/`controlSm`), sweep all literals, lint-ban numeric fontSize.
- **[P1]** Weight chaos: **9 weights** (440/450/500/540/550/560/600/640/700), many imperceptibly apart. → collapse to `FW {regular450, medium550, semibold600}` + deliberate 700 wordmark.
- **[P1]** `FONT_NUM` (a numeric-intent alias) applied as family to **text** labels in kanban + gantt. Semantically wrong.
- **[P2]** `num()` hardcodes -.02em + 560 for ALL sizes → cramps 12-13px table figures. Make size-aware (tight+heavy ≥24px; 0 tracking + 500 ≤14px).
- **[P2]** Heading rungs too close (28/23/20 ~17% apart) — not decisive levels. Collapse to a cleaner modular scale.
- **[P2]** Line-heights don't land on a 4px rhythm; fractional sizes (12.5/11.5) smear on non-retina.
- **[P2]** eyebrow vs overline contract already violated; `Chip` overrides the very `TX.eyebrow` token it spreads (10.5/.05 vs 11.5/.06).
- **[P3]** Global `tabular-nums` on the whole shell forces tabular figures in prose too. Drop global; rely on `num()`.
- **[P3]** Decorative text-arrows (↑↓→×↗↳←) used as type; should be icon components.
- **TOP OVERHAULS:** (1) TX = only source, add rungs, sweep literals, lint. (2) 4 named weights + weight-modulated heading ramp. (3) size-aware `num()`, drop global tabular, standardize U+202F units. (4) vertical-rhythm + `measure`(~66ch) tokens. (5) extract `<Wordmark>`, `<DueLabel>`, `<Clamp>`, one control-type source.

## 2. COLOR / CONTRAST / WCAG
- **[P1]** `SH.focus` green ring at .20 alpha ≈ **1.3:1** on white — fails WCAG 2.4.11 (needs ≥3:1). Most clear-cut a11y failure. → solid/≥.6-alpha 2px brand ring.
- **[P1]** **5/10 `AVATAR_PALETTE`** swatches fail white-text 4.5:1 (worst `#4C8AA3` 3.0:1). Darken failing swatches.
- **[P1]** `ink400 #857E78` ≈ **3.5:1** — fails AA for the small (11.5px) labels it's used on. Bump to ~`#6F6862` or restrict to ≥18.66px.
- **[P1]** PhaseBadge renders 10.5px text in the SAME light fill hue → `#9C9488` ≈2.9:1, `#3F8E5E` ≈3.1:1 FAIL. Decouple text color (darkened) from fill, like STATUS_META does.
- **[P1]** **6 uncoordinated warm "warning" hues** (#9A4708/#B45309/#C2683E/#D2895F/#B5532E/#B5392E). Unify into one amber + one terracotta ramp.
- **[P1]** Status/load encoded by color alone in rings/dueColor/heatmap; heat ramp sage→terracotta is on the red-green confusion axis. Add non-color cue + monotonic lightness.
- **[P2]** Universal **green hover wash** dilutes "green = positive" semantics AND drops `ink500` text on it to ≈4.3:1 (FAIL). → neutral hover, reserve green for selected/active.
- **[P2]** ~6 unrelated teals (tertiary vs avatar vs phase) — colorblind-confusable, "drawn from AVATAR_PALETTE" comment is false.
- **[P2]** Many raw hexes bypass tokens (#fff, #9f3227, #faeeeb, #eccfc9, #ecebe8, #6e6661); STATUS_META/ringColor/dueColor/chargeColor return raw hex instead of `C.*` so changing `C.danger` won't propagate.
- **TOP OVERHAULS:** (1) fix focus ring. (2) retune avatar palette for AA. (3) unify warm-warning ramp + decouple phase text. (4) neutral hover, green=selection. (5) colorblind-safe heat ramp + lift ink400/ink500 margins.

## 3. SPACING / LAYOUT / GRID / DENSITY
- **[P0]** `SP` defined but ~unused: **~260 raw spacing literals** vs ~20 `SP[]` refs. → make SP the single source, sweep.
- **[P0]** SP scale isn't truly 4px and **omits the most-used values** (6 appears 23×, 10 appears 19× — neither on scale). → redefine `{0,2,4,6,8,10,12,16,20,24,32,40,48,64}`.
- **[P1]** Off-grid odd values everywhere (5,7,9,11,13,22,26,27,30,37). The "AI-eyeballed" tell.
- **[P1]** Header (`padding 12px 28px`) and `.app-main` (`36px`) **don't share a left edge** — title and content misalign by 8px. Unify gutter token.
- **[P1]** Bento tiles have **5 different padding regimes** (22/24, 16/18, 14/18, 6/20/14) — reads as 5 components, not one material. → 3 named card densities.
- **[P1]** **5 different "header→content" gaps** across views (16/12, 16/14, 8/20...). `SectionHeader`/`Toolbar` exist but views hand-roll. Standardize.
- **[P1]** Dot sizes: **5** (5/6/7/8/9px) for the same atom. Avatar sizes: **6** un-tokenized. PercentReadout: 3 widths. → `<Dot>`, tokenized `Avatar` sizes, one `<PercentReadout>`.
- **[P1]** `maxWidth:1520` + fixed 36px gutter strands content on ultrawide; detail page nests 3 measures (1520/860/660) and reads under-designed/sparse.
- **[P2]** Table header vs row vertical padding differ by 1px (11 vs 10) — subpixel drift; column widths are eyeballed magic numbers.
- **TOP OVERHAULS:** (1) make SP real + right-shaped + sweep. (2) unify gutter & left rail + responsive gutter step. (3) tokenize card density, harmonize bento. (4) standardize section rhythm via SectionHeader/Toolbar. (5) systematize atoms (Dot/Avatar/PercentReadout/table columns).

## 4. MOTION & MICRO-INTERACTIONS
- **[P0]** App is **static during use** — sort/filter rebuild rows with no animation (table, kanban, gantt); kanban drop = teleport; calendar drop = teleport; list add/remove/checkbox/accordion/tabs all snap. framer-motion installed, used in **1 place** (Card).
- **[P1]** Durations bypass `DUR` tokens — ≥6 hardcoded ms values (120/140/160/180/200/220/260/420/500). No `SPRING` token despite spring being the house curve.
- **[P1]** **Two competing card-hover impls** that disagree (framer spring y:-4/SH.lg vs CSS `.card-lift` y:-2/different shadow). Pick one.
- **[P1]** Gantt accordion expand, bar-drag commit + undo, all snap. Team % static while bars grow (number/viz disagree).
- **[P1]** Toast stack doesn't reflow on dismiss (siblings jump). Mutations (add/delete subtask, comment, member, status) never animate.
- **[P2]** Segmented/workspace-switcher/tabs/filter pills hard-cut active state — no sliding pill (`layoutId`). Checkbox check is instant.
- **[P2]** `.enter-stagger` is hardcoded nth-child capped at 10; runs *simultaneously* with the page `pageIn` → double motion on dashboard.
- **[P2]** Modal/Drawer hand-roll setTimeout exit (drawer 200ms anim vs 220ms timeout = 20ms dead frame). → AnimatePresence.
- **TOP OVERHAULS:** (1) framer `layout`+`AnimatePresence` engine for ALL lists (table/kanban/gantt/team/calendar/toasts/palette/comments/subtasks) → FLIP. (2) shared-element `layoutId` signature transitions (card→drawer, row→detail, calendar chip flight). (3) tokenize timing + add `SPRING`, delete duplicate hover. (4) migrate Modal/Drawer/Toaster to AnimatePresence. (5) sliding-pill Segmented + tactile checkbox/stepper/"just-created" pulse.

## 5. DATA VISUALIZATION
- **[P1]** Everything stops at native `title` tooltips — no hover detail, no drill-down (sparkline unreadable per-point, heatmap, gantt, strips).
- **[P1]** Most metrics are **snapshots, not trends** — only 1 of 4 KPIs has a delta; health gauge ignores `history`; no zone-banding on the gauge.
- **[P1]** EVM burn bar mixes two denominators (cost% in text vs fees% in bar) and lacks Actual Cost → no real CPI/SPI; should be an **S-curve over time**.
- **[P1]** Gantt dependency arrows have no obstacle routing (cut through bars), assume row order=id order; **critical-path red == late red** (semantic collision).
- **[P1]** Team "heatmap" double-encodes load (height AND color) and uses `chargeColor` not the documented `heatColor` ramp (dead code).
- **[P2]** Stacked-bar segments have no min width (tiny statuses vanish); "Honoraires engagés" mislabeled (it's total fees, not committed).
- **[P2]** No chart has a text-alternative/data-table for screen readers.
- **MISSING VIZ:** EVM S-curve, per-KPI sparklines, burndown, portfolio timeline/swimlane, forward resource-allocation forecast, risk matrix, phase funnel/aging.
- **TOP OVERHAULS:** (1) EVM S-curve (PV/EV/AC + CPI/SPI). (2) interactive sparkline + delta on every KPI. (3) fix gantt arrows + recolor critical path. (4) rebuild team heatmap as real forward-looking allocation heatmap w/ drill-down. (5) dashboard portfolio timeline + banded gauge + min segment widths.

## 6. BRAND & IDENTITY
- **[P0]** Favicon/app-icon drawn in **`'Inter Tight'`** (not loaded; falls back to system-ui) while wordmark is Geist. Outline the Geist "s" to vector paths in icon.svg/apple-icon.svg.
- **[P0/strategic]** No logomark, only "lowercase grotesk + dot" — the most common indie-SaaS pattern. For a real engineering group, commission a true mark (dot as milestone/structural node) reducible to favicon.
- **[P1]** Wordmark copy-pasted as raw JSX in 4 files at **600 AND 700** weight, 3 sizes. → single `<Wordmark>` component.
- **[P1]** **5 greens** (brand/brandHover/brandText/brandDot/inversePrimary); the *dot* uses a 5th (`#1E8E48`) different from everything else green. Lock the wordmark green.
- **[P1]** `public/` empty: no OG image, no manifest/maskable icons, no Safari pinned-tab, no .ico. Every shared link unfurls bare.
- **[P1]** No brand pattern/signature texture; generic gray skeleton shimmer carries zero identity. Login is a generic centered card.
- **[P1]** `themeColor` light = `#FAF9F7` no longer matches the actual `#FFFFFF` canvas (visible chrome seam on mobile).
- **TOP OVERHAULS:** (1) fix+unify wordmark as vector-locked component. (2) design a real logomark. (3) fill `public/` (OG, manifest, maskable, pinned-tab, .ico). (4) promote the dot to a recurring motif + signature pulsing-dot loader + one brand pattern. (5) make login a hero + fix themeColor.

---

*(Remaining dimensions & per-surface deep dives appended as auditors report.)*

## 7. DEPTH / ELEVATION / SHADOW
- **[P0]** `ELEV` claims "tone-first" but every tier is `#FFFFFF` differing only by shadow — comment lies; ELEV[0] `none` never used (Card hardcodes SH.sm). Decide shadow-only and make steps distinct, OR reintroduce faint tonal lift.
- **[P1]** `SH.sm` (.04) resting shadow is **perceptually invisible** on white → cards look painted-on (the "sterile" read). Bump to ~.05-.06 two-layer.
- **[P1]** Light direction inconsistent (sm pure-drop vs md/lg negative-spread two-layer). Rebuild SH as unified monotonic 2-layer ramp xs→sm→md→lg→overlay.
- **[P1]** Elevation hierarchy collapsed: hover card, modal, palette, drawer, toast **all share SH.lg** — nothing reads definitively "above." Add dedicated `SH.overlay`; cap hover below it.
- **[P1]** Two competing card-lift impls (framer y:-4/SH.lg vs CSS .card-lift y:-2/custom). Hover jumps invisible→modal-grade (14× opacity leap). Green-tinted hover shadows read "webby." Unify; one step; neutral shadow.
- **[P1]** Overlay scrims: 3 different colors/opacities (modal/drawer warm `.34`, palette cold `#111 .32`), **none blurred** while header/tabbar DO use glass. Unify warm scrim + backdrop-blur.
- **[P2]** Nested "box-in-box" stat insets use a 2nd outset border instead of recessed inner-shadow. Sticky table/gantt headers cast no shadow on scroll.
- **TOP OVERHAULS:** (1) unified 2-layer monotonic SH ramp, visible resting shadow. (2) real elevation hierarchy + SH.overlay. (3) unified blurred warm scrims. (4) one hover physics, neutral shadow. (5) govern focus ring/hairline rule/recessed insets.

## 8. COMPONENTS & ICONOGRAPHY
- **[P0]** No `Tooltip` primitive — all hover help is native `title=` (1s delay, no touch, no keyboard); Gantt/Kanban carry PRIMARY data in titles → invisible on touch.
- **[P1]** No `Tabs` primitive — 2 hand-rolled tablists (pill vs underline), neither with arrow-key roving focus (Segmented regressed its own pattern).
- **[P1]** No `ToggleButton`/`SelectableChip` — reimplemented ≥4× with 4 different active treatments (filter, responsable picker, status setter, palette row).
- **[P1]** `Button` has no `loading`/spinner (double-submit risk; no spinner glyph exists); `Input`/`Select` have no `error`/`invalid`/adornment slots (header search hand-built for this reason). Promote the private `Field` wrapper.
- **[P1]** Icons incomplete; **text glyphs (↗ → × ▦ +) substitute for missing SVGs** (craft tell). SearchIcon missing strokeLinejoin; uneven default sizes; consider adopting Lucide for utility glyphs, keep bespoke nav marks.
- **[P2]** Missing: Switch/Toggle, Textarea, Badge/Count, Kbd, Dot, Spinner, Menu/Dropdown, indeterminate Checkbox, Avatar `src`/AvatarGroup. Card lift unconditional (false affordance on static cards). Skeleton+drawer re-declare card style; 4 inline Avatars bypass the primitive.
- **TOP OVERHAULS:** (1) real Tooltip, purge title=. (2) Tabs + ToggleButton primitives. (3) Button/Input states (loading/error/adornments) + Field. (4) icon overhaul (replace text glyphs, Lucide for utility). (5) consolidate Card/Avatar/Dot/Kbd, gate hover-lift.

## 9. MICROCOPY / I18N / FR TYPOGRAPHY
- **[P1]** `pct()`/`formatDays()` helpers exist but ~70% of figures bypass them (hardcoded `&#8239;%`, plain-space `%`/`j`, bare `:`). NNBSP work silently regresses; ASCII-space % can wrap.
- **[P1]** Missing NNBSP before `:` `?` `!` in many labels/toasts/modals. Guillemets `« »` lack inner NNBSP.
- **[P1]** Apostrophe regression: straight `'` still in "Aujourd'hui" (planning/calendar toolbars), "maître d'ouvrage", "l'échéance", "Vue d'ensemble" — two apostrophes for the same word across views.
- **[P1]** Login surfaces **raw English Supabase errors** in an all-French UI.
- **[P1]** Terminology collisions: "Honoraires engagés" (dashboard = total fees) collides with EVM "Coût engagé" (committed); rendu vs échéance vs tâche conflated.
- **[P2]** aria-labels: context-free "Précédent"/"Suivant"; color labels announce hex ("Couleur #2563EB"). Fragile concatenated pluralization ("ser{ont/a} supprimée{s}"). "Resp." abbrev among full words.
- **TOP OVERHAULS:** (1) centralize+enforce typography helpers (lint literal %/j/:). (2) fix apostrophes end-to-end via shared strings. (3) controlled glossary + rename "Honoraires engagés". (4) standardize instruction voice + guillemet NNBSP. (5) translate Supabase errors, fix aria wording, de-fragment pluralization.

## 10. ACCESSIBILITY (WCAG 2.2)  — [report pending; cross-cutting items already surfaced]
- **[P1]** Focus ring ~1.3:1 fails 2.4.11 (see Color). Color-only encoding of status/load/phase (see Color/Data-viz). Kanban cards & collapsed columns not keyboard-operable; drag-reschedule (gantt/calendar/kanban) has no keyboard path. No `aria-live` for toasts/optimistic updates. Calendar/gantt not ARIA grids; no `aria-current` on today. Tooltips hover-only. Touch targets (12px gantt bars, 5px dots, chips) below 44px.
- (Full a11y report to be appended.)

## 11. RESPONSIVE / ADAPTIVE
- **[P0]** `viewport` export sets only themeColor — **no `viewport-fit=cover`** → `env(safe-area-inset)` resolves to 0 on notched iPhones (tab bar/padding strategy silently dead). One-line fix.
- **[P0]** Projects table (`minWidth:760`, 8-col grid) and Gantt (`LEFT_W:324`+900px) are **unusable on phone** (horizontal-scroll slabs); no card-list fallback. Search+count vanish on mobile (`.header-search` hidden ≤640) → no table search at all on phone.
- **[P1]** Drawer 500px + internal fixed 2/3-col grids + fixed-width date inputs overflow on ~312px. Calendar month/week `minWidth:640` side-scrolls; Agenda (responsive) not auto-selected on mobile.
- **[P1]** All-px type scale ignores user font-size/Dynamic Type; 28px h1 on phone. `100vh` magic-constant heights (gantt) hide under mobile chrome (use 100dvh).
- **[P1]** `maxWidth:1520` strands content on ultrawide (~520px dead gutters each side at 2560).
- **Bright spots:** Team `minmax(min(340px,100%),1fr)` auto-fill, bento reflow, kanban horizontal scroll, 48px tab targets.
- **TOP OVERHAULS:** (1) viewport-fit fix. (2) mobile card-list for table + slim/fallback gantt. (3) mobile bottom-sheet drawer + auto-fit internal grids. (4) fluid rem/clamp type + mobile heading sizes. (5) 100dvh + chrome-aware heights, calendar→agenda on mobile, widen maxWidth for data views.

## 12. IA / NAVIGATION / UX FLOWS
- **[P0]** The 4 lenses (Planning/Calendrier/Kanban + Liste) are hidden behind a context-only header switcher — **3 top-level views have zero entry point** from Dashboard/Équipe. Promote to persistent nav (expandable "Projets" group or always-visible switcher) + mobile.
- **[P0]** No account layer: avatar is fake ("P. Dubois", not the auth user), not clickable; only action is buried "Se déconnecter" (unreachable in rail/mobile). No Settings/Profile/Workspace/Theme. No `/parametres`.
- **[P0]** No onboarding/first-run; empty portfolio → red "Sous tension" 0/100 gauge (looks broken). Main Projets list doesn't use the existing `EmptyState`; Gantt has no empty state at all.
- **[P1]** No breadcrumbs; header shows list-search/count chrome on `/projets/[id]` detail (contextually wrong). No `not-found.tsx`. Drawer vs page differ in layout (cards vs tabs) → same project looks like 2 screens; peek→full loses scroll/edits; no prev/next in drawer.
- **[P1]** Add-project modal too thin (no phase/dates) + double-navigation bug (store opens drawer AND modal pushes `/projets`). Reschedule confirmation inconsistent (calendar modal vs gantt instant+undo vs kanban silent). Filtering absent on Calendar/Team (they read `allDerived`, ignoring filters → saved views don't apply). 2 parallel search systems. Saved views localStorage-only, don't capture lens. No notifications/activity. Skeleton shows 6 nav items vs real 3 (visible swap).
- **TOP OVERHAULS:** (1) promote lenses to persistent nav. (2) account layer (avatar menu + /parametres + real identity). (3) first-run + empty-state system + fix empty gauge. (4) unify drawer/page + breadcrumbs + context-aware header + not-found. (5) consistent search/filter/reschedule across lenses; server-side shareable saved views.

## 13. TECHNICAL / PERFORMANCE
- **[P0]** `projects-context` `value` object rebuilt every render, unmemoized → **every `useProjects()` consumer re-renders on every state change** (one search keystroke re-renders the whole app). Split into stable-actions + state contexts / selector subscriptions (Zustand or use-context-selector).
- **[P1]** Mutation callbacks depend on `projects`/`team` → ~15 callbacks churn every edit (defeats useCallback). Use functional updaters + refs.
- **[P1]** `deriveAll` re-derives ALL projects (incl. CPM) on any single edit; dashboard analytics (`buildHistory`/`computeKpis`) unmemoized → recompute ~45×/load during count-up. Memoize per-project by reference; memoize dashboard analytics.
- **[P1]** framer-motion imported for ONE `Card` hover → ~30-50kb for one effect every other animation is CSS/rAF. **Either drop motion (CSS hover) OR commit to it for the motion overhaul** (note: this conflicts with the Motion dimension's recommendation — decision needed).
- **[P1]** No virtualization (table/gantt/kanban) — fine at 25, scaling wall ~100+. 4 duplicate hand-rolled drag implementations → extract `usePointerDrag`. Gantt `onScroll`→setState re-renders tree per frame.
- **[P1/strategic]** Inline-style architecture allocates style objects per render (`num()`/`...TX` spread fresh each time); the CSS-vars+inline-JS hybrid is the smell. **Bold call: migrate to vanilla-extract** (keeps `tokens.ts` as typed source, zero-runtime, static CSS, real :hover/media). Biggest long-term-health win.
- **[P2]** REFERENCE_DATE duplicated in derive.ts; tableSort.key unvalidated on hydration; no error boundary around the Supabase fetch (blanks app vs degrade to sample).
- **TOP OVERHAULS:** (1) re-architect store (memoize/split/selectors). (2) migrate styling to vanilla-extract. (3) resolve motion-library decision. (4) memoize all derivation. (5) usePointerDrag + plan virtualization + fix scroll-state.

---

# PER-SURFACE DEEP DIVES (top items)

## Dashboard
- **[P0]** Re-anchor on MONEY & DECISIONS — `buildBudget` (margin/committed/overBudget) fully built but UNUSED; "Honoraires engagés" is static vanity sum, mislabeled. KPIs skew clerical (actifs ~constant, rendus duplicates list below). → margin/projects-under-water/à-risque/team-charge KPIs.
- **[P0]** `DashboardSkeleton` targets DEAD `.dash-*` classes (zero CSS matches) while live view is `.bento` → layout-shift flash every load. Rewrite against `.bento`.
- **[P1]** Health gauge: `terminé` counts as full health (archive can mask burning active work); opaque 0.5 weighting; no bands/target/trend. Empty portfolio → red 0/100 false alarm.
- **[P1]** Missing: workload snapshot (`buildTeamLoad`/`team` available, unused), recent-activity feed, contract-deadline timeline, "à traiter aujourd'hui". No period context/selector/date.
- **[P1]** "Points de vigilance" redundant w/ status filter & hero (no *cause*); lists hide truncation (no "voir tout (N)"); En retard urgency suppressed.

## Projets table
- **[P1]** Data layer far richer than table shows: EVM budget-health, team roster, days-late, expected-progress — all computed, none surfaced. Missing high-value columns.
- **[P1]** No grouping (buildKanban/statusDistribution exist), no inline editing (full optimistic mutation layer exists & unused — pills/avatars static), no column customization, no virtualization, header not sticky.
- **[P1]** Faceted filter counts dishonest (ignore active resp/phase facets); resp/phase are weak single-select `<select>`; saved views write-only select (no active indicator/rename, localStorage-only).
- **TOP:** inline-edit cells, group-by + subtotals, column customization + missing columns, virtualization + sticky header/first-col, real faceted filters + saved-views strip.

## Planning / Gantt
- **[P1]** No milestones/jalons (model floors plannedDays≥1) — phase-gates should be diamonds. Only 3 coarse zooms (no Day/Year/Fit); single-tier month header (year only on Jan); weeks unlabeled at week zoom; weekends not shaded (working-day bars "lie" on calendar axis).
- **[P1]** Dependency arrows: project-scoped only, naive 2-segment routing (cut through bars, break on backward links), non-interactive (can't create/delete). Critical-path uses danger-red (collides w/ late). Drag doesn't ripple/flag dependents; snaps to calendar not working days.
- **[P1]** Subtask bars have no in-bar label/progress; left panel fixed/non-resizable/no columns; collapsed by default (hides CP/arrows); no expand-all; no empty state.
- **TOP:** 2-tier multi-zoom axis + weekend shading; dependency-aware editor (routing+create/delete+ripple); milestones as diamonds; resizable columned left panel + group-by; baseline-vs-actual + non-red critical path + resource swimlanes.

## Calendrier
- **[P0]** Tasks render as single-day dots on the END date — the work SPAN is thrown away (`start`/`plannedDays`/`end` all exist). Defining gap vs Google/Apple/Notion → render multi-day bars + deadline cap.
- **[P1]** Phase encoded only as 3px left border on neutral chip (7-hue low-contrast ramp indistinguishable); chip leads with project not task; status 5px dot invisible. Week view = tall month columns (no time axis, adds nothing). Agenda not grouped/anchored. Drag has no ghost; weekend-snap highlight lies; confirm modal ignores CPM impact.
- **[P1]** `minWidth:640` side-scrolls on mobile (should default Agenda). No mini-month nav, no real filtering (uses allDerived), no keyboard reschedule, not an ARIA grid.
- **TOP:** multi-day spans; chip visual language rebuild; first-class week/agenda + mobile agenda; drag ghost+undo+CPM-aware confirm; mini-month nav + faceted filter + a11y grid.

## Kanban
- **[P1]** Grouping hardcoded to phase (status/responsable/discipline keys all exist) — add "Grouper par". Backward/skip phase drag silent (uses raw setPhase not advancePhase).
- **[P1]** **No add-card affordance anywhere** (openAdd exists, unwired; can't create into a phase). Card omits deadline/slip/budget/team (all derived). No drag placeholder/ghost; **no edge-autoscroll** → can't drag ESQ→RÉC on a laptop (board wider than viewport). Cards not keyboard-operable.
- **[P1]** WIP is global const 6 (not per-phase, not editable), binary amber (no red tier), color-only badge.
- **TOP:** group-by engine; real DnD (placeholder+ghost+autoscroll); card info overhaul; per-column WIP tiers + quick-add + column menu; a11y + persistence + urgency ordering.

## Équipe
- **[P0]** Workload model: capacity = every working day (no FTE/part-time/leave/billable); charge **double-counts overlapping tasks** → the "290%" artifact (cap is a symptom workaround). Fix with fractional daily allocation + configurable capacity.
- **[P0]** `costPerDay` (€640-1150, drives budget) is **invisible & uneditable** — team view is the natural home for cost; biggest missed surface. No sort/filter of members (unusable past ~6 people). No top-level empty state.
- **[P1]** No heatmap legend (4 simultaneous encodings, none explained); week labels ambiguous (bare day-of-month); no cross-project split (mono-color bar); WD reuses ambiguous L/M/M/J/V/S/D.
- **TOP:** fix capacity+allocation model; sort/filter/group toolbar; cost/billing lens (modal field + per-member € + charge⇄coût toggle); stacked-by-project heatmap + legend; over/under-staffing signals + drag-to-reassign + empty state.

## Drawer / Detail / Login / Chrome — [report pending; to be appended]


## Drawer / Detail / Login / Chrome
- **[P0]** Drawer (peek) and `/projets/[id]` page render the SAME 3 components; page is barely wider (660 vs 500) and shows LESS at once (tabs vs stacked) → "Ouvrir la page" is a broken promise. Make drawer = fast triage peek (URL `?projet=ID`), page = real 2-column workspace (main: tasks/gantt/activity; rail: properties/EVM/team/attachments).
- **[P0]** Subtask delete = immediate, no confirm/undo (toast undo primitive exists & unused). Route through undo toast.
- **[P1]** Critical-path/float computed but ABSENT from task rows (the place you edit). Task rows are dense 3-tier always-expanded grids (wall of selects). EVM burn bar has no legend/tooltip; over-budget is color-only; committed>100% clamps silently.
- **[P1]** Inline edits (name/client/honoraires/tasks) look 100% static — zero hover affordance → undiscoverable. Comments append-only, plain-text, single-line, fake author, untrustworthy timestamps → should be an activity feed (+@mentions, the store already mutates everything).
- **[P1]** Sidebar identity hardcoded "P. Dubois" (not auth user). Login generic centered card + raw English Supabase errors + no resend/edit-email + silent misconfig→demo fallback.
- **[P1]** Toasts bottom-CENTER over content (should be bottom-right, capped, pause-on-hover, reduced-motion). Command palette: no recents, substring-not-fuzzy match, everything dumped in "Actions".
- **TOP:** differentiate drawer/page; task list as planning surface (CP/float badges, collapse, undo delete); EVM legibility (legend/tooltip/overflow/expected-marker); activity feed + rich comments; chrome polish (real identity, breadcrumbs, bottom-right toasts, split login + FR errors).

## 10. ACCESSIBILITY (full — WCAG 2.2 AA)
- **[P0]** Every drag interaction (kanban cards, calendar chips, gantt bars/pan) is pointer-only, often not even focusable, with NO keyboard path and NO `aria-live` grab/drop announcement (2.1.1/2.5.7/4.1.3).
- **[P0]** Data views lack semantics: projects "table" is CSS-grid divs (no table/`th scope`/`aria-sort` on real columnheaders); calendar/kanban have no grid/list roles (1.3.1).
- **[P0]** Data-viz (Gauge/Sparkline/heatmap/bars) have no `role=img`+aria-label or data-table fallback; count-up exposes wrong transient value to AT (1.1.1/4.1.2). Color-only encoding of phase/status/load/critical-path/WIP (1.4.1).
- **[P1]** No `<main>`, no skip link, no real heading hierarchy (dashboard/team have no h1; titles are styled divs) (1.3.1/2.4.1). Form fields in modals/inputs unlabeled (no htmlFor/id), no required/error/`aria-invalid` (1.3.1/3.3.x). Info-bearing hover-only `title` everywhere; icons lack `aria-hidden`; avatars title-only (1.1.1/1.4.13).
- **[P1]** Touch targets sub-24px: calendar chips/"+N", gantt handles(14px)/bars(12-18px), dashboard segments(8px)/legend, team task rows (2.5.8).
- **[P2]** Green focus ring may fail 3:1 on green-tinted active backgrounds; framer Card hover + programmatic smooth-scroll bypass reduced-motion; skeleton/toaster live-region issues.
- **[OK]** Global CSS reduced-motion, count-up/gauge/exit JS guards, toaster role/aria-live, Segmented/Checkbox ARIA, mobile-nav aria-current+48px.
- **TOP:** (1) keyboard+announced drag pattern. (2) real table/grid/list semantics. (3) data-viz role=img/data-table + non-color cues. (4) main/skip-link/headings. (5) labels+focus-contrast+tooltips+touch-targets.

---

# ═══════════ EXECUTION ROADMAP (proposed) ═══════════

Cross-cutting verdict: the **system layer is Linear/Vercel-grade in discipline; the gaps are enforcement + completeness + the during-use experience.** Organized into workstreams by dependency order. Each can be a parallel disjoint-ownership fleet.

## WAVE 0 — Foundations (do first; everything builds on these)
- **F1 Tokens hardened & enforced:** redefine `SP` (true 4px incl. 6/10); collapse to 4 named weights + weight-modulated heading ramp; size-aware `num()`; unify warm-warning ramp (1 amber+1 terracotta); retune avatar palette for AA; fix focus ring (≥3:1); neutral hover (green=selection); 2-layer monotonic `SH` + `SH.overlay`; add `SPRING`, `Z` (z-index), `measure` tokens. Sweep raw literals; lint-ban numeric fontSize/hex.
- **F2 Styling-architecture decision:** inline-styles → **vanilla-extract** (keeps tokens.ts as typed source, zero-runtime, real :hover/media) — OR commit to the hybrid and just hoist static styles. *Needs your call (big but high-leverage).* 
- **F3 Store re-architecture:** split context (stable-actions + state) / selectors so the app stops re-rendering wholesale on every keystroke; memoize derivation (per-project by ref; dashboard analytics).
- **F4 Motion-library decision:** the Motion audit wants framer everywhere (FLIP/AnimatePresence/shared-element); the Perf audit wants framer DROPPED (30-50kb for 1 hover). *Needs your call:* commit to framer as the animation engine (richer) or go CSS/rAF + minimal lib (lighter).

## WAVE 1 — Cross-cutting polish (mechanical, high consistency payoff)
- Typography sweep (rungs/weights/measure/Wordmark/DueLabel/Clamp). Spacing sweep (gutter+left-rail align, card densities, bento harmonize, Dot/Avatar/PercentReadout atoms, SectionHeader everywhere). Depth (visible shadows, overlay tier, blurred scrims, recessed insets, sticky-header shadows). Microcopy (enforce pct/formatDays/NNBSP/apostrophes, glossary, rename "Honoraires engagés", FR Supabase errors). Brand (vector-lock icon to Geist, `<Wordmark>`, fill `public/` OG/manifest/maskable, fix themeColor, dot motif + branded loader, logomark decision).

## WAVE 2 — Components & a11y backbone
- New primitives: Tooltip (purge title=), Tabs (roving), ToggleButton, Switch, Textarea, Badge, Kbd, Dot, Spinner, Field; Button loading + Input error/adornments; icon overhaul (replace text glyphs, Lucide for utility). A11y: `<main>`+skip-link+headings, real table/grid/list semantics, role=img/data-table on viz, non-color cues, labels/required/errors, keyboard+announced drag, focus-contrast, 24px+ targets.

## WAVE 3 — Motion system
- Route/list FLIP + AnimatePresence (table/kanban/gantt/team/calendar/toasts/palette/comments/subtasks); shared-element layoutId (card→drawer, row→detail, calendar chip flight); sliding-pill Segmented; tactile checkbox/stepper/"just-created" pulse; migrate Modal/Drawer/Toaster off setTimeout; toasts → bottom-right + reflow + pause-on-hover.

## WAVE 4 — Per-surface depth (product capability — biggest "feel" upgrades)
- **Dashboard:** money/decision KPIs (surface unused EVM `buildBudget`), fix broken `.dash-*` skeleton, trustworthy banded gauge (exclude terminé), workload+activity tiles, de-dupe lower half, empty-portfolio state.
- **Projets table:** inline-edit cells, group-by + subtotals, column customization + missing columns, virtualization + sticky header/first-col, real faceted filters, saved-views strip.
- **Gantt:** multi-zoom 2-tier axis + weekend shading, dependency-aware editor (routing/create/delete/ripple), milestones/jalons, resizable columned panel, non-red critical path + baseline.
- **Calendar:** multi-day spans (not just deadline dots), chip rebuild, first-class week/agenda + mobile agenda, drag ghost+undo+CPM-aware, mini-month nav + filters.
- **Kanban:** group-by engine, real DnD (placeholder/ghost/autoscroll), card info overhaul, per-column WIP tiers + quick-add, ordering.
- **Équipe:** fix capacity+allocation model (kills 290% artifact), sort/filter/group, cost/billing lens (costPerDay), stacked-by-project heatmap + legend, over/under-staffing + drag-to-reassign.
- **Drawer/Detail:** differentiate peek vs workspace page, task list as planning surface, EVM legibility, activity feed + rich comments.

## WAVE 5 — IA / flows / responsive (structural completeness)
- Promote lenses to persistent nav; account layer (avatar menu + /parametres + real auth identity); first-run/onboarding + empty states; breadcrumbs + not-found + context-aware header; unify search/filter/reschedule across lenses; server-side shareable saved views.
- Responsive: viewport-fit=cover; mobile card-list (table) + slim/fallback gantt; bottom-sheet drawer + auto-fit grids; fluid rem/clamp type; 100dvh + chrome-aware heights; widen maxWidth for data views.

