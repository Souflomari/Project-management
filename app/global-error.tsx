"use client";

// Last-resort boundary: renders when the ROOT layout itself fails, so it must
// provide its own <html>/<body> and cannot rely on the token stylesheet —
// everything here is inline and self-contained.

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[setec] Erreur globale", error.digest ? `(digest ${error.digest})` : "", error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", background: "#FFFFFF", color: "#1C1917" }}>
        <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}>
          <div role="alert" style={{ width: 420, maxWidth: "100%", border: "1px solid #DAD7D1", borderRadius: 12, padding: 28, textAlign: "center", boxSizing: "border-box" }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em", marginBottom: 20 }}>
              setec<span style={{ color: "#15803D" }}>.</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>L’application n’a pas pu démarrer</h1>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6B645F", margin: "0 0 18px" }}>
              Une erreur inattendue est survenue. Réessayez ; si le problème persiste, rechargez la page.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ font: "inherit", fontSize: 14, fontWeight: 600, color: "#FFFFFF", background: "#1C1917", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
