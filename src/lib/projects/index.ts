import { harbourClinic } from "./harbour-clinic";
import { harbourClinicDraft } from "./generated/draft-example";
import type { ProjectDraft } from "./generated/draft";
import { parcelPal, parcelPalDraft } from "./parcelpal";
import { tidewaterSwim, tidewaterSwimDraft } from "./tidewater-swim";
import { wardInfectionAudit, wardInfectionAuditDraft } from "./ward-infection-audit";
import { isGeneratedId, loadGeneratedScenario } from "./generated/store";
import type { ProjectScenario } from "./types";

export const projectScenarios: ProjectScenario[] = [harbourClinic, tidewaterSwim, parcelPal, wardInfectionAudit];

/** The built-in projects as drafts, for instructors to customise with the AI. */
export const BUILT_IN_DRAFTS: Record<string, ProjectDraft> = {
  "harbour-clinic": harbourClinicDraft,
  "tidewater-swim": tidewaterSwimDraft,
  parcelpal: parcelPalDraft,
  "ward-infection-audit": wardInfectionAuditDraft,
};

/** A built-in project, written in code. */
export function getProjectScenario(id: string): ProjectScenario | undefined {
  return projectScenarios.find((scenario) => scenario.id === id);
}

/**
 * Any project the user may play: a built-in one, or a generated one they own.
 * Returns null otherwise, so other people's projects look like missing ones.
 */
export async function loadProjectScenario(id: string, userId: string): Promise<ProjectScenario | null> {
  const builtIn = getProjectScenario(id);
  if (builtIn) return builtIn;
  return isGeneratedId(id) ? loadGeneratedScenario(id, userId) : null;
}
