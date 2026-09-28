"use client";

// Shared pointer drag-and-drop for the Kanban board and the calendar grids.
//
//   • Mouse / pen: drag starts after a small movement threshold; a click that
//     never moved is a "tap" (open the item).
//   • Touch: the page keeps scrolling normally (`touch-action` stays pan-friendly)
//     — a drag only starts after a LONG PRESS without movement; from then on the
//     touch is held (scroll blocked) until release. A quick tap still opens.
//   • A drop outside any valid target CANCELS (never falls back to the last
//     hovered target). pointercancel / lostpointercapture also cancel cleanly.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface PointerDragConfig<T> {
  /** Drop-target key under a viewport point, or null when there is none. */
  targetAt: (x: number, y: number) => string | null;
  onDrop: (item: T, target: string) => void;
  /** A press that never became a drag. */
  onTap?: (item: T) => void;
  /** Items that can't move still get taps. Default: all can drag. */
  canDrag?: (item: T) => boolean;
  /** Mouse/pen movement (px) before a press becomes a drag. Default 5. */
  threshold?: number;
  /** Touch press duration (ms) before a drag starts. Default 350. */
  longPressMs?: number;
}

export interface DragState<T> {
  item: T;
  /** Viewport pointer position. */
  x: number;
  y: number;
  /** Pointer offset inside the pressed element, and its width (for ghosts). */
  offX: number;
  offY: number;
  width: number;
  /** Target currently under the pointer. */
  over: string | null;
}

interface Session<T> {
  item: T;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  width: number;
  active: boolean;
  moved: boolean;
  timer: number | undefined;
}

const blockScroll = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };

export function usePointerDrag<T>(config: PointerDragConfig<T>) {
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const cfg = useRef(config);
  useLayoutEffect(() => { cfg.current = config; });
  const session = useRef<Session<T> | null>(null);
  /** Latest pointer position while dragging — for rAF loops (auto-scroll). */
  const point = useRef({ x: 0, y: 0 });

  const release = useCallback(() => {
    const s = session.current;
    if (s?.timer) window.clearTimeout(s.timer);
    window.removeEventListener("touchmove", blockScroll);
    session.current = null;
    setDrag(null);
  }, []);

  useEffect(() => release, [release]);

  const activate = useCallback((s: Session<T>, x: number, y: number) => {
    s.active = true;
    s.moved = true;
    if (s.touch) {
      window.addEventListener("touchmove", blockScroll, { passive: false });
      navigator.vibrate?.(10);
    }
    point.current = { x, y };
    setDrag({ item: s.item, x, y, offX: s.offX, offY: s.offY, width: s.width, over: cfg.current.targetAt(x, y) });
  }, []);

  const bind = useCallback((item: T) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || session.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const touch = e.pointerType === "touch";
      const s: Session<T> = {
        item, pointerId: e.pointerId, touch,
        startX: e.clientX, startY: e.clientY,
        offX: e.clientX - rect.left, offY: e.clientY - rect.top, width: rect.width,
        active: false, moved: false, timer: undefined,
      };
      session.current = s;
      const draggable = cfg.current.canDrag?.(item) ?? true;
      if (!touch) {
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (draggable) {
        const x = e.clientX;
        const y = e.clientY;
        s.timer = window.setTimeout(() => { if (session.current === s && !s.moved) activate(s, x, y); }, cfg.current.longPressMs ?? 350);
      }
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = session.current;
      if (!s || s.pointerId !== e.pointerId) return;
      if (!s.active) {
        const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
        if (dist < (cfg.current.threshold ?? 5)) return;
        s.moved = true; // no longer a tap
        if (s.touch) { window.clearTimeout(s.timer); return; } // it's a scroll gesture
        if (!(cfg.current.canDrag?.(s.item) ?? true)) return;
        activate(s, e.clientX, e.clientY);
        return;
      }
      point.current = { x: e.clientX, y: e.clientY };
      const over = cfg.current.targetAt(e.clientX, e.clientY);
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over } : d));
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const s = session.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const { active, moved } = s;
      release();
      if (active) {
        const target = cfg.current.targetAt(e.clientX, e.clientY);
        if (target != null) cfg.current.onDrop(s.item, target); // outside → cancelled
      } else if (!moved) {
        cfg.current.onTap?.(s.item);
      }
    },
    onPointerCancel: () => { if (session.current) release(); },
    onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => {
      // Capture lost mid-drag (element removed, window blur…) → cancel.
      if (session.current?.pointerId === e.pointerId && session.current.active) release();
    },
    onContextMenu: (e: React.MouseEvent) => {
      // A long press on touch opens the context menu / callout — not while dragging.
      if (session.current?.touch) e.preventDefault();
    },
  }), [activate, release]);

  return { drag, bind, point, cancel: release };
}
