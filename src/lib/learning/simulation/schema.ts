import { z } from "zod";
import {
  conditionHolds,
  type SimulationComparison,
  type SimulationCondition,
  type SimulationValue,
} from "./conditions";

export const SIMULATION_SCHEMA_VERSION = 1;

export const SIMULATION_LIMITS = {
  variables: 8,
  stages: 16,
  actionsPerStage: 6,
  totalActions: 60,
  rules: 6,
  rubric: 8,
  maxSteps: 40,
} as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(
    /^[A-Za-z][A-Za-z0-9_-]*$/,
    "Use letters, numbers, hyphens or underscores, starting with a letter.",
  );
const shortText = z.string().trim().min(1).max(300);
const bodyText = z.string().trim().min(1).max(6000);
const optionalText = z.string().trim().max(2000);

export const simulationOutcomeSchema = z.enum([
  "success",
  "partial",
  "failure",
  "incomplete",
]);
export type SimulationOutcome = z.infer<typeof simulationOutcomeSchema>;

/** An ending stage cannot use "incomplete"; that outcome is reserved for limits. */
const ruleOutcomeSchema = z.enum(["success", "partial", "failure"]);

export const simulationVariableSchema = z.discriminatedUnion("type", [
  z.object({
    id: identifier,
    type: z.literal("number"),
    label: shortText,
    description: z.string().trim().max(600).optional(),
    initial: z.number().finite(),
    min: z.number().finite(),
    max: z.number().finite(),
    unit: z.string().trim().max(20).optional(),
    visible: z.boolean().default(true),
  }),
  z.object({
    id: identifier,
    type: z.literal("boolean"),
    label: shortText,
    description: z.string().trim().max(600).optional(),
    initial: z.boolean(),
    visible: z.boolean().default(true),
  }),
  z.object({
    id: identifier,
    type: z.literal("enum"),
    label: shortText,
    description: z.string().trim().max(600).optional(),
    initial: z.string().trim().min(1).max(80),
    options: z.array(z.string().trim().min(1).max(80)).min(2).max(8),
    visible: z.boolean().default(true),
  }),
]);
export type SimulationVariable = z.infer<typeof simulationVariableSchema>;

export const simulationComparisonSchema = z.object({
  kind: z.literal("compare"),
  variable: identifier,
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
  value: z.union([z.number().finite(), z.boolean(), z.string().trim().min(1).max(80)]),
});

export const simulationConditionSchema = z.union([
  simulationComparisonSchema,
  z.object({
    kind: z.literal("group"),
    op: z.enum(["and", "or"]),
    conditions: z.array(simulationComparisonSchema).min(2).max(6),
  }),
]);

export const simulationEffectSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    variable: identifier,
    value: z.number().finite().min(-1000).max(1000),
  }),
  z.object({
    op: z.literal("set"),
    variable: identifier,
    value: z.union([z.number().finite(), z.boolean(), z.string().trim().min(1).max(80)]),
  }),
]);
export type SimulationEffect = z.infer<typeof simulationEffectSchema>;

export const simulationActionSchema = z.object({
  id: identifier,
  label: shortText,
  description: z.string().trim().max(1000).optional(),
  availableWhen: simulationConditionSchema.optional(),
  effects: z.array(simulationEffectSchema).max(6).default([]),
  feedback: bodyText,
  /** Omit to stay in the current stage. Must point at an existing stage. */
  nextStage: identifier.optional(),
  /**
   * "system" actions are never offered to the learner. The server applies them
   * after it has interpreted something the learner wrote (an interview, a brief),
   * so a free-text step still ends in a predefined, gradeable outcome.
   */
  trigger: z.enum(["learner", "system"]).optional(),
});
export type SimulationAction = z.infer<typeof simulationActionSchema>;

export const simulationStageSchema = z.object({
  id: identifier,
  title: shortText,
  narrative: bodyText,
  actions: z.array(simulationActionSchema).max(SIMULATION_LIMITS.actionsPerStage).default([]),
  ending: z
    .object({
      outcome: ruleOutcomeSchema,
      summary: bodyText,
    })
    .optional(),
});
export type SimulationStage = z.infer<typeof simulationStageSchema>;

export const simulationRubricSchema = z.object({
  id: identifier,
  criterion: shortText,
  description: z.string().trim().max(1000).optional(),
});
export type SimulationRubric = z.infer<typeof simulationRubricSchema>;

export const simulationConfigSchema = z.object({
  schemaVersion: z.literal(SIMULATION_SCHEMA_VERSION),
  title: shortText,
  scenario: z.object({
    description: bodyText,
    objectives: z.array(shortText).min(1).max(8),
    initialSituation: bodyText,
    participantRole: shortText,
    persona: optionalText.optional(),
  }),
  variables: z.array(simulationVariableSchema).min(1).max(SIMULATION_LIMITS.variables),
  startStage: identifier,
  stages: z
    .array(simulationStageSchema)
    .min(2)
    .max(SIMULATION_LIMITS.stages),
  completion: z.object({
    maxSteps: z.number().int().min(3).max(SIMULATION_LIMITS.maxSteps),
    rules: z
      .array(
        z.object({
          outcome: ruleOutcomeSchema,
          when: simulationConditionSchema,
          summary: bodyText,
        }),
      )
      .max(SIMULATION_LIMITS.rules)
      .default([]),
    exhaustedSummary: bodyText,
  }),
  rubric: z.array(simulationRubricSchema).min(1).max(SIMULATION_LIMITS.rubric),
  debrief: z.object({
    success: bodyText,
    partial: bodyText,
    failure: bodyText,
    incomplete: bodyText,
  }),
});

