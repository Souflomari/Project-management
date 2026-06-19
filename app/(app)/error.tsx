"use client";

import { Button } from "@/components/ui";
import { C, R, SH, TX } from "@/lib/tokens";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 420, maxWidth: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SH.md, padding: 28, textAlign: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.brand50, color: C.danger, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 20, fontWeight: 700 }}>!</div>
        <h1 style={{ ...TX.h2, margin: "0 0 6px" }}>Une erreur est survenue</h1>
        <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 18px" }}>
          Le tableau de bord n’a pas pu s’afficher. Vous pouvez réessayer sans perdre votre session.
        </p>
        <Button onClick={reset} style={{ margin: "0 auto" }}>Recharger</Button>
      </div>
    </div>
  );
}
