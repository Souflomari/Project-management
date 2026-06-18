import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";

import "./globals.css";

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
  title: "Setec · Pilotage des projets",
  description:
    "Pilotage du portefeuille de projets d'ingénierie — Direction technique Setec.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${interTight.variable}`}>
      <body>{children}</body>
    </html>
  );
}
