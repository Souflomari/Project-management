/**
 * Count-up animation removed per design audit: a portfolio dashboard should show
 * its FINAL figures immediately, not ramp every KPI from 0 over ~750ms — which
 * briefly renders wrong/zero values ("0", "0 €") and reads as a slow, unstable
 * load. The health gauge's own arc-fill (CSS, in the Gauge component) still
 * provides a tasteful sweep without misrepresenting a number.
 *
 * Kept as a pass-through so call sites and the (already reduced-motion-safe)
 * contract are unchanged: the value is correct on first paint.
 */
export function useCountUp(target: number, _options?: { duration?: number; decimals?: number }): number {
  return target;
}
