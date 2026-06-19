"use client";

import { useEffect, useState } from "react";

import { CheckIcon, CloseIcon } from "./icons";
import { subscribeToasts, type ToastItem } from "@/lib/toast";
import { C, R, SH, TX } from "@/lib/tokens";

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts((t) => {
      setItems((prev) => [...prev, t]);
      if (t.duration > 0) {
        window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.duration);
      }
    });
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  if (items.length === 0) return null;

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 20, zIndex: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
      {items.map((t) => {
        return (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: C.ink900,
              color: "#fff",
              borderRadius: R.md,
              boxShadow: SH.lg,
              borderLeft: `3px solid ${t.variant === "error" ? C.danger : t.variant === "success" ? C.brandDot : C.ink500}`,
              padding: "10px 12px 10px 13px",
              minWidth: 260,
              maxWidth: 440,
              animation: "toastIn .22s cubic-bezier(.2,.7,.2,1)",
            }}
          >
            {t.variant === "success" ? <span style={{ color: C.brandDot, display: "flex" }}><CheckIcon size={15} /></span> : null}
            <span style={{ ...TX.caption, color: "#fff", flex: 1 }}>{t.message}</span>
            {t.action ? (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                style={{ background: "transparent", border: "none", color: C.brandDot, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "2px 6px", borderRadius: R.xs, whiteSpace: "nowrap" }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button onClick={() => dismiss(t.id)} aria-label="Fermer" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.55)", cursor: "pointer", display: "flex", padding: 2 }}>
              <CloseIcon size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
