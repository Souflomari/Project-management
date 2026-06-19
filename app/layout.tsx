import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";

import "./globals.css";
import { tokenCssVars } from "@/lib/tokens";

// Geist — Vercel's product typeface: a clean, modern, neutral grotesk built for
// dense UIs, with excellent tabular numerals. Used for both UI/body and the
// display/figure roles (hierarchy carried by size + weight, not a second face),
// for a cohesive, premium, non-quirky voice. Self-hosted via the `geist` package
// (defines the --font-geist-sans variable that the token layer points at).

export const metadata: Metadata = {
  title: {
    default: "Setec · Pilotage des projets",
    template: "%s · Setec",
  },
  description:
    "Pilotage du portefeuille de projets d'ingénierie — Direction technique Setec.",
  applicationName: "Setec Pilotage",
  appleWebApp: { capable: true, title: "Setec", statusBarStyle: "default" },
};

// Browser chrome tint: matches the warm canvas in light, near-black in dark.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F7" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1917" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={GeistSans.variable}>
      <head>
        {/* design-token bridge: projects lib/tokens onto :root custom properties */}
        <style dangerouslySetInnerHTML={{ __html: tokenCssVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
