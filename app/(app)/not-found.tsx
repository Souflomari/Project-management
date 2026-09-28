import Link from "next/link";

import { C, R, TX } from "@/lib/tokens";

// Rendered inside the app shell for `notFound()` in any (app) route — e.g. an
// unknown /projets/[id] in Supabase mode.
export default function NotFound() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Link href="/projets" className="soft-hover" style={{ ...TX.caption, fontWeight: 600, color: C.ink500, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", margin: "0 0 14px -8px", borderRadius: R.sm }}>
        ← Projets
      </Link>
      <h1 style={{ ...TX.h2, color: C.ink900, margin: 0 }}>Page introuvable</h1>
      <p style={{ ...TX.body, color: C.ink500, marginTop: 6 }}>Cette page ou ce projet n&apos;existe pas, ou a été supprimé.</p>
    </div>
  );
}