export type SimulationConfig = z.infer<typeof simulationConfigSchema>;
export type SimulationStageView = SimulationStage;

function duplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function valueMatchesVariable(
  variable: SimulationVariable,
  value: SimulationValue,
): boolean {
  if (variable.type === "number") return typeof value === "number";
  if (variable.type === "boolean") return typeof value === "boolean";
  return typeof value === "string" && variable.options.includes(value);
}

function comparisonProblem(
  comparison: SimulationComparison | SimulationCondition,
  variables: Map<string, SimulationVariable>,
  where: string,
): string | null {
  if (comparison.kind === "group") {
    for (const item of comparison.conditions) {
      const problem = comparisonProblem(item, variables, where);
      if (problem) return problem;
    }
    return null;
  }
  const variable = variables.get(comparison.variable);
  if (!variable) {
    return `${where} refers to unknown state variable "${comparison.variable}".`;
  }
  if (!valueMatchesVariable(variable, comparison.value)) {
    return `${where} compares ${variable.label} with a value of the wrong type or an unknown option.`;
  }
  if (
    ["gt", "gte", "lt", "lte"].includes(comparison.op) &&
    variable.type !== "number"
  ) {
    return `${where} uses ${comparison.op} on ${variable.label}, which is not a number.`;
  }
  return null;
}

/**
 * Cross-field checks that Zod shape validation cannot express. Runs in the
 * registry's validateActivity and in the AI generation post-check.
 */
export function simulationProblems(
  config: SimulationConfig,
  options: { allowSystemActions?: boolean } = {},
): string[] {
  const problems: string[] = [];
  const variableMap = new Map<string, SimulationVariable>();
  for (const variable of config.variables) {
    if (variableMap.has(variable.id)) {
      problems.push(`Duplicate state variable id "${variable.id}".`);
    }
    variableMap.set(variable.id, variable);
  }

  for (const variable of config.variables) {
    if (variable.type === "number") {
      if (variable.min > variable.max) {
        problems.push(`${variable.label} has min greater than max.`);
      } else if (variable.initial < variable.min || variable.initial > variable.max) {
        problems.push(`${variable.label} starts outside its allowed range.`);
      }
    }
    if (variable.type === "enum") {
      const repeated = duplicate(variable.options);
      if (repeated) problems.push(`${variable.label} repeats option "${repeated}".`);
      if (!variable.options.includes(variable.initial)) {
        problems.push(`${variable.label} starts at an option that does not exist.`);
      }
    }
  }

  const stageMap = new Map<string, SimulationStage>();
  for (const stage of config.stages) {
    if (stageMap.has(stage.id)) problems.push(`Duplicate stage id "${stage.id}".`);
    stageMap.set(stage.id, stage);
  }
  if (!stageMap.has(config.startStage)) {
    problems.push("The start stage does not exist.");
  }

  const actionIds: string[] = [];
  let totalActions = 0;
  for (const stage of config.stages) {
    totalActions += stage.actions.length;
    if (stage.ending && stage.actions.length > 0) {
      problems.push(`Stage "${stage.title}" is an ending and cannot also have actions.`);
    }
    if (!stage.ending && stage.actions.length === 0) {
      problems.push(`Stage "${stage.title}" needs at least one action or an ending.`);
    }
    for (const action of stage.actions) {
      actionIds.push(action.id);
      const where = `Action "${action.label}"`;
      // Lesson simulations have nothing that could apply a system action, so the
      // learner would be stuck. Only project scenarios drive them from the server.
      if (action.trigger === "system" && !options.allowSystemActions) {
        problems.push(`${where} is a system action, which lesson simulations cannot use.`);
      }
      if (action.nextStage && !stageMap.has(action.nextStage)) {
        problems.push(`${where} points at a stage that does not exist.`);
      }
      if (
        action.effects.length === 0 &&
        (!action.nextStage || action.nextStage === stage.id)
      ) {
        problems.push(`${where} does not change state or move to another stage.`);
      }
      if (action.availableWhen) {
        const problem = comparisonProblem(action.availableWhen, variableMap, where);
        if (problem) problems.push(problem);
      }
      for (const effect of action.effects) {
        const variable = variableMap.get(effect.variable);
        if (!variable) {
          problems.push(`${where} changes unknown state variable "${effect.variable}".`);
          continue;
        }
        if (effect.op === "add" && variable.type !== "number") {
          problems.push(`${where} adds to ${variable.label}, which is not a number.`);
        }
        if (effect.op === "set" && !valueMatchesVariable(variable, effect.value)) {
          problems.push(`${where} sets ${variable.label} to an invalid value.`);
        }
        if (
          effect.op === "set" &&
          variable.type === "number" &&
          typeof effect.value === "number" &&
          (effect.value < variable.min || effect.value > variable.max)
        ) {
          problems.push(`${where} sets ${variable.label} outside its allowed range.`);
        }
      }
    }
  }
  if (totalActions > SIMULATION_LIMITS.totalActions) {
    problems.push(`A simulation may contain at most ${SIMULATION_LIMITS.totalActions} actions.`);
  }
  const repeatedAction = duplicate(actionIds);
  if (repeatedAction) problems.push(`Duplicate action id "${repeatedAction}".`);

  for (const rule of config.completion.rules) {
    const problem = comparisonProblem(rule.when, variableMap, "A completion rule");
    if (problem) problems.push(problem);
  }

  for (const item of config.rubric) {
    if (config.rubric.filter((other) => other.id === item.id).length > 1) {
      problems.push(`Duplicate rubric id "${item.id}".`);
    }
  }

  if (config.startStage && stageMap.has(config.startStage)) {
    const start = stageMap.get(config.startStage)!;
    const initial: Record<string, SimulationValue> = {};
    for (const variable of config.variables) initial[variable.id] = variable.initial;
    if (!start.ending && !start.actions.some((action) => conditionHolds(action.availableWhen, initial))) {
      problems.push("No action is available in the start stage with the initial state.");
    }
  }

  // Every declared stage must be reachable; otherwise a generated branch is
  // dead content that students can never see.
  if (stageMap.has(config.startStage)) {
    const reachable = new Set<string>([config.startStage]);
    const queue = [config.startStage];
    while (queue.length) {
      const current = stageMap.get(queue.shift()!);
      if (!current) continue;
      for (const action of current.actions) {
        if (action.nextStage && !reachable.has(action.nextStage)) {
          reachable.add(action.nextStage);
          queue.push(action.nextStage);
        }
      }
    }
    for (const stage of config.stages) {
      if (!reachable.has(stage.id)) {
        problems.push(`Stage "${stage.title}" cannot be reached from the start stage.`);
      }
    }
  }

  const canSucceed =
    config.stages.some((stage) => stage.ending?.outcome === "success") ||
    config.completion.rules.some(
      (rule) => rule.outcome === "success" || rule.outcome === "partial",
    );
  if (!canSucceed) {
    problems.push("A simulation needs a success (or partial) ending or completion rule.");
  }

  return problems;
}

