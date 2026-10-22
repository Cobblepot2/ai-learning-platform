import type { LessonBlock } from "@/lib/types";
import type { SimulationConfig } from "@/lib/learning/simulation/schema";

/**
 * Authoring helpers for static catalogue content. Dynamic teacher courses use
 * the same Activity envelopes through the registry and activity editor.
 */
export function reading(id: string, markdown: string): LessonBlock {
  return {
    type: "activity",
    id,
    version: 1,
    activityType: "reading",
    config: { markdown },
  };
}

export function choice(
  id: string,
  question: string,
  options: string[],
  answer: number,
  explanation: string,
): LessonBlock {
  return {
    type: "activity",
    id,
    version: 1,
    activityType: "choice",
    config: { question, options, answer, explanation },
  };
}

export function quiz(
  id: string,
  title: string,
  questions: {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  }[],
): LessonBlock {
  return {
    type: "activity",
    id,
    version: 1,
    activityType: "quiz",
    config: { title, questions },
  };
}

export function ordering(
  id: string,
  prompt: string,
  items: string[],
  explanation: string,
): LessonBlock {
  return {
    type: "activity",
    id,
    version: 1,
    activityType: "ordering",
    config: { prompt, items, explanation },
  };
}

export function response(
  id: string,
  config: {
    title: string;
    task: string;
    context: string;
    persona: string;
    rubric: string[];
    mode: "reflection" | "writing" | "scenario" | "roleplay";
  },
): LessonBlock {
  return { type: "activity", id, version: 1, activityType: "response", config };
}

export function conversation(
  id: string,
  config: {
    title: string;
    scenario: string;
    persona: string;
    goals: string[];
    rubric: string[];
    opening: string;
    minTurns: number;
  },
): LessonBlock {
  return {
    type: "activity",
    id,
    version: 1,
    activityType: "conversation",
    config,
  };
}

export function codeReview(
  id: string,
  context: string,
  language: string,
  code: string,
  bugLines: number[],
  explanation: string,
): LessonBlock {
  return {
    type: "activity",
    id,
    version: 1,
    activityType: "code-review",
    config: { context, language, code, bugLines, explanation },
  };
}

/** A declared, stateful scenario. The same schema is used by AI-designed and hand-written simulations. */
export function simulation(id: string, config: SimulationConfig): LessonBlock {
  return {
    type: "activity",
    id,
    version: 1,
    activityType: "simulation",
    config,
  };
}
