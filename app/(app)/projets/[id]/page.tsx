import { notFound } from "next/navigation";

import { ProjectPage } from "@/components/project-page";
import { getServerRepository } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Server entry for a project workspace. In Supabase mode the id is checked
// against the database here, so an unknown project is a real 404 (not a client
// "introuvable" flash). In sample (demo) mode projects created in the browser
// only exist in localStorage, so existence is resolved client-side.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  if (isSupabaseConfigured()) {
    const repo = await getServerRepository();
    if (!(await repo.getProject(Number(id)))) notFound();
  }
  return <ProjectPage key={id} />;
}
