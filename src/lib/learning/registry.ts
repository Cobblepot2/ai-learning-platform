import { z } from "zod";

const text = z.string().trim().min(1).max(12000);

const choiceConfig = z.object({
  question: text,
  options: z.array(text).min(2).max(8),
  answer: z.number().int().min(0).max(7),
  explanation: text,
});

const quizQuestion = z.object({
  question: text,
  options: z.array(text).min(2).max(6),
  answer: z.number().int().min(0).max(5),
  explanation: text,
});

const quizConfig = z.object({
  title: text,
  questions: z.array(quizQuestion).min(1).max(8),
});

const orderingConfig = z.object({
  prompt: text,
  items: z.array(text).min(2).max(8),
  explanation: text,
});

const responseConfig = z.object({
  title: text,
  task: text,
  context: text,
  persona: z.string().max(2000),
  rubric: z.array(text).min(1).max(10),
  mode: z.enum(["reflection", "writing", "scenario", "roleplay"]),
});

const conversationConfig = z.object({
  title: text,
  scenario: text,
  persona: text,
  goals: z.array(text).min(1).max(8),
  rubric: z.array(text).min(1).max(10),
  opening: text,
  minTurns: z.number().int().min(1).max(12),
});

const readingConfig = z.object({ markdown: text });

const codeReviewConfig = z.object({
  context: text,
  language: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(20000),
  /** 1-based line numbers that contain the planted problem. */
  bugLines: z.array(z.number().int().min(1).max(500)).min(1).max(5),
  explanation: text,
});

function envelope<const T extends string, S extends z.ZodType>(
  activityType: T,
  schema: S,
) {
  return z.object({
    type: z.literal("activity"),
    id: text,
    version: z.literal(1),
    activityType: z.literal(activityType),
    config: schema,
    objectives: z.array(text).optional(),
  });
}

/**
 * Single source for authoring activities. The Zod union, editor, renderer and
 * evaluator maps are all keyed from this object. Adding a type starts here.
 */
export const activityDefinitions = {
  reading: {
    renderer: "reading" as const,
    editor: "fields" as const,
    evaluation: "none" as const,
    label: "Reading",
    description: "Explanations, examples and reference material.",
    schema: readingConfig,
    envelope: envelope("reading", readingConfig),
    initial: { markdown: "Introduce the concept with an example." },
  },
  choice: {
    renderer: "choice" as const,
    editor: "fields" as const,
    evaluation: "choice" as const,
    label: "Multiple choice",
    description:
      "A question with one correct answer; optional, never required.",
    schema: choiceConfig,
    envelope: envelope("choice", choiceConfig),
    initial: {
      question: "Which option best fits?",
      options: ["Option A", "Option B"],
      answer: 0,
      explanation: "Explain the reasoning.",
    },
  },
  quiz: {
    renderer: "quiz" as const,
    editor: "quiz" as const,
    evaluation: "quiz" as const,
    label: "Quiz",
    description:
      "Several multiple-choice questions in one activity. Formative, not a secure exam.",
    schema: quizConfig,
    envelope: envelope("quiz", quizConfig),
    initial: {
      title: "Check your understanding",
      questions: [
        {
          question: "Which option best fits?",
          options: ["Option A", "Option B"],
          answer: 0,
          explanation: "Explain the reasoning.",
        },
      ],
    },
  },
  ordering: {
    renderer: "ordering" as const,
    editor: "fields" as const,
    evaluation: "ordering" as const,
    label: "Ordering",
    description: "Put the steps in a working order. The stored list is the correct order.",
    schema: orderingConfig,
    envelope: envelope("ordering", orderingConfig),
    initial: {
      prompt: "Put these steps in a useful order.",
      items: ["First step", "Second step"],
      explanation: "Explain why this order helps.",
    },
  },
  response: {
    renderer: "response" as const,
    editor: "fields" as const,
    evaluation: "rubric" as const,
    label: "Guided response / scenario",
    description:
      "Open writing, reflection or a role-based scenario. AI gives evidence-based qualitative feedback and a next turn; learners revise.",
    schema: responseConfig,
    envelope: envelope("response", responseConfig),
    initial: {
      title: "Apply what you learned",
      task: "Explain your decision and reasoning.",
      context: "Provide the facts students should use.",
      persona: "",
      rubric: ["Uses evidence from the lesson", "Explains the reasoning"],
      mode: "reflection" as const,
    },
  },
  "code-review": {
    renderer: "code-review" as const,
    editor: "code-review" as const,
    evaluation: "code-review" as const,
    label: "Code review",
    description:
      "A bug hunt in a short code sample. Learners pick the line they think is wrong; checking is deterministic.",
    schema: codeReviewConfig,
    envelope: envelope("code-review", codeReviewConfig),
    initial: {
      context: "Explain what the code is meant to do, then ask for the bug.",
      language: "javascript",
      code: "function add(a, b) {\n  return a - b;\n}",
      bugLines: [2],
      explanation: "Explain why this line is wrong and what a test should check.",
    },
  },
  conversation: {
    renderer: "conversation" as const,
    editor: "fields" as const,
    evaluation: "conversation" as const,
    label: "Conversation",
    description:
      "A multi-turn conversation with a configured character. Each turn is saved. Feedback stays qualitative.",
    schema: conversationConfig,
    envelope: envelope("conversation", conversationConfig),
    initial: {
      title: "Conversation practice",
      scenario: "Describe the situation the learner walks into.",
      persona:
        "Describe who you play, which facts you may use, and that you stay in character.",
      goals: ["Ask a clarifying question", "Propose a next step"],
      rubric: [
        "Stays relevant to the scenario",
        "Responds to what the character actually said",
      ],
      opening: "Hello — what would you like to start with?",
      minTurns: 2,
    },
  },
};

