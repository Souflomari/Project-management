import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";

import "./globals.css";
import { tokenCssVars } from "@/lib/tokens";

// Self-hosted at build time (no runtime CDN dependency) — fonts always load.
// Loaded as VARIABLE fonts (no fixed `weight`) so in-between weights like 440 /
// 540 / 580 render for real instead of snapping to the nearest static instance.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

const interTight = Inter_Tight({
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
    <html lang="fr" className={`${inter.variable} ${interTight.variable}`}>
      <head>
        {/* design-token bridge: projects lib/tokens onto :root custom properties */}
        <style dangerouslySetInnerHTML={{ __html: tokenCssVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
