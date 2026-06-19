"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { C, R, SH, SP, SURFACE, TX } from "@/lib/tokens";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.canvas,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "inherit",
        color: C.ink900,
      }}
    >
      <div
        style={{
          // faint tonal panel framing the card for warmth (tone, not shadow)
          background: SURFACE.containerLow,
          border: `1px solid ${C.line}`,
          borderRadius: R.xxl,
          padding: SP[5],
          width: 380 + SP[5] * 2,
          maxWidth: "100%",
        }}
      >
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          background: C.surface,
          border: `1px solid ${C.lineStrong}`,
          borderRadius: R.lg,
          padding: "30px 30px 26px",
          boxShadow: SH.lg,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 26, fontWeight: 700, letterSpacing: "-.02em" }}>
          <span>setec</span>
          <span style={{ color: C.brandDot }}>.</span>
        </div>
        <div style={{ fontSize: 12, color: C.ink400, fontWeight: 450, marginTop: 2 }}>
          Pilotage des projets
        </div>

        {!configured ? (
          <p style={{ fontSize: 13, color: C.ink500, lineHeight: 1.5, marginTop: 22 }}>
            L&apos;authentification n&apos;est pas configurée. L&apos;application
            fonctionne en données d&apos;exemple —{" "}
            <a href="/" style={{ color: C.brand, fontWeight: 600 }}>
              accéder au tableau de bord
            </a>
            .
          </p>
        ) : sent ? (
          <div style={{ marginTop: 24 }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>Vérifiez votre boîte mail</h1>
            <p style={{ fontSize: 13, color: C.ink500, lineHeight: 1.5, margin: 0 }}>
              Un lien de connexion a été envoyé à <strong>{email}</strong>. Cliquez
              dessus pour accéder à votre espace.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <h1 style={{ ...TX.h2, margin: "0 0 4px" }}>Connexion</h1>
            <p style={{ ...TX.caption, color: C.ink500, margin: "0 0 18px" }}>
              Recevez un lien de connexion par e-mail.
            </p>
            <label htmlFor="login-email" style={{ ...TX.eyebrow, color: C.ink500, display: "block", marginBottom: 6 }}>
              Adresse e-mail
            </label>
            <Input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@setec.fr"
              style={{ marginBottom: 16 }}
            />
            {error ? (
              <p style={{ fontSize: 12, color: C.danger, margin: "0 0 12px" }}>{error}</p>
            ) : null}
            <Button type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Envoi…" : "Recevoir le lien"}
            </Button>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