export type ActivityType = keyof typeof activityDefinitions;

type Envelope = (typeof activityDefinitions)[ActivityType]["envelope"];

/** Derived from the registry. Do not add a parallel hand-written union. */
export const activitySchema = z.discriminatedUnion(
  "activityType",
  (Object.keys(activityDefinitions) as ActivityType[]).map(
    (key) => activityDefinitions[key].envelope,
  ) as [Envelope, ...Envelope[]],
);

export type LearningActivity = {
  [K in ActivityType]: {
    type: "activity";
    id: string;
    version: 1;
    activityType: K;
    config: z.infer<(typeof activityDefinitions)[K]["schema"]>;
    objectives?: string[];
  };
}[ActivityType];

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

function structuralMessage(activity: LearningActivity): string | null {
  switch (activity.activityType) {
    case "choice":
      return activity.config.answer >= activity.config.options.length
        ? "Correct answer must refer to an existing option."
        : null;
    case "quiz":
      return activity.config.questions.some(
        (question) => question.answer >= question.options.length,
      )
        ? "Each correct answer must refer to an existing option."
        : null;
    case "ordering":
      return new Set(activity.config.items).size !== activity.config.items.length
        ? "Ordering items must be unique."
        : null;
    case "code-review": {
      const lines = activity.config.code.split("\n").length;
      const unique = new Set(activity.config.bugLines);
      if (unique.size !== activity.config.bugLines.length) {
        return "Bug line numbers must be unique.";
      }
      return activity.config.bugLines.some((line) => line > lines)
        ? "Each bug line must exist in the code sample."
        : null;
    }
    case "reading":
    case "response":
    case "conversation":
      return null;
    default: {
      const unreachable: never = activity;
      return unreachable;
    }
  }
}

export function validateActivity(
  value: unknown,
):
  | { success: true; data: LearningActivity }
  | { success: false; error: { message: string } } {
  const parsed = activitySchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      error: { message: parsed.error.issues[0]?.message ?? "Invalid activity." },
    };
  }
  const data = parsed.data as LearningActivity;
  const message = structuralMessage(data);
  if (message) return { success: false, error: { message } };
  return { success: true, data };
}

export function newActivity(type: ActivityType): LearningActivity {
  const parsed = validateActivity({
    type: "activity",
    id: crypto.randomUUID(),
    version: 1,
    activityType: type,
    config: structuredClone(activityDefinitions[type].initial),
  });
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

export function usesModel(type: ActivityType): boolean {
  const evaluation = activityDefinitions[type].evaluation;
  return evaluation === "rubric" || evaluation === "conversation";
}

/** How many saved attempts on the current config are required before lesson completion. */
export function completionThreshold(activity: LearningActivity): number {
  switch (activity.activityType) {
    case "reading":
      return 0;
    case "conversation":
      return activity.config.minTurns;
    case "choice":
    case "quiz":
    case "ordering":
    case "code-review":
    case "response":
      return 1;
    default: {
      const unreachable: never = activity;
      return unreachable;
    }
  }
}

/** Tutor context without embedded answer keys. */
export function activityForTutor(activity: LearningActivity): unknown {
  switch (activity.activityType) {
    case "choice":
      return {
        type: "choice",
        question: activity.config.question,
        options: activity.config.options,
      };
    case "quiz":
      return {
        type: "quiz",
        title: activity.config.title,
        questions: activity.config.questions.map((question) => ({
          question: question.question,
          options: question.options,
        })),
      };
    case "ordering":
      return { type: "ordering", prompt: activity.config.prompt };
    case "code-review":
      return {
        type: "code-review",
        context: activity.config.context,
        language: activity.config.language,
        code: activity.config.code,
      };
    case "reading":
      return { type: "reading", markdown: activity.config.markdown };
    case "response":
      return { type: "response", config: activity.config };
    case "conversation":
      return {
        type: "conversation",
        title: activity.config.title,
        scenario: activity.config.scenario,
        goals: activity.config.goals,
        opening: activity.config.opening,
      };
    default: {
      const unreachable: never = activity;
      return unreachable;
    }
  }
}

/** JSONB may reorder keys; normalise both snapshots through the same schema. */
export function sameActivityContent(left: unknown, right: unknown): boolean {
  const a = validateActivity(left);
  const b = validateActivity(right);
  return (
    a.success &&
    b.success &&
    a.data.activityType === b.data.activityType &&
    JSON.stringify(a.data.config) === JSON.stringify(b.data.config)
  );
}
