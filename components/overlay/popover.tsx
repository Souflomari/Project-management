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

const GAP = 6;
const MARGIN = 8;

function PopoverPanel({
  onClose, anchorRef, children, align = "start", role = "menu", label,
  width, minWidth = 180, maxHeight = 320, padding = 6, style, autoFocus = true,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useIsPresent();

  useOverlay(ref, {
    active: present,
    modal: false,
    onEscape: onClose,
    initialFocus: autoFocus ? "first" : "none",
    returnFocus: () => anchorRef.current,
  });

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

  useLayoutEffect(() => { place(); }, [place]);

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

  // Arrow-key roving between items; Tab leaving the panel closes it.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const node = ref.current;
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
