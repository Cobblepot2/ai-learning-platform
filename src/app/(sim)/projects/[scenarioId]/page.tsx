import { notFound } from "next/navigation";
import { Desktop } from "@/components/projects/desktop/Desktop";
import { getProjectScenario } from "@/lib/projects";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  const scenario = getProjectScenario(scenarioId);
  if (!scenario) notFound();
  // Only public framing is passed down. The run itself comes from the API.
  return (
    <Desktop
      scenarioId={scenario.id}
      title={scenario.title}
      summary={scenario.summary}
      client={scenario.client}
    />
  );
}
