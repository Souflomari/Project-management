import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";

import "./globals.css";
import { tokenCssVars } from "@/lib/tokens";

// Self-hosted at build time (no runtime CDN dependency) — fonts always load.
// UI/body: Hanken Grotesk — a clean, neutral grotesk that stays legible at the
// dense small sizes the tables and gantt use. Display/figures: Space Grotesk —
// a precise, technical face (mono-derived numerals) that gives the engineering
// product a distinctive, confident voice. Both loaded as VARIABLE fonts so the
// in-between weights in the type scale render for real.
const fontUi = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

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
    <html lang="fr" className={`${fontUi.variable} ${fontDisplay.variable}`}>
      <head>
        {/* design-token bridge: projects lib/tokens onto :root custom properties */}
        <style dangerouslySetInnerHTML={{ __html: tokenCssVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
