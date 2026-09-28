import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { AppSkeleton } from "@/components/skeleton";
import { getServerContext } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ProjectsProvider } from "@/lib/store/projects-context";

// Reads at request time so live data (Supabase) is always fresh and the build
// never reaches out to the database. The proxy (proxy.ts) redirects signed-out
// visitors; access itself is checked here, in every server action, and by RLS.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // The data fetch lives in a suspending child so the shell shows a skeleton
  // while Supabase responds, then swaps in seamlessly.
  return (
    <Suspense fallback={<AppSkeleton />}>
      <AppData>{children}</AppData>
    </Suspense>
  );
}

async function AppData({ children }: { children: React.ReactNode }) {
  const { repository: repo, user, viewer } = await getServerContext();
  // Signed in but not granted access: RLS would return nothing, so say so instead
  // of showing an empty portfolio.
  if (isSupabaseConfigured() && (!user || !viewer)) redirect(user ? "/login?error=forbidden" : "/login");
  const [projects, team] = await Promise.all([repo.listProjects(), repo.listTeam()]);

  return (
    <ProjectsProvider initialProjects={projects} initialTeam={team} serverBacked={isSupabaseConfigured()}>
      <AppShell>{children}</AppShell>
    </ProjectsProvider>
  );
}
