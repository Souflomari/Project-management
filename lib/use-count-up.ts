"use client";

import { useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/components/ui";

interface CountUpOptions {
  /** Animation length in ms (default 750). */
  duration?: number;
  /** Decimal places to keep on the in-between values (default 0). */
  decimals?: number;
}

/**
 * Ramp a number from 0 to `target` once, on mount, with an ease-out curve.
 *
 * The value returned is the animated figure; callers drive BOTH the readout and
 * any companion meter (gauge arc, bar) from it so the number and its visual
 * never disagree mid-flight. Honours `prefers-reduced-motion` by returning the
 * final value immediately. Re-runs if `target` changes (e.g. live data).
 */
export function useCountUp(target: number, { duration = 750, decimals = 0 }: CountUpOptions = {}): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || duration <= 0) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const factor = 10 ** decimals;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast then settling, reads as intentional, not jittery
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + delta * eased;
      setValue(Math.round(next * factor) / factor);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals]);

  return value;
}
