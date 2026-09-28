/**
 * Count-up animation removed per design audit: a portfolio dashboard should show
 * its FINAL figures immediately, not ramp every KPI from 0 over ~750ms — which
 * briefly renders wrong/zero values ("0", "0 €") and reads as a slow, unstable
 * load. The health gauge's own arc-fill (CSS, in the Gauge component) still
 * provides a tasteful sweep without misrepresenting a number.
 *
 * Kept as a pure pass-through (no state, no effect, no clock) so call sites are
 * unchanged and the server-rendered value is exactly the hydrated one — nothing
 * here can cause a hydration mismatch. (The unused animation options were
 * dropped; no call site passed them.)
 */
export function useCountUp(target: number): number {
  return target;
}
