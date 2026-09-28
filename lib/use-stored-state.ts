"use client";

import { useCallback, useSyncExternalStore } from "react";

// A localStorage-backed string, read through useSyncExternalStore: the server
// and the hydrating client both see `null` (no mismatch), the stored value is
// adopted right after hydration without a setState-in-effect round trip, and
// every hook bound to the same key (and other tabs) stays in sync.

const listeners = new Map<string, Set<() => void>>();
// In-memory mirror so the UI still works when storage is unavailable.
const memory = new Map<string, string>();

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null; // storage disabled (privacy mode)
  }
}

export function useStoredString(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(cb);
      const onStorage = (e: StorageEvent) => { if (e.key === key) cb(); };
      window.addEventListener("storage", onStorage);
      return () => { set!.delete(cb); window.removeEventListener("storage", onStorage); };
    },
    () => read(key),
    () => null,
  );
  const write = useCallback((next: string) => {
    memory.set(key, next);
    try { window.localStorage.setItem(key, next); } catch { /* best-effort */ }
    notify(key);
  }, [key]);
  return [value, write];
}
