import {
  conditionHolds,
  type SimulationValue,
} from "./conditions";
import type {
  SimulationAction,
  SimulationConfig,
  SimulationOutcome,
  SimulationStage,
  SimulationVariable,
} from "./schema";

export type SimulationState = {
  stageId: string;
  step: number;
  variables: Record<string, SimulationValue>;
  status: "active" | "completed";
  outcome: SimulationOutcome | null;
  summary: string | null;
};

export type SimulationChange = {
  variable: string;
  label: string;
  from: SimulationValue;
  to: SimulationValue;
};

export type SimulationEvent = {
  step: number;
  stageId: string;
  actionId: string;
  actionLabel: string;
  feedback: string;
  changes: SimulationChange[];
  nextStageId: string;
};

export type SimulationHistory = SimulationEvent[];

export type SimulationPublicVariable = {
  id: string;
  label: string;
  type: SimulationVariable["type"];
  value: SimulationValue;
  description?: string;
  min?: number;
  max?: number;
  unit?: string;
  options?: string[];
};

export type SimulationPublicAction = {
  id: string;
  label: string;
  description?: string;
};

export type SimulationPublicEvent = {
  step: number;
  stageId: string;
  actionLabel: string;
  feedback: string;
  changes: SimulationChange[];
};

export type SimulationCompletion = {
  outcome: SimulationOutcome;
  summary: string;
  debrief: string;
  rubric: { id: string; criterion: string; description?: string }[];
};

export type SimulationPublicView = {
  title: string;
  status: SimulationState["status"];
  step: number;
  maxSteps: number;
  scenario: {
    description: string;
    objectives: string[];
    initialSituation: string;
    participantRole: string;
    persona?: string;
  };
  stage: { id: string; title: string; narrative: string };
  variables: SimulationPublicVariable[];
  actions: SimulationPublicAction[];
  history: SimulationPublicEvent[];
  completion: SimulationCompletion | null;
};

export class SimulationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function stageOf(config: SimulationConfig, stageId: string): SimulationStage {
  const stage = config.stages.find((item) => item.id === stageId);
  if (!stage) throw new SimulationError("The simulation stage is missing.", 500);
  return stage;
}

export function initialValues(
  config: SimulationConfig,
): Record<string, SimulationValue> {
  return Object.fromEntries(
    config.variables.map((variable) => [variable.id, variable.initial]),
  );
}

export function startSimulation(config: SimulationConfig): SimulationState {
  if (!config.stages.some((stage) => stage.id === config.startStage)) {
    throw new SimulationError("The simulation start stage is invalid.", 500);
  }
  return {
    stageId: config.startStage,
    step: 0,
    variables: initialValues(config),
    status: "active",
    outcome: null,
    summary: null,
  };
}

export function availableActions(
  config: SimulationConfig,
  state: SimulationState,
): SimulationAction[] {
  const stage = stageOf(config, state.stageId);
  return stage.actions.filter((action) =>
    conditionHolds(action.availableWhen, state.variables),
  );
}

function clamp(variable: SimulationVariable, value: number): number {
  if (variable.type !== "number") return value;
  return Math.min(variable.max, Math.max(variable.min, value));
}

function applyEffects(
  config: SimulationConfig,
  variables: Record<string, SimulationValue>,
  action: SimulationAction,
  changes: SimulationChange[],
): void {
  for (const effect of action.effects) {
    const variable = config.variables.find(
      (item) => item.id === effect.variable,
    );
    if (!variable) {
      throw new SimulationError("The activity changes a missing variable.", 500);
    }
    const before = variables[variable.id];
    let next: SimulationValue;
    if (effect.op === "add") {
      if (typeof before !== "number" || typeof effect.value !== "number") {
        throw new SimulationError("An add effect needs a number.", 500);
      }
      next = clamp(variable, before + effect.value);
    } else {
      next = effect.value;
      if (typeof next === "number" && variable.type === "number") {
        next = clamp(variable, next);
      }
    }
    variables[variable.id] = next;
    if (next !== before) {
      changes.push({
        variable: variable.id,
        label: variable.label,
        from: before,
        to: next,
      });
    }
  }
}

/**
 * The only way a simulation advances. The server calls this with its stored
 * state and an action id; the browser never supplies variable values, stages or
 * outcomes. Unknown/unavailable actions and completed sessions are rejected.
 */
