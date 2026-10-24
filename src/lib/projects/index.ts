import { harbourClinic } from "./harbour-clinic";
import type { ProjectScenario } from "./types";

export const projectScenarios: ProjectScenario[] = [harbourClinic];

export function getProjectScenario(id: string): ProjectScenario | undefined {
  return projectScenarios.find((scenario) => scenario.id === id);
}
