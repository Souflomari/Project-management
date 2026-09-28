"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

import { CheckIcon, CloseIcon } from "./icons";
import { subscribeToasts, type ToastItem } from "@/lib/toast";
import { useIsClient } from "@/lib/use-media-query";
import { C, R, SH, SPRING, TX, Z } from "@/lib/tokens";

const MAX_VISIBLE = 3;

interface Timer {
  remaining: number;
  startedAt: number;
  handle: number | null;
}

export function Toaster() {
  const isClient = useIsClient();
  const [items, setItems] = useState<ToastItem[]>([]);
  // Text for the two PERSISTENT live regions (mounted with the shell, empty at
  // rest) — a region that mounts together with its message is often not
  // announced. Errors go to the assertive one.
  const [politeMsg, setPoliteMsg] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  // One timer per toast, owned here so we can pause/resume on hover/focus.
  const timers = useRef<Map<number, Timer>>(new Map());
  const paused = useRef(false);

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t?.handle) window.clearTimeout(t.handle);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const start = useCallback((id: number, ms: number) => {
    const handle = window.setTimeout(() => dismiss(id), ms);
    timers.current.set(id, { remaining: ms, startedAt: Date.now(), handle });
  }, [dismiss]);

  const pauseAll = useCallback(() => {
    if (paused.current) return;
    paused.current = true;
    const now = Date.now();
    for (const [id, t] of timers.current) {
      if (t.handle == null) continue;
      window.clearTimeout(t.handle);
      timers.current.set(id, { remaining: Math.max(0, t.remaining - (now - t.startedAt)), startedAt: now, handle: null });
    }
  }, []);

  const resumeAll = useCallback(() => {
    if (!paused.current) return;
    paused.current = false;
    for (const [id, t] of timers.current) if (t.handle == null) start(id, t.remaining);
  }, [start]);

  useEffect(() => {
    return subscribeToasts((t) => {
      setItems((prev) => [...prev, t]);
      // Alternate a trailing NBSP so an identical repeated message still counts
      // as a change and is re-announced.
      const next = (prev: string) => (prev === t.message ? `${t.message}\u00a0` : t.message);
      if (t.variant === "error") setAlertMsg(next); else setPoliteMsg(next);
      // Toasts carrying an action (undo / retry) are NOT auto-dismissed — the
      // user must decide. A toast arriving while the stack is hovered/focused is
      // registered paused, so resumeAll() arms it when the pointer leaves.
      if (t.duration <= 0 || t.action) return;
      if (paused.current) timers.current.set(t.id, { remaining: t.duration, startedAt: Date.now(), handle: null });
      else start(t.id, t.duration);
    });
  }, [start]);

  useEffect(() => {
    const map = timers.current;
    return () => { for (const [, t] of map) if (t.handle) window.clearTimeout(t.handle); };
  }, []);

  if (!isClient) return null;

  // Newest first, bottom-right; cap the visible stack and summarise the rest.
  const ordered = [...items].reverse();
  const visible = ordered.slice(0, MAX_VISIBLE);
  const overflow = ordered.length - visible.length;

  const enter = { opacity: 1, x: 0, y: 0, scale: 1 };
  const from = { opacity: 0, y: 12, scale: 0.96 };
  const exit = { opacity: 0, x: 24, scale: 0.96 };

  return createPortal(
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{politeMsg}</div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{alertMsg}</div>
      <div
        data-overlay-exempt=""
        onMouseEnter={pauseAll}
        onMouseLeave={resumeAll}
        onFocusCapture={pauseAll}
        onBlurCapture={resumeAll}
        className="toast-stack"
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
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        <AnimatePresence>
          {visible.map((t) => (
            <motion.div
              key={t.id}
              layout="position"
              initial={from}
              animate={enter}
              exit={exit}
              transition={SPRING.snappy}
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
                minWidth: "min(260px, 100%)",
                maxWidth: 440,
              }}
            >
              {t.variant === "success" ? <span aria-hidden style={{ color: C.inversePrimary, display: "flex" }}><CheckIcon size={15} /></span> : null}
              <span style={{ ...TX.caption, color: "#fff", flex: 1 }}>{t.message}</span>
              {t.action ? (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                  className="btn"
                  style={{ background: "transparent", border: "none", color: C.inversePrimary, fontWeight: 600, fontSize: 14, cursor: "pointer", padding: "2px 6px", borderRadius: R.xs, whiteSpace: "nowrap" }}
                >
                  {t.action.label}
                </button>
              ) : null}
              <button onClick={() => dismiss(t.id)} aria-label="Fermer la notification" className="btn" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.7)", cursor: "pointer", display: "flex", padding: 2, borderRadius: R.xs }}>
                <CloseIcon size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {overflow > 0 ? (
          <div aria-hidden style={{ ...TX.nano, color: C.ink500, pointerEvents: "none", paddingRight: 4 }}>
            +{overflow} de plus
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}
