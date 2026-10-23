import type { Course, Lesson, LessonBlock } from "@/lib/types";
import type { LearningActivity } from "@/lib/learning/registry";
import type { SimulationConfig } from "./schema";

/**
 * What a database-course student may see in the page payload. The playable
 * scene still comes from `/api/simulations`; rules stay on the server.
 */
export type LearnerSimulationConfig = {
  schemaVersion: SimulationConfig["schemaVersion"];
  title: string;
  scenario: SimulationConfig["scenario"];
  completion: { maxSteps: number };
  redacted: true;
};

export type LearnerSimulationActivity = {
  type: "activity";
  id: string;
  version: number;
  activityType: "simulation";
  config: LearnerSimulationConfig;
  objectives?: string[];
};

export function isLearnerSimulation(
  block: unknown,
): block is LearnerSimulationActivity {
  if (!block || typeof block !== "object") return false;
  const value = block as {
    type?: unknown;
    activityType?: unknown;
    config?: { redacted?: unknown };
  };
  return (
    value.type === "activity" &&
    value.activityType === "simulation" &&
    value.config?.redacted === true
  );
}

function isFullSimulation(
  block: LessonBlock,
): block is Extract<LearningActivity, { activityType: "simulation" }> {
  if (block.type !== "activity" || block.activityType !== "simulation") return false;
  if (isLearnerSimulation(block)) return false;
  const config = block.config;
  return Boolean(
    config &&
      typeof config === "object" &&
      "stages" in config &&
      "scenario" in config &&
      "completion" in config,
  );
}

/** Drop stages, variables, conditions, effects and debriefs. */
export function redactSimulationBlock(block: LessonBlock): LessonBlock {
  if (!isFullSimulation(block)) return block;
  const { config } = block;
  const redacted: LearnerSimulationActivity = {
    type: "activity",
    id: block.id,
    version: block.version,
    activityType: "simulation",
    ...(block.objectives ? { objectives: block.objectives } : {}),
    config: {
      schemaVersion: config.schemaVersion,
      title: config.title,
      scenario: config.scenario,
      completion: { maxSteps: config.completion.maxSteps },
      redacted: true,
    },
  };
  return redacted;
}

export function redactLessonSimulations(lesson: Lesson): Lesson {
  return { ...lesson, blocks: lesson.blocks.map(redactSimulationBlock) };
}

export function redactCourseSimulations(course: Course): Course {
  return {
    ...course,
    lessons: course.lessons.map((lesson) => redactLessonSimulations(lesson)),
  };
}
