"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { signOutAction } from "@/app/actions";
import { Button, Input } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { NBSP, NNBSP } from "@/lib/format";
import { C, R, SH, SP, TX } from "@/lib/tokens";

/** Map a raw (English) Supabase auth error to friendly French copy. Falls back
 *  to a generic message so we never leak the provider's wording. */
function frError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("after"))
    return `Trop de tentatives. Patientez quelques minutes avant de réessayer.`;
  if (m.includes("invalid") && m.includes("email"))
    return `Cette adresse e-mail n${"’"}est pas valide.`;
  if (m.includes("email") && (m.includes("not") || m.includes("disabled")))
    return `La connexion par e-mail n${"’"}est pas activée pour ce compte.`;
  if ((m.includes("signups") && m.includes("disabled")) || m.includes("not allowed") || m.includes("user not found"))
    return `Les inscriptions sont désactivées. Contactez votre administrateur.`;
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to"))
    return `Connexion au serveur impossible. Vérifiez votre réseau et réessayez.`;
  return `Une erreur est survenue. Réessayez dans un instant.`;
}

/** Errors handed back via `?error=` by the auth callback / the app layout. */
const URL_ERRORS: Record<string, string> = {
  auth: `Ce lien de connexion est invalide ou a expiré. Ouvrez-le dans le navigateur où vous l${"’"}avez demandé, ou demandez-en un nouveau.`,
  forbidden: `Votre compte n${"’"}a pas encore accès à l${"’"}application. Contactez votre administrateur.`,
};

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const configured = isSupabaseConfigured();
  const router = useRouter();
  const { error: urlError } = use(searchParams);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? (URL_ERRORS[urlError] ?? URL_ERRORS.auth) : null,
  );

  async function sendLink() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Invite-only: never create an account for an unknown address.
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
    });
    setLoading(false);
    if (error) setError(frError(error.message));
    else setSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendLink();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: C.canvas,
        fontFamily: "inherit",
        color: C.ink900,
      }}
    >
      {/* ── Left brand panel (hero) — hidden on narrow viewports ───────────── */}
      <div
        className="login-hero"
        style={{
          flex: "1 1 0",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: `${SP[9]}px ${SP[9]}px`,
          background: C.ink900,
          color: "#fff",
          // subtle engineering-grid texture + a soft brand-green glow
          backgroundImage: `
            radial-gradient(120% 80% at 0% 0%, rgba(30,142,72,.20), transparent 60%),
            linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 32px 32px, 32px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontSize: 28, fontWeight: 600, letterSpacing: "-.02em" }}>
          <span>setec</span>
          <span style={{ color: C.inversePrimary }}>.</span>
        </div>

        <div style={{ maxWidth: 460 }}>
          <h1 style={{ ...TX.display, color: "#fff", margin: `0 0 ${SP[4]}px` }}>
            Pilotez tout votre portefeuille de projets, au même endroit.
          </h1>
          <p style={{ ...TX.bodyLg, color: "rgba(255,255,255,.66)", margin: 0 }}>
            Planning, charge des équipes et avancement des études{NNBSP}— une seule
            vue claire pour décider vite.
          </p>
        </div>

        <div style={{ ...TX.micro, color: "rgba(255,255,255,.42)" }}>
          Setec{NBSP}· Pilotage des projets
        </div>
      </div>

      {/* ── Right auth column ─────────────────────────────────────────────── */}
      <div
        className="login-col"
        style={{
          flex: "0 1 520px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          className="login-card"
          style={{
            width: 380,
            maxWidth: "100%",
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: R.xl,
            padding: `${SP[8]}px ${SP[8]}px ${SP[7]}px`,
            boxShadow: SH.lg,
          }}
        >
          {/* wordmark repeated for the stacked (mobile) layout where the hero is hidden */}
          <div className="login-card-mark" style={{ display: "none", alignItems: "baseline", gap: 1, fontSize: 28, fontWeight: 600, letterSpacing: "-.02em", marginBottom: SP[5] }}>
            <span>setec</span>
            <span style={{ color: C.brandDot }}>.</span>
          </div>

          {!configured ? (
            <div
              role="status"
              style={{
                background: "#FAF1E4",
                border: `1px solid #E7C98F`,
                borderRadius: R.md,
                padding: `${SP[5]}px`,
                color: "#7A4B12",
              }}
            >
              <div style={{ ...TX.bodyStrong, color: "#7A4B12", margin: `0 0 ${SP[2]}px` }}>
                Mode démonstration
              </div>
              <p style={{ ...TX.caption, color: "#8A5A1E", margin: `0 0 ${SP[4]}px` }}>
                L{"’"}authentification n{"’"}est pas configurée sur cet
                environnement. L{"’"}application fonctionne avec des données
                d{"’"}exemple.
              </p>
              <Button onClick={() => router.push("/")} fullWidth>
                Accéder au tableau de bord
              </Button>
            </div>
          ) : sent ? (
            <div>
              <h1 style={{ ...TX.h2, margin: `0 0 ${SP[3]}px` }}>Vérifiez votre boîte mail</h1>
              <p style={{ ...TX.caption, color: C.ink500, margin: `0 0 ${SP[6]}px` }}>
                Un lien de connexion a été envoyé à <strong>{email}</strong>.
                Cliquez dessus pour accéder à votre espace.
              </p>
              <div style={{ display: "flex", gap: SP[3] }}>
                <Button onClick={sendLink} loading={loading} variant="secondary">
                  Renvoyer le lien
                </Button>
                <Button
                  variant="ghost"
                  disabled={loading}
                  onClick={() => { setSent(false); setError(null); }}
                >
                  Modifier l{"’"}adresse
                </Button>
              </div>
              {error ? (
                <p role="alert" style={{ ...TX.micro, color: C.danger, margin: `${SP[4]}px 0 0` }}>{error}</p>
              ) : null}
            </div>
          ) : urlError === "forbidden" ? (
            <div>
              <h1 style={{ ...TX.h2, margin: `0 0 ${SP[3]}px` }}>Accès non autorisé</h1>
              <p role="alert" style={{ ...TX.caption, color: C.ink500, margin: `0 0 ${SP[6]}px` }}>
                {URL_ERRORS.forbidden}
              </p>
              <form action={signOutAction}>
                <Button type="submit" variant="secondary" fullWidth>
                  Se déconnecter
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
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
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@setec.fr"
                invalid={!!error}
                style={{ marginBottom: error ? SP[3] : SP[5] }}
              />
              {error ? (
                <p role="alert" style={{ ...TX.micro, color: C.danger, margin: `0 0 ${SP[4]}px` }}>{error}</p>
              ) : null}
              <Button type="submit" loading={loading} fullWidth>
                Recevoir le lien
              </Button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .login-hero { display: none !important; }
          .login-card-mark { display: flex !important; }
          .login-col { flex: 1 1 auto !important; min-width: 0; padding: 16px !important; }
          .login-card { padding: 24px 20px !important; box-sizing: border-box; }
        }
      `}</style>
    </div>
  );
}
