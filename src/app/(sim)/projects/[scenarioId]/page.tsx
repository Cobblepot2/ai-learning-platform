import { notFound } from "next/navigation";
import { Desktop } from "@/components/projects/desktop/Desktop";
import { getProjectScenario } from "@/lib/projects";
import { isGeneratedId, loadPlayableListing } from "@/lib/projects/generated/store";
import { serverDb } from "@/lib/supabase/server";

/** Public framing for the desktop. The run itself, and anything hidden, comes from the API. */
async function framing(scenarioId: string) {
  const builtIn = getProjectScenario(scenarioId);
  if (builtIn) return { title: builtIn.title, summary: builtIn.summary };
  if (!isGeneratedId(scenarioId)) return null;
  const db = await serverDb();
  const { data: auth } = (await db?.auth.getUser()) ?? { data: { user: null } };
  // Signed out: the desktop asks the visitor to sign in before anything is loaded.
  if (!db || !auth.user) return { title: "Your project", summary: "Sign in to open a project you created." };
  // The owner's own project, or an instructor's project assigned to the student's class.
  const data = await loadPlayableListing(scenarioId, auth.user.id);
  if (!data) return null;
  const exit = data.pathId ? { href: `/paths/${data.pathId}`, label: "Back to your path" } : data.own ? undefined : { href: "/projects", label: "Back to your classes" };
  return { title: data.title, summary: data.summary, exit };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  const shown = await framing(scenarioId);
  if (!shown) notFound();
  return <Desktop scenarioId={scenarioId} title={shown.title} summary={shown.summary} exit={"exit" in shown ? shown.exit : undefined} />;
}
