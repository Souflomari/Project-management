// Tiny dependency-free toast bus. Components and the store call `toast(...)`
// without needing a hook; the <Toaster /> subscribes and renders.

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  message: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

export interface ToastItem extends ToastInput {
  id: number;
  variant: ToastVariant;
  duration: number;
}

type Listener = (t: ToastItem) => void;

let listeners: Listener[] = [];
let seq = 0;

export function toast(input: ToastInput): void {
  const item: ToastItem = { id: ++seq, variant: "info", duration: 4000, ...input };
  for (const l of listeners) l(item);
}

export function subscribeToasts(l: Listener): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}
