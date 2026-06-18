import type { Metadata } from "next";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { repository } from "@/lib/data";
import { ProjectsProvider } from "@/lib/store/projects-context";

export const metadata: Metadata = {
  title: "Setec · Pilotage des projets",
  description:
    "Pilotage du portefeuille de projets d'ingénierie — Direction technique Setec.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initial reads go through the data seam (sample data today, Supabase later).
  const [projects, team] = await Promise.all([
    repository.listProjects(),
    repository.listTeam(),
  ]);

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ProjectsProvider initialProjects={projects} initialTeam={team}>
          <AppShell>{children}</AppShell>
        </ProjectsProvider>
      </body>
    </html>
  );
}
