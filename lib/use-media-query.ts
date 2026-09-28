"use client";

import { useSyncExternalStore } from "react";

// Media-query + client-detection hooks built on useSyncExternalStore: on a
// client-side navigation they return the real value on the very first render
// (no desktop→phone flash); during hydration React reconciles the server
// snapshot to the client value before the browser paints the hydrated tree.
// Prefer CSS for pure layout switches — use these only when the *component
// tree* genuinely differs (e.g. the calendar's phone agenda).

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

const noop = () => () => {};

/** False on the server and during hydration, true afterwards — for portals and
 *  other browser-only rendering, without a setState-in-effect round trip. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
