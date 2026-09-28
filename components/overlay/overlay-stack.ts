"use client";

// One overlay layer for the whole app. Every modal surface (Modal, project
// Drawer, CommandPalette) and every non-modal popover registers here, so:
//   • Escape closes ONLY the top-most overlay, and never when an inner control
//     already handled it (`e.defaultPrevented` — e.g. a mention list, an inline
//     edit, a native <select>).
//   • Tab is trapped inside the top-most MODAL overlay.
//   • The app shell (`[data-app-root]`) and lower modal layers become `inert`.
//   • Body scroll is locked while a modal is open and restored exactly after.
//   • Focus returns to the element that opened the overlay.
// Overlays render through a portal on <body>, outside `[data-app-root]`.

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

interface Entry {
  id: number;
  node: HTMLElement;
  modal: boolean;
  lockScroll: boolean;
  returnFocus: HTMLElement | null;
  onEscape: () => void;
}

const stack: Entry[] = [];
let seq = 0;
let listening = false;
let scrollSaved: { overflow: string; paddingRight: string } | null = null;

const FOCUSABLE =
  "a[href],button:not([disabled]),input:not([disabled]):not([type='hidden']),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1']),[contenteditable='true']";

/** Visible, enabled, tabbable descendants of `root`, in DOM order. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && (el.offsetParent !== null || el.getClientRects().length > 0),
  );
}

/** True while any overlay (modal or popover) is open — global single-key
 *  shortcuts stay quiet then. */
export function hasOpenOverlay(): boolean {
  return stack.length > 0;
}

/** The element that takes focus when the layer itself should (a dialog panel
 *  marked `data-overlay-focus`, else the layer root). */
function containerOf(node: HTMLElement): HTMLElement {
  return node.querySelector<HTMLElement>("[data-overlay-focus]") ?? node;
}

function topModalIndex(): number {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].modal) return i;
  return -1;
}

/** Is `el` inside the top modal layer or anything stacked above it (popovers
 *  opened from within the modal, tooltips…)? */
function withinActiveLayer(el: Node | null): boolean {
  const t = topModalIndex();
  if (t < 0 || !el) return true;
  for (let i = t; i < stack.length; i++) if (stack[i].node.contains(el)) return true;
  return el instanceof Element && !!el.closest("[data-overlay-exempt]");
}

function onKeyDown(e: KeyboardEvent) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    if (e.defaultPrevented || e.isComposing) return;
    e.preventDefault();
    top.onEscape();
    return;
  }
  if (e.key !== "Tab") return;
  const t = topModalIndex();
  if (t < 0 || t !== stack.length - 1) return; // a popover on top manages its own Tab
  const node = stack[t].node;
  const items = focusableIn(node);
  if (!items.length) { e.preventDefault(); containerOf(node).focus(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey && (active === first || !node.contains(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus(); }
}

function onFocusIn(e: FocusEvent) {
  if (withinActiveLayer(e.target as Node)) return;
  const t = topModalIndex();
  if (t < 0) return;
  const node = stack[t].node;
  (focusableIn(node)[0] ?? containerOf(node)).focus({ preventScroll: true });
}

function sync() {
  const t = topModalIndex();
  const root = document.querySelector<HTMLElement>("[data-app-root]");
  if (root) root.inert = t >= 0;
  stack.forEach((en, i) => { en.node.inert = en.modal && i < t; });

  const wantLock = stack.some((en) => en.modal && en.lockScroll);
  if (wantLock && !scrollSaved) {
    const body = document.body;
    scrollSaved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
  } else if (!wantLock && scrollSaved) {
    document.body.style.overflow = scrollSaved.overflow;
    document.body.style.paddingRight = scrollSaved.paddingRight;
    scrollSaved = null;
  }

  if (stack.length && !listening) {
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn, true);
    listening = true;
  } else if (!stack.length && listening) {
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("focusin", onFocusIn, true);
    listening = false;
  }
}

function push(en: Omit<Entry, "id">): number {
  const id = ++seq;
  stack.push({ ...en, id });
  sync();
  return id;
}

function remove(id: number) {
  const i = stack.findIndex((en) => en.id === id);
  if (i < 0) return;
  const [en] = stack.splice(i, 1);
  en.node.inert = false;
  sync();
  // Restore focus only when it would otherwise be lost (on <body>, or still
  // inside the closing layer) — never yank it from where the user moved it.
  // Deferred to a microtask: removal runs inside React's commit, and React
  // re-focuses the pre-commit element at the end of its mutation phase, which
  // would silently undo a synchronous focus() here.
  queueMicrotask(() => {
    const active = document.activeElement;
    const lost = !active || active === document.body || en.node.contains(active);
    const target = en.returnFocus;
    if (lost && target && target.isConnected && !target.closest("[inert]")) target.focus({ preventScroll: true });
  });
}

export interface OverlayOptions {
  /** Registered only while true — pass `false` during an exit animation so the
   *  layer releases focus/inert/scroll immediately. */
  active?: boolean;
  /** Modal: trap focus, inert the background, lock scroll. Default true. */
  modal?: boolean;
  lockScroll?: boolean;
  onEscape: () => void;
  /** Where focus lands on open when nothing inside is focused yet (an
   *  `autoFocus` control wins). "first" skips `[data-overlay-close]`. */
  initialFocus?: "container" | "first" | "none";
  /** Element to restore focus to. Defaults to whatever was focused when the
   *  overlay first rendered (the trigger). */
  returnFocus?: () => HTMLElement | null;
}

/** Register `ref` as an overlay layer. The latest `onEscape` is always used,
 *  so an inline callback never re-runs the effect (no focus jumps). */
export function useOverlay(ref: RefObject<HTMLElement | null>, opts: OverlayOptions) {
  const { active = true, modal = true, lockScroll = modal, initialFocus = "first" } = opts;
  // The trigger: read during the first render, before any child autoFocus runs.
  const [trigger] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  const latest = useRef(opts);
  useLayoutEffect(() => { latest.current = opts; });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const returnFocus = latest.current.returnFocus?.() ?? (trigger && trigger !== document.body ? trigger : null);
    const id = push({ node, modal, lockScroll, returnFocus, onEscape: () => latest.current.onEscape() });
    if (initialFocus !== "none" && !node.contains(document.activeElement)) {
      const auto = node.querySelector<HTMLElement>("[data-autofocus]");
      const first = initialFocus === "first" ? focusableIn(node).find((el) => !el.hasAttribute("data-overlay-close")) : undefined;
      (auto ?? first ?? containerOf(node)).focus({ preventScroll: true });
    }
    return () => remove(id);
  }, [ref, active, modal, lockScroll, initialFocus, trigger]);
}
