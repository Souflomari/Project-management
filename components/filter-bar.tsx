"use client";

import type { ReactNode } from "react";

import { useProjects } from "@/lib/store/projects-context";
import { FONT_NUM } from "@/lib/tokens";

export function FilterBar({ trailing }: { trailing?: ReactNode }) {
  const { filters, setFilter } = useProjects();

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 14,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {filters.map((f) => {
        const a = f.active;
        return (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              cursor: "pointer",
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 13px",
              borderRadius: 3,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              whiteSpace: "nowrap",
              border: `1px solid ${a ? "#17823D" : "#D9E0D8"}`,
              background: a ? "#17823D" : "#fff",
              color: a ? "#fff" : "#3B5560",
            }}
          >
            {f.label}
            <span
              style={{
                fontFamily: FONT_NUM,
                fontSize: 11,
                fontWeight: 500,
                padding: "1px 6px",
                borderRadius: 3,
                background: a ? "rgba(255,255,255,.24)" : "#EDEFEC",
                color: a ? "#fff" : "#6F6F6F",
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
