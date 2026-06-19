"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { CheckIcon, CloseIcon } from "./icons";
import { subscribeToasts, type ToastItem } from "@/lib/toast";
import { C, R, SH, SPRING, TX, Z } from "@/lib/tokens";

const MAX_VISIBLE = 3;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const reduced = usePrefersReducedMotion();

  // One timer per toast, owned here so we can pause/resume on hover/focus.
  const timers = useRef<Map<number, { remaining: number; startedAt: number; handle: number | null }>>(new Map());
  const paused = useRef(false);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t?.handle) window.clearTimeout(t.handle);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // Toasts carrying an undo (or any) action are NOT auto-dismissed — the user
  // must decide. Everything else dismisses after its duration.
  const armable = (t: ToastItem) => t.duration > 0 && !t.action;

  const arm = useCallback((id: number, ms: number) => {
    const handle = window.setTimeout(() => dismiss(id), ms);
    timers.current.set(id, { remaining: ms, startedAt: Date.now(), handle });
  }, [dismiss]);

  const pauseAll = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    for (const [, t] of timers.current) {
      if (t.handle) {
        window.clearTimeout(t.handle);
        t.remaining = Math.max(0, t.remaining - (Date.now() - t.startedAt));
        t.handle = null;
      }
    }
  }, []);

  const resumeAll = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    for (const [id, t] of timers.current) {
      if (!t.handle) {
        t.startedAt = Date.now();
        t.handle = window.setTimeout(() => dismiss(id), t.remaining);
      }
    }
  }, [dismiss]);

  useEffect(() => {
    return subscribeToasts((t) => {
      setItems((prev) => [...prev, t]);
      if (armable(t) && !paused.current) arm(t.id, t.duration);
    });
  }, [arm]);

  useEffect(() => () => { for (const [, t] of timers.current) if (t.handle) window.clearTimeout(t.handle); }, []);

  if (items.length === 0) return null;

  // Newest first, bottom-right; cap the visible stack and summarise the rest.
  const ordered = [...items].reverse();
  const visible = ordered.slice(0, MAX_VISIBLE);
  const overflow = ordered.length - visible.length;

  const enter = { opacity: 1, x: 0, y: 0, scale: 1 };
  const from = reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 };
  const exit = reduced ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 };

  return (
    <div
      onMouseEnter={pauseAll}
      onMouseLeave={resumeAll}
      onFocusCapture={pauseAll}
      onBlurCapture={resumeAll}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: Z.toast,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence initial={!reduced}>
        {visible.map((t) => (
          <motion.div
            key={t.id}
            layout={reduced ? false : "position"}
            role={t.variant === "error" ? "alert" : "status"}
            aria-live={t.variant === "error" ? "assertive" : "polite"}
            initial={from}
            animate={enter}
            exit={exit}
            transition={reduced ? { duration: 0.12 } : SPRING.snappy}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: C.ink900,
              color: "#fff",
              borderRadius: R.md,
              boxShadow: SH.overlay,
              borderLeft: `3px solid ${t.variant === "error" ? C.danger : t.variant === "success" ? C.inversePrimary : C.ink500}`,
              padding: "10px 12px 10px 13px",
              minWidth: 260,
              maxWidth: 440,
            }}
          >
            {t.variant === "success" ? <span style={{ color: C.inversePrimary, display: "flex" }}><CheckIcon size={15} /></span> : null}
            <span style={{ ...TX.caption, color: "#fff", flex: 1 }}>{t.message}</span>
            {t.action ? (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                style={{ background: "transparent", border: "none", color: C.inversePrimary, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "2px 6px", borderRadius: R.xs, whiteSpace: "nowrap" }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button onClick={() => dismiss(t.id)} aria-label="Fermer" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.55)", cursor: "pointer", display: "flex", padding: 2 }}>
              <CloseIcon size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      {overflow > 0 ? (
        <motion.div
          layout={reduced ? false : "position"}
          initial={from}
          animate={enter}
          exit={exit}
          transition={reduced ? { duration: 0.12 } : SPRING.snappy}
          aria-hidden
          style={{ ...TX.nano, color: C.ink500, pointerEvents: "none", paddingRight: 4 }}
        >
          +{overflow} de plus
        </motion.div>
      ) : null}
    </div>
  );
}
