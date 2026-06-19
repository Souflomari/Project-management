"use client";

import { useEffect, useRef, useState } from "react";

/** Tween an integer from its previous value to `target` with easeOutCubic.
 *  Plays from 0 on first mount; honours prefers-reduced-motion (jumps instantly).
 *  Used for the dashboard KPI figures so the landing view has a moment of life. */
export function useCountUp(target: number, duration = 600): number {
  const [val, setVal] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (
      typeof window === "undefined" ||
      from === target ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(from + (target - from) * ease(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}
