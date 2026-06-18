// Small presentational primitives reused across views.

import { FONT_NUM } from "@/lib/tokens";

export function Avatar({
  initials,
  color,
  size = 30,
  fontSize,
  ring,
  title,
}: {
  initials: string;
  color: string;
  size?: number;
  fontSize?: number;
  /** Optional white ring (used when avatars overlap). */
  ring?: boolean;
  /** Native tooltip — full name / role. */
  title?: string;
}) {
  return (
    <div
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize ?? Math.round(size * 0.35),
        fontWeight: 700,
        color: "#fff",
        background: color,
        flexShrink: 0,
        ...(title ? { cursor: "default" } : null),
        ...(ring ? { border: "2px solid var(--paper, #fff)" } : null),
      }}
    >
      {initials}
    </div>
  );
}

export function PhaseBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: FONT_NUM,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".04em",
        color: "#6F6F6F",
        background: "transparent",
        border: "1px solid #D7DDD3",
        padding: "1px 6px",
        borderRadius: 3,
      }}
    >
      {label}
    </span>
  );
}

export function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: "#3B5560",
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: color }}
      />
      {label}
    </span>
  );
}

export function ProgressBar({
  pct,
  color,
  track = "#E4E8E2",
  height = 7,
}: {
  pct: number;
  color: string;
  track?: string;
  height?: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        height,
        background: track,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, pct))}%`,
          background: color,
          borderRadius: "3px 0 0 3px",
        }}
      />
    </div>
  );
}
