"use client";

import { Button } from "@/components/ui";
import { C, R, ROLE, SH, SP, TX } from "@/lib/tokens";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 420, maxWidth: "100%", background: C.surface, border: `1px solid ${C.lineStrong}`, borderRadius: R.xl, boxShadow: SH.md, padding: 28, textAlign: "center" }}>
        {/* brand mark — keeps the app identity on the error surface */}
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 1, fontFamily: "inherit", fontSize: 20, fontWeight: 600, letterSpacing: "-.02em", color: C.ink900, marginBottom: SP[6] }}>
          <span>setec</span>
          <span style={{ color: C.brandDot }}>.</span>
        </div>

        {/* error glyph — error-container role, NOT the green brand (governance) */}
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: ROLE.errorContainer,
            color: ROLE.onErrorContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 4.3 2.6 17.6A1.9 1.9 0 0 0 4.3 20.5h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
            <line x1="12" y1="9.5" x2="12" y2="13.5" />
            <line x1="12" y1="17" x2="12" y2="17" />
          </svg>
        </div>

        <h1 style={{ ...TX.h2, margin: "0 0 6px" }}>Une erreur est survenue</h1>
        <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 18px" }}>
          Le tableau de bord n&rsquo;a pas pu s&rsquo;afficher. Vous pouvez réessayer sans perdre votre session.
        </p>
        <Button onClick={reset} style={{ margin: "0 auto" }}>Recharger</Button>
      </div>
    </div>
  );
}
