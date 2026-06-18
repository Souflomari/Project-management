"use client";

import { useState } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

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
        background: "#1D4459",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Montserrat', sans-serif",
        color: "#233038",
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 6,
          padding: "30px 30px 26px",
          boxShadow: "0 18px 50px rgba(8,20,16,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 28, fontWeight: 800, letterSpacing: "-.03em" }}>
          <span>setec</span>
          <span style={{ color: "#3FA535" }}>.</span>
        </div>
        <div style={{ fontSize: 9.5, letterSpacing: ".18em", textTransform: "uppercase", color: "#9AA39B", fontWeight: 600, marginTop: 2 }}>
          Pilotage des projets
        </div>

        {!configured ? (
          <p style={{ fontSize: 13, color: "#6F6F6F", lineHeight: 1.5, marginTop: 22 }}>
            L&apos;authentification n&apos;est pas configurée. L&apos;application
            fonctionne en données d&apos;exemple —{" "}
            <a href="/" style={{ color: "#17823D", fontWeight: 600 }}>
              accéder au tableau de bord
            </a>
            .
          </p>
        ) : sent ? (
          <div style={{ marginTop: 24 }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>Vérifiez votre boîte mail</h1>
            <p style={{ fontSize: 13, color: "#6F6F6F", lineHeight: 1.5, margin: 0 }}>
              Un lien de connexion a été envoyé à <strong>{email}</strong>. Cliquez
              dessus pour accéder à votre espace.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Connexion</h1>
            <p style={{ fontSize: 12.5, color: "#6F6F6F", margin: "0 0 18px" }}>
              Recevez un lien de connexion par e-mail.
            </p>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#6F6F6F", marginBottom: 6 }}>
              Adresse e-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@setec.fr"
              style={{
                width: "100%",
                border: "1px solid #E2E6E0",
                borderRadius: 3,
                padding: "11px 12px",
                font: "inherit",
                fontSize: 13.5,
                outline: "none",
                marginBottom: 16,
              }}
            />
            {error ? (
              <p style={{ fontSize: 12, color: "#A42421", margin: "0 0 12px" }}>{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                border: "none",
                cursor: loading ? "default" : "pointer",
                background: "#17823D",
                color: "#fff",
                font: "inherit",
                fontWeight: 600,
                fontSize: 14,
                padding: "11px 0",
                borderRadius: 3,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Envoi…" : "Recevoir le lien"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
