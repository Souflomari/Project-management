import { AppShell } from "@/components/app-shell";
import { getServerRepository } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ProjectsProvider } from "@/lib/store/projects-context";

// Reads at request time so live data (Supabase) is always fresh and the build
// never reaches out to the database. Auth gating happens in middleware.ts.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const repo = await getServerRepository();
  const [projects, team] = await Promise.all([repo.listProjects(), repo.listTeam()]);

  return (
    <ProjectsProvider
      initialProjects={projects}
      initialTeam={team}
      serverBacked={isSupabaseConfigured()}
    >
      <AppShell>{children}</AppShell>
    </ProjectsProvider>
  );
}