export function applySimulationAction(
  config: SimulationConfig,
  state: SimulationState,
  actionId: string,
): { state: SimulationState; event: SimulationEvent } {
  if (state.status === "completed") {
    throw new SimulationError("This simulation is already complete.");
  }
  const stage = stageOf(config, state.stageId);
  const action = stage.actions.find((item) => item.id === actionId);
  if (!action) {
    throw new SimulationError("That action is not part of this stage.");
  }
  if (!conditionHolds(action.availableWhen, state.variables)) {
    throw new SimulationError("That action is not available right now.");
  }

  const variables = { ...state.variables };
  const changes: SimulationChange[] = [];
  applyEffects(config, variables, action, changes);

  const nextStageId = action.nextStage ?? stage.id;
  const nextStage = stageOf(config, nextStageId);
  const step = state.step + 1;

  let outcome: SimulationOutcome | null = null;
  let summary: string | null = null;
  if (nextStage.ending) {
    outcome = nextStage.ending.outcome;
    summary = nextStage.ending.summary;
  } else {
    const rule = config.completion.rules.find((item) =>
      conditionHolds(item.when, variables),
    );
    if (rule) {
      outcome = rule.outcome;
      summary = rule.summary;
    } else if (step >= config.completion.maxSteps) {
      outcome = "incomplete";
      summary = config.completion.exhaustedSummary;
    } else if (
      !nextStage.actions.some((item) =>
        conditionHolds(item.availableWhen, variables),
      )
    ) {
      // A stage whose actions are all conditionally unavailable would strand
      // the learner. Close the run explicitly instead of showing a dead end.
      outcome = "incomplete";
      summary = config.completion.exhaustedSummary;
    }
  }

  const nextState: SimulationState = {
    stageId: nextStageId,
    step,
    variables,
    status: outcome ? "completed" : "active",
    outcome,
    summary,
  };
  const event: SimulationEvent = {
    step,
    stageId: stage.id,
    actionId: action.id,
    actionLabel: action.label,
    feedback: action.feedback,
    changes,
    nextStageId,
  };
  return { state: nextState, event };
}

function visibleVariables(
  config: SimulationConfig,
  state: SimulationState,
): SimulationPublicVariable[] {
  return config.variables
    .filter((variable) => variable.visible !== false)
    .map((variable) => {
      const value = state.variables[variable.id];
      if (variable.type === "number") {
        return {
          id: variable.id,
          label: variable.label,
          type: variable.type,
          value,
          description: variable.description,
          min: variable.min,
          max: variable.max,
          unit: variable.unit,
        };
      }
      if (variable.type === "enum") {
        return {
          id: variable.id,
          label: variable.label,
          type: variable.type,
          value,
          description: variable.description,
          options: variable.options,
        };
      }
      return {
        id: variable.id,
        label: variable.label,
        type: variable.type,
        value,
        description: variable.description,
      };
    });
}

/**
 * The projection sent to students. Rules, conditions, effects and hidden
 * variables never leave the server; only the current scene, visible state and
 * currently available actions are returned.
 */
export function simulationView(
  config: SimulationConfig,
  state: SimulationState,
  history: SimulationHistory,
): SimulationPublicView {
  const stage = stageOf(config, state.stageId);
  const visible = new Set(
    config.variables
      .filter((variable) => variable.visible !== false)
      .map((variable) => variable.id),
  );
  return {
    title: config.title,
    status: state.status,
    step: state.step,
    maxSteps: config.completion.maxSteps,
    scenario: {
      description: config.scenario.description,
      objectives: config.scenario.objectives,
      initialSituation: config.scenario.initialSituation,
      participantRole: config.scenario.participantRole,
      persona: config.scenario.persona,
    },
    stage: { id: stage.id, title: stage.title, narrative: stage.narrative },
    variables: visibleVariables(config, state),
    actions:
      state.status === "completed"
        ? []
        : availableActions(config, state).map((action) => ({
            id: action.id,
            label: action.label,
            description: action.description,
          })),
    history: history.map((event) => ({
      step: event.step,
      stageId: event.stageId,
      actionLabel: event.actionLabel,
      feedback: event.feedback,
      changes: event.changes.filter((change) => visible.has(change.variable)),
    })),
    completion:
      state.status === "completed" && state.outcome
        ? {
            outcome: state.outcome,
            summary: state.summary ?? config.debrief[state.outcome],
            debrief: config.debrief[state.outcome],
            rubric: config.rubric.map((item) => ({
              id: item.id,
              criterion: item.criterion,
              description: item.description,
            })),
          }
        : null,
  };
}