/** Envelope used by the AI response schema (no refinements, JSON-Schema friendly). */
export const simulationActivityShape = z.object({
  type: z.literal("activity"),
  id: z.string().trim().min(1).max(120),
  version: z.literal(1),
  activityType: z.literal("simulation"),
  config: simulationConfigSchema,
  objectives: z.array(z.string().trim().min(1).max(300)).optional(),
});

/**
 * Manual starter used by "Add simulation". Deliberately small: a teacher can
 * replace every field, and the same editor is used for AI-generated content.
 */
export const initialSimulationConfig: SimulationConfig = {
  schemaVersion: SIMULATION_SCHEMA_VERSION,
  title: "Make a decision",
  scenario: {
    description:
      "A short scenario description shown above the decision. Explain the situation, the constraints and what a good decision would balance.",
    objectives: ["Explain the trade-off behind a decision"],
    initialSituation: "You have limited time and resources. Choose how to begin.",
    participantRole: "You are the person responsible for the decision.",
    persona: "",
  },
  variables: [
    {
      id: "progress",
      type: "number",
      label: "Progress",
      initial: 0,
      min: 0,
      max: 10,
      visible: true,
    },
  ],
  startStage: "start",
  stages: [
    {
      id: "start",
      title: "Choose a first step",
      narrative: "What will you do first?",
      actions: [
        {
          id: "balanced-choice",
          label: "Take a balanced first step",
          description: "Gather a little evidence before committing.",
          effects: [{ op: "add", variable: "progress", value: 2 }],
          feedback:
            "Good start. You made progress while keeping room to change course.",
          nextStage: "outcome",
        },
      ],
    },
    {
      id: "outcome",
      title: "Outcome",
      narrative: "Review the result of your decision.",
      actions: [],
      ending: {
        outcome: "success",
        summary: "You made progress with a balanced first decision.",
      },
    },
  ],
  completion: {
    maxSteps: 4,
    rules: [],
    exhaustedSummary: "You reached the step limit before finishing.",
  },
  rubric: [
    {
      id: "tradeoff",
      criterion: "Explains the trade-off behind the decision",
      description: "Name what was gained and what was given up.",
    },
  ],
  debrief: {
    success: "You made a decision and can explain why it was reasonable.",
    partial: "You made progress, but some trade-offs were not addressed.",
    failure: "The decision did not meet the goal. Consider what evidence was missing.",
    incomplete: "The scenario ended before the goal was reached.",
  },
};
