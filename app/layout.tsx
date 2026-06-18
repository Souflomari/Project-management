import type { Metadata } from "next";

import "./globals.css";

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
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Inter+Tight:wght@500..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
