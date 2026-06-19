# SOTA design brief — minimalism, ergonomics, premium craft

The reference standard the audit agents score against. Synthesised from design science +
the leading minimal/dense pro tools. Citations at the end.

## A. MINIMALISM (what "minimal" actually means)
1. **As little design as possible** (Rams). Every element must *justify its presence*; remove
   anything decorative. Content/feature first, chrome last.
2. **Maximise the data-ink / content-element ratio** (Tufte). A large share of pixels must carry
   information; strip non-informative ink (heavy borders, fills, gradients, shadows, redundant labels).
3. **Limited palette, monochrome + selective accent**, flat textures, **extensive negative space**.
4. **But minimalism has a failure mode** (NN/G): over-reduction → hidden affordances, low
   discoverability, "wastefully low information density," lost context. *Minimal must not cost
   usability.* Keep affordances visible; don't hide primary actions; don't strip needed labels.

## B. ERGONOMICS / USABILITY LAWS (apply, then verify)
- **Von Restorff (isolation):** the one thing that matters stands out. *If everything is coloured/
  bold/boxed, nothing stands out.* ← the core of the "too many colours" problem.
- **Hick's Law:** more choices = slower decisions → reduce & group options, progressive disclosure.
- **Miller's Law (7±2):** chunk information; group related fields; don't show everything at once.
- **Fitts's Law:** primary targets large & close; ≥24px (ideally ~40px) hit areas; don't tuck key actions away.
- **Jakob's Law:** lean on convention; don't reinvent standard controls.
- **Gestalt (proximity / common region / similarity):** group related items with **whitespace**, not
  with extra borders/boxes; alignment creates order for free.
- **Tesler / progressive disclosure:** hide secondary detail until needed; one focal point per view.
- **F-pattern scanning:** most-important top-left; weight decreases down-right.
- **Cognitive load:** fewer simultaneous elements = lower load = faster, calmer use.

## C. PREMIUM CRAFT (Stripe / Linear / Vercel consensus)
- **Palette discipline:** neutrals + **ONE** measured accent. Lock colour→meaning (danger=red,
  success/brand=green); **never** add decorative accent colour to cards/sections. Restraint reads as confidence.
- **Typography:** single family; **4–6 sizes** from one modular scale; hierarchy by **size/weight**, not
  colour; no display fonts for flair.
- **Spacing:** "**interaction density over visual density**." Whitespace is *air*, not emptiness; sparse +
  complete interactive states feels calmer than a cramped dashboard.
- **Contrast / hairlines:** thin (0.5–1px) low-opacity separators, not default borders; avoid pure
  #000/#FFF; brand-temperature neutrals.
- **Decoration:** remove gradients, decorative shadows, ornament. Every visual decision serves
  hierarchy, meaning, or interaction clarity.
- **Microstates:** every interactive element needs default / hover / focus / active / disabled / loading;
  designed, high-contrast, keyboard-accessible focus rings. "Density is in the behaviour, not the pixels."
- **Motion:** consistent curves/durations (no browser defaults); subtle, purposeful.

## D. DATA-DENSE DASHBOARD SPECIFICS
- Visual hierarchy via size/weight; **accent sparingly + high contrast**; non-colour cues (icon/label/
  position) for series so it survives colour-blindness; breathing room around analysis; tables
  filterable/sortable.

---

## E. SCORING FRAMEWORK (each agent scores its surface 1–5 per axis, lists specific gaps + fixes)
1. **Colour restraint** — is colour spent only on meaning (one accent + semantic alerts), or still
   decorative? Count distinct hues visible at once. Von Restorff: does the *one* important thing pop?
2. **Data-ink / clutter** — ratio of informative to decorative pixels; redundant borders/labels/badges;
   could whitespace replace a divider/box?
3. **Hierarchy** — one clear focal point per view/card/row? Size/weight (not colour) carrying it?
4. **Spacing & rhythm** — whitespace as air; consistent scale; cramped vs calm; alignment.
5. **Ergonomics** — Hick (choice count), Miller (chunking), Fitts (target sizes), progressive
   disclosure, click-cost of common tasks, scannability (F-pattern).
6. **Microstates & affordance** — hover/focus/active/disabled/loading complete; affordances visible
   (minimalism not hiding them); designed focus rings.
7. **Consistency** — same atom (dot/avatar/chip/label) rendered identically everywhere.

Target: **Linear/Stripe/Vercel-grade calm** — quiet by default, one accent, generous air, the
important thing obvious, nothing decorative, every control complete. Avoid the NN/G failure mode
(don't strip affordances/labels needed for the task).

## Sources
- NN/G — Roots of Minimalism in Web Design: https://www.nngroup.com/articles/roots-minimalism-web-design/
- Tufte data-ink ratio (overview): https://www.performancemagazine.org/data-ink-ratio-minimalism-data-visualization/
- Laws of UX (Yablonski) reference: https://www.uxdesigninstitute.com/blog/laws-of-ux/
- Stripe/Linear/Vercel premium UI: https://mantlr.com/blog/stripe-linear-vercel-premium-ui
- Four design principles behind Stripe/Linear/Vercel: https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel
- Dashboard design best practices (2025): https://www.context.dev/blog/dashboard-design-best-practices
