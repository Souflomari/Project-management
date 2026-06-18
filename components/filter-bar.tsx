"use client";

import type { ReactNode } from "react";

import { useProjects } from "@/lib/store/projects-context";
import { C } from "@/lib/tokens";

export function FilterBar({ trailing }: { trailing?: ReactNode }) {
  const { filters, setFilter } = useProjects();

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      {filters.map((f) => {
        const a = f.active;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="btn"
            style={{
              cursor: "pointer",
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              whiteSpace: "nowrap",
              border: `1px solid ${a ? C.brand : C.line}`,
              background: a ? C.brand : C.surface,
              color: a ? "#fff" : C.ink700,
              transition: "background .12s, border-color .12s",
            }}
          >
            {f.label}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                padding: "1px 6px",
                borderRadius: 4,
                background: a ? "rgba(255,255,255,.24)" : C.subtle,
                color: a ? "#fff" : C.ink500,
              }}
            >
              {f.count}
            </span>
          </button>
        );
      })}
      {trailing ? <div style={{ marginLeft: "auto" }}>{trailing}</div> : null}
    </div>
  );
}
