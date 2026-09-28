"use client";

// Anchored popover / menu primitive. Replaces the five hand-rolled copies (table
// cells, "Affichage", calendar pickers, "+N" day list, Gantt columns): it renders
// in a portal (never clipped by an `overflow:hidden` grid or a scroll container),
// positions itself against its anchor (flips above when there is no room below,
// clamps to the viewport), closes on outside press / Escape (top-most overlay
// only) / Tab-out, and returns focus to the trigger.

import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { focusableIn, useOverlay } from "./overlay-stack";
import { useIsClient } from "@/lib/use-media-query";
import { C, R, SH, SPRING, Z } from "@/lib/tokens";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The trigger. Presses on it are NOT "outside" (the trigger toggles). */
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: "start" | "end";
  role?: "menu" | "dialog" | "listbox";
  label?: string;
  width?: number;
  minWidth?: number;
  maxHeight?: number;
  padding?: number;
  style?: CSSProperties;
  /** Focus the first item on open (menus / lists). Default true. */
  autoFocus?: boolean;
}

export function Popover(props: PopoverProps) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>{props.open ? <PopoverPanel key="panel" {...props} /> : null}</AnimatePresence>,
    document.body,
  );
}

/** The element focus returns to. The anchor may be a non-focusable wrapper
 *  (table cells anchor on a <span> around the trigger button) — use the
 *  focusable control inside it then. */
function triggerOf(anchor: HTMLElement | null): HTMLElement | null {
  if (!anchor || anchor.tabIndex >= 0) return anchor;
  return focusableIn(anchor)[0] ?? anchor;
}

const GAP = 6;
const MARGIN = 8;

function PopoverPanel({
  onClose, anchorRef, children, align = "start", role = "menu", label,
  width, minWidth = 180, maxHeight = 320, padding = 6, style, autoFocus = true,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useIsPresent();

  const place = useCallback(() => {
    const a = anchorRef.current;
    const el = ref.current;
    if (!a || !el) return;
    const r = a.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom - GAP - MARGIN;
    const above = r.top < h + GAP + MARGIN || below >= h ? false : r.top > below;
    const top = above ? r.top - GAP - h : r.bottom + GAP;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
    // Positioned imperatively (no state round-trip → no extra render per scroll).
    el.style.top = `${Math.max(MARGIN, top)}px`;
    el.style.left = `${left}px`;
    el.style.visibility = "visible";
    el.style.transformOrigin = above ? "bottom left" : "top left";
  }, [anchorRef, align]);

  // Placement MUST run before `useOverlay`'s initial focus: layout effects fire
  // in declaration order, and the panel is `visibility:hidden` until placed —
  // a hidden element silently refuses focus(), leaving focus on the trigger
  // (no arrow keys, no Tab-out close).
  useLayoutEffect(() => { place(); }, [place]);

  useOverlay(ref, {
    active: present,
    modal: false,
    onEscape: onClose,
    initialFocus: autoFocus ? "first" : "none",
    returnFocus: () => triggerOf(anchorRef.current),
  });

  useEffect(() => {
    const onPress = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onMove = () => place();
    document.addEventListener("pointerdown", onPress, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const ro = new ResizeObserver(onMove);
    if (ref.current) ro.observe(ref.current);
    return () => {
      document.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      ro.disconnect();
    };
  }, [anchorRef, onClose, place]);

  // Tab leaving the panel closes it and continues the page's tab order from the
  // trigger (the panel is portalled to the end of <body>, so the browser's own
  // next stop would be the address bar). A menu is a single tab stop: any Tab
  // leaves it. Shift+Tab lands on the trigger itself.
  const tabOut = (e: React.KeyboardEvent, node: HTMLElement) => {
    const items = focusableIn(node);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const leaving = role === "menu" || !items.length || (e.shiftKey ? i <= 0 : i === items.length - 1);
    if (!leaving) return;
    const trigger = triggerOf(anchorRef.current);
    if (!trigger) return;
    e.preventDefault();
    let dest: HTMLElement | null = trigger;
    if (!e.shiftKey) {
      const order = focusableIn(document.body).filter((el) => !node.contains(el));
      const t = order.indexOf(trigger);
      dest = t >= 0 ? order[t + 1] ?? trigger : trigger;
    }
    dest.focus();
    onClose();
  };

  // Arrow-key roving between items (Home/End jump); Tab-out handled above.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const node = ref.current;
    if (node && e.key === "Tab" && !e.defaultPrevented) { tabOut(e, node); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    if (!node) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox") return;
    const items = focusableIn(node);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1
      : e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };
  const onBlur = (e: React.FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (!to || ref.current?.contains(to) || anchorRef.current?.contains(to)) return;
    onClose();
  };

  return (
    <motion.div
      ref={ref}
      role={role}
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={SPRING.snappy}
      style={{
        position: "fixed",
        top: -9999,
        left: -9999,
        visibility: "hidden",
        zIndex: Z.popover,
        width,
        minWidth,
        maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
        maxHeight,
        overflowY: "auto",
        background: C.surface,
        border: `1px solid ${C.lineStrong}`,
        borderRadius: R.md,
        boxShadow: SH.overlay,
        padding,
        outline: "none",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}
