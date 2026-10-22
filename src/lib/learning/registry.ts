import { z } from "zod";

const text = z.string().trim().min(1).max(12000);
export const activityDefinitions = {
  reading: {
    renderer: "reading",
    editor: "fields",
    evaluation: "none",
    label: "Reading",
    description: "Explanations, examples and reference material.",
    schema: z.object({ markdown: text }),
    initial: { markdown: "Introduce the concept with an example." },
  },
  choice: {
    renderer: "response",
    editor: "fields",
    evaluation: "choice",
    label: "Multiple choice",
    description:
      "A question with one correct answer; optional, never required.",
    schema: z.object({
      question: text,
      options: z.array(text).min(2).max(8),
      answer: z.number().int().min(0).max(7),
      explanation: text,
    }),
    initial: {
      question: "Which option best fits?",
      options: ["Option A", "Option B"],
      answer: 0,
      explanation: "Explain the reasoning.",
    },
  },
  response: {
    renderer: "response",
    editor: "fields",
    evaluation: "rubric",
    label: "Guided response / scenario",
    description:
      "Open writing, reflection or a role-based scenario. AI gives evidence-based qualitative feedback and a next turn; learners revise.",
    schema: z.object({
      title: text,
      task: text,
      context: text,
      persona: z.string().max(2000),
      rubric: z.array(text).min(1).max(10),
      mode: z.enum(["reflection", "writing", "scenario", "roleplay"]),
    }),
    initial: {
      title: "Apply what you learned",
      task: "Explain your decision and reasoning.",
      context: "Provide the facts students should use.",
      persona: "",
      rubric: ["Uses evidence from the lesson", "Explains the reasoning"],
      mode: "reflection" as const,
    },
  },
};
export type ActivityType = keyof typeof activityDefinitions;
export const activitySchema = z.discriminatedUnion("activityType", [
  z.object({
    type: z.literal("activity"),
    id: text,
    version: z.literal(1),
    activityType: z.literal("reading"),
    config: activityDefinitions.reading.schema,
    objectives: z.array(text).optional(),
  }),
  z.object({
    type: z.literal("activity"),
    id: text,
    version: z.literal(1),
    activityType: z.literal("choice"),
    config: activityDefinitions.choice.schema,
    objectives: z.array(text).optional(),
  }),
  z.object({
    type: z.literal("activity"),
    id: text,
    version: z.literal(1),
    activityType: z.literal("response"),
    config: activityDefinitions.response.schema,
    objectives: z.array(text).optional(),
  }),
]);
export type LearningActivity = z.infer<typeof activitySchema>;
export function validateActivity(value: unknown) {
  const parsed = activitySchema.safeParse(value);
  if (
    parsed.success &&
    parsed.data.activityType === "choice" &&
    parsed.data.config.answer >= parsed.data.config.options.length
  ) {
    return {
      success: false as const,
      error: { message: "Correct answer must refer to an existing option." },
    };
  }
  return parsed;
}
export function newActivity(type: ActivityType): LearningActivity {
  return activitySchema.parse({
    type: "activity",
    id: crypto.randomUUID(),
    version: 1,
    activityType: type,
    config: structuredClone(activityDefinitions[type].initial),
  });
}
export const feedbackSchema = z.object({
  summary: text,
  criteria: z
    .array(
      z.object({
        criterion: text,
        assessment: z.enum(["met", "developing", "not-yet"]),
        evidence: text,
        suggestion: text,
      }),
    )
    .max(10),
  nextStep: text,
  characterReply: z.string().max(3000),
});
export type LearningFeedback = z.infer<typeof feedbackSchema>;

/** JSONB may reorder keys; normalise both snapshots through the same schema. */
export function sameActivityContent(left: unknown, right: unknown): boolean {
  const a = validateActivity(left),
    b = validateActivity(right);
  return (
    a.success &&
    b.success &&
    a.data.activityType === b.data.activityType &&
    JSON.stringify(a.data.config) === JSON.stringify(b.data.config)
  );
}
