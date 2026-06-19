"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { C, R, SH, SP, TX } from "@/lib/tokens";

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
          // one confident, raised white card on the warm canvas
          width: 380,
          maxWidth: "100%",
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: R.xl,
          padding: `${SP[8]}px ${SP[8]}px ${SP[7]}px`,
          boxShadow: SH.lg,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 26, fontWeight: 700, letterSpacing: "-.02em" }}>
          <span>setec</span>
          <span style={{ color: C.brandDot }}>.</span>
        </div>
        <div style={{ ...TX.caption, color: C.ink500, marginTop: SP[1] }}>
          Pilotage des projets
        </div>

        {!configured ? (
          <p style={{ ...TX.caption, color: C.ink500, marginTop: SP[7] }}>
            L’authentification n’est pas configurée. L’application
            fonctionne en données d’exemple —{" "}
            <a href="/" style={{ color: C.brand, fontWeight: 600 }}>
              accéder au tableau de bord
            </a>
            .
          </p>
        ) : sent ? (
          <div style={{ marginTop: SP[7] }}>
            <h1 style={{ ...TX.h2, margin: `0 0 ${SP[3]}px` }}>Vérifiez votre boîte mail</h1>
            <p style={{ ...TX.caption, color: C.ink500, margin: 0 }}>
              Un lien de connexion a été envoyé à <strong>{email}</strong>. Cliquez
              dessus pour accéder à votre espace.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: SP[7] }}>
            <h1 style={{ ...TX.h2, margin: "0 0 4px" }}>Connexion</h1>
            <p style={{ ...TX.caption, color: C.ink500, margin: `0 0 ${SP[6]}px` }}>
              Recevez un lien de connexion par e-mail.
            </p>
            <label htmlFor="login-email" style={{ ...TX.overline, color: C.ink700, display: "block", marginBottom: SP[3] }}>
              Adresse e-mail
            </label>
            <Input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@setec.fr"
              style={{ marginBottom: SP[5] }}
            />
            {error ? (
              <p style={{ ...TX.micro, color: C.danger, margin: `0 0 ${SP[4]}px` }}>{error}</p>
            ) : null}
            <Button type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Envoi…" : "Recevoir le lien"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
