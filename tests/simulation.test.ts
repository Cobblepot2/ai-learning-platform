import test from "node:test";
import assert from "node:assert/strict";
import {
  simulationConfigSchema,
  simulationProblems,
  type SimulationConfig,
} from "../src/lib/learning/simulation/schema";
import {
  applySimulationAction,
  availableActions,
  simulationView,
  startSimulation,
  SimulationError,
} from "../src/lib/learning/simulation/engine";
import {
  deterministicSimulationFeedback,
  outcomeScore,
  simulationFeedback,
} from "../src/lib/learning/simulation/evaluate";
import {
  activityForTutor,
  completionThreshold,
  validateActivity,
} from "../src/lib/learning/registry";
import { seEssentials } from "../src/content/courses/se-essentials";
import { presentationDemos } from "../src/content/courses/presentation-demos";
import { simulationApiError } from "../src/lib/learning/simulation/http";
import {
  isLearnerSimulation,
  redactCourseSimulations,
} from "../src/lib/learning/simulation/public";

const literal = {
  schemaVersion: 1 as const,
  title: "Test scenario",
  scenario: {
    description: "A test scenario description.",
    objectives: ["Make a balanced decision"],
    initialSituation: "You must choose what to do first.",
    participantRole: "You are the decision maker.",
    persona: "A cautious stakeholder.",
  },
  variables: [
    {
      id: "score",
      type: "number" as const,
      label: "Score",
      initial: 2,
      min: 0,
      max: 5,
      visible: true,
    },
    {
      id: "flag",
      type: "boolean" as const,
      label: "Flag",
      initial: false,
      visible: true,
    },
    {
      id: "mood",
      type: "enum" as const,
      label: "Mood",
      initial: "calm",
      options: ["calm", "tense"],
      visible: true,
    },
    {
      id: "secret",
      type: "number" as const,
      label: "Secret",
      initial: 1,
      min: 0,
      max: 3,
      visible: false,
    },
  ],
  startStage: "start",
  stages: [
    {
      id: "start",
      title: "Start",
      narrative: "The first decision.",
      actions: [
        {
          id: "improve",
          label: "Improve",
          effects: [
            { op: "add" as const, variable: "score", value: 2 },
            { op: "set" as const, variable: "mood", value: "tense" },
          ],
          feedback: "Improved.",
          nextStage: "check",
        },
        {
          id: "skip",
          label: "Skip",
          effects: [{ op: "add" as const, variable: "score", value: -1 }],
          feedback: "Skipped.",
          nextStage: "check",
        },
      ],
    },
    {
      id: "check",
      title: "Check",
      narrative: "The result is checked.",
      actions: [
        {
          id: "win",
          label: "Win",
          availableWhen: {
            kind: "compare" as const,
            variable: "score",
            op: "gte" as const,
            value: 4,
          },
          effects: [{ op: "set" as const, variable: "flag", value: true }],
          feedback: "Won.",
          nextStage: "success",
        },
        {
          id: "lose",
          label: "Lose",
          availableWhen: {
            kind: "compare" as const,
            variable: "score",
            op: "lt" as const,
            value: 4,
          },
          effects: [{ op: "add" as const, variable: "score", value: 1 }],
          feedback: "Lost.",
          nextStage: "fail",
        },
      ],
    },
    {
      id: "success",
      title: "Success",
      narrative: "A good ending.",
      actions: [],
      ending: { outcome: "success" as const, summary: "Good." },
    },
    {
      id: "fail",
      title: "Failure",
      narrative: "A bad ending.",
      actions: [],
      ending: { outcome: "failure" as const, summary: "Bad." },
    },
  ],
  completion: {
    maxSteps: 5,
    rules: [],
    exhaustedSummary: "Out of time.",
  },
  rubric: [
    { id: "r1", criterion: "Decision quality" },
    { id: "r2", criterion: "Outcome" },
  ],
  debrief: {
    success: "Success debrief.",
    partial: "Partial debrief.",
    failure: "Failure debrief.",
    incomplete: "Incomplete debrief.",
  },
};

function make(): SimulationConfig {
  return simulationConfigSchema.parse(structuredClone(literal));
}

function broken(mutate: (config: SimulationConfig) => void): SimulationConfig {
  const config = make();
  mutate(config);
  return config;
}

function activity(config: SimulationConfig) {
  return {
    type: "activity" as const,
    id: "simulation-1",
    version: 1 as const,
    activityType: "simulation" as const,
    config,
  };
}

test("a complete simulation passes schema, cross-field and registry validation", () => {
  const config = make();
  assert.deepEqual(simulationProblems(config), []);
  const checked = validateActivity(activity(config));
  assert.equal(checked.success, true);
  if (checked.success) {
    assert.equal(completionThreshold(checked.data), 1);
    const tutor = activityForTutor(checked.data);
    const text = JSON.stringify(tutor);
    assert.match(text, /A test scenario description/);
    assert.doesNotMatch(text, /nextStage|effects|availableWhen|score/);
  }
});

test("invalid references, ranges and endings are rejected with useful messages", () => {
  const cases: { name: string; config: SimulationConfig; match: RegExp }[] = [
    {
      name: "unknown effect variable",
      config: broken((c) => {
        c.stages[0].actions[0].effects[0].variable = "ghost";
      }),
      match: /unknown state variable/,
    },
    {
      name: "unknown next stage",
      config: broken((c) => {
        c.stages[0].actions[0].nextStage = "ghost";
      }),
      match: /does not exist/,
    },
    {
      name: "duplicate variable ids",
      config: broken((c) => {
        c.variables[1].id = "score";
      }),
      match: /Duplicate state variable/,
    },
    {
      name: "numeric range",
      config: broken((c) => {
        if (c.variables[0].type === "number") {
          c.variables[0].min = 9;
          c.variables[0].max = 1;
        }
      }),
      match: /min greater than max/,
    },
    {
      name: "initial outside range",
      config: broken((c) => {
        if (c.variables[0].type === "number") c.variables[0].initial = 99;
      }),
      match: /starts outside/,
    },
    {
      name: "ordering comparison on enum",
      config: broken((c) => {
        const condition = c.stages[1].actions[0].availableWhen;
        if (condition?.kind === "compare") {
          condition.variable = "mood";
          condition.op = "gt";
        }
      }),
      match: /wrong type or an unknown option/,
    },
    {
      name: "action that does nothing",
      config: broken((c) => {
        c.stages[0].actions[0].effects = [];
        c.stages[0].actions[0].nextStage = "start";
      }),
      match: /does not change state or move/,
    },
    {
      name: "ending with actions",
      config: broken((c) => {
        c.stages[2].actions.push({
          id: "extra",
          label: "Extra",
          effects: [{ op: "add", variable: "score", value: 1 }],
          feedback: "Extra.",
        });
      }),
      match: /cannot also have actions/,
    },
    {
      name: "unreachable stage",
      config: broken((c) => {
        c.stages.push({
          id: "orphan",
          title: "Orphan",
          narrative: "Never reached.",
          actions: [],
          ending: { outcome: "partial", summary: "Orphan." },
        });
      }),
      match: /cannot be reached/,
    },
    {
      name: "no initial action",
      config: broken((c) => {
        for (const action of c.stages[0].actions) {
          action.availableWhen = {
            kind: "compare",
            variable: "score",
            op: "gt",
            value: 99,
          };
        }
      }),
      match: /No action is available in the start stage/,
    },
    {
      name: "no success path",
      config: broken((c) => {
        c.stages[2].ending = { outcome: "failure", summary: "Bad." };
        c.stages[3].ending = { outcome: "partial", summary: "Meh." };
      }),
      match: /needs a success/,
    },
  ];
  for (const item of cases) {
    const problems = simulationProblems(item.config);
    assert.ok(
      problems.some((problem) => item.match.test(problem)),
      `${item.name}: expected ${item.match}, got ${problems.join(" | ")}`,
    );
    assert.equal(validateActivity(activity(item.config)).success, false);
  }
});

test("unsupported operators and unknown activity types never validate", () => {
  const badOperator = {
    ...activity(make()),
    config: {
      ...make(),
      stages: make().stages.map((stage) => ({
        ...stage,
        actions: stage.actions.map((action) => ({
          ...action,
          availableWhen: {
            kind: "compare",
            variable: "score",
            op: "contains",
            value: 2,
          },
        })),
      })),
    },
  };
  assert.equal(validateActivity(badOperator).success, false);
  assert.equal(
    validateActivity({ ...activity(make()), activityType: "script" }).success,
    false,
  );
  assert.equal(
    validateActivity({ ...activity(make()), activityType: "eval" }).success,
    false,
  );
});

test("the engine applies effects, gates actions and reaches different endings", () => {
  const config = make();
  const start = startSimulation(config);
  assert.deepEqual(start.variables, {
    score: 2,
    flag: false,
    mood: "calm",
    secret: 1,
  });
  assert.deepEqual(
    availableActions(config, start).map((action) => action.id),
    ["improve", "skip"],
  );

  const improved = applySimulationAction(config, start, "improve");
  assert.equal(improved.state.stageId, "check");
  assert.equal(improved.state.step, 1);
  assert.equal(improved.state.variables.score, 4);
  assert.equal(improved.state.variables.mood, "tense");
  assert.deepEqual(
    availableActions(config, improved.state).map((action) => action.id),
    ["win"],
  );
  const won = applySimulationAction(config, improved.state, "win");
  assert.equal(won.state.status, "completed");
  assert.equal(won.state.outcome, "success");
  assert.equal(won.state.summary, "Good.");
  assert.equal(won.state.variables.flag, true);

  const skipped = applySimulationAction(config, start, "skip");
  assert.equal(skipped.state.variables.score, 1);
  assert.deepEqual(
    availableActions(config, skipped.state).map((action) => action.id),
    ["lose"],
  );
  const lost = applySimulationAction(config, skipped.state, "lose");
  assert.equal(lost.state.outcome, "failure");
  assert.equal(lost.state.summary, "Bad.");
});

test("forged, unknown and repeated actions are rejected by the engine", () => {
  const config = make();
  const start = startSimulation(config);
  assert.throws(
    () => applySimulationAction(config, start, "win"),
    (error: unknown) =>
      error instanceof SimulationError && /not part of this stage/.test(error.message),
  );
  const guarded = make();
  guarded.stages[0].actions.push({
    id: "guarded",
    label: "Guarded",
    availableWhen: {
      kind: "compare",
      variable: "score",
      op: "gt",
      value: 99,
    },
    effects: [{ op: "add", variable: "score", value: 1 }],
    feedback: "Guarded.",
  });
  assert.throws(
    () => applySimulationAction(guarded, startSimulation(guarded), "guarded"),
    (error: unknown) =>
      error instanceof SimulationError && /not available right now/.test(error.message),
  );
  assert.throws(
    () => applySimulationAction(config, start, "invented-action"),
    (error: unknown) =>
      error instanceof SimulationError && /not part of this stage/.test(error.message),
  );
  const improved = applySimulationAction(config, start, "improve").state;
  const won = applySimulationAction(config, improved, "win").state;
  assert.throws(
    () => applySimulationAction(config, won, "win"),
    /already complete/,
  );
});

test("numeric effects are clamped and completion rules win over the step limit", () => {
  const clamping = make();
  clamping.stages[0].actions[0].effects = [
    { op: "add", variable: "score", value: 20 },
  ];
  const clamped = applySimulationAction(
    clamping,
    startSimulation(clamping),
    "improve",
  );
  assert.equal(clamped.state.variables.score, 5);

  const ruled = make();
  ruled.stages[0].actions[0].nextStage = "start";
  ruled.completion.rules = [
    {
      outcome: "partial",
      when: { kind: "compare", variable: "score", op: "gte", value: 4 },
      summary: "The rule ended the run.",
    },
  ];
  ruled.stages[0].actions = ruled.stages[0].actions.slice(0, 1);
  ruled.stages[1].actions[0].availableWhen = undefined;
  const start = startSimulation(ruled);
  // The start action from the literal moves to check with a score of 4, so the
  // rule fires before the ending stage.
  const next = applySimulationAction(ruled, start, "improve");
  assert.equal(next.state.status, "completed");
  assert.equal(next.state.outcome, "partial");
  assert.equal(next.state.summary, "The rule ended the run.");
});

test("the step limit and a dead end complete as incomplete", () => {
  const limited = make();
  limited.completion.maxSteps = 3;
  limited.stages[0].actions.push({
    id: "wait",
    label: "Wait",
    effects: [{ op: "add", variable: "score", value: 1 }],
    feedback: "Waited.",
  });
  let state = startSimulation(limited);
  for (let step = 0; step < 3; step += 1) {
    state = applySimulationAction(limited, state, "wait").state;
  }
  assert.equal(state.status, "completed");
  assert.equal(state.outcome, "incomplete");
  assert.equal(state.summary, "Out of time.");

  const trapped = make();
  trapped.stages.push({
    id: "trap",
    title: "Trap",
    narrative: "There is no way out.",
    actions: [
      {
        id: "escape",
        label: "Escape",
        availableWhen: {
          kind: "compare",
          variable: "score",
          op: "gt",
          value: 99,
        },
        effects: [{ op: "add", variable: "score", value: 1 }],
        feedback: "Escaped.",
      },
    ],
  });
  trapped.stages[0].actions.push({
    id: "enter",
    label: "Enter the trap",
    effects: [{ op: "add", variable: "score", value: 1 }],
    feedback: "Entered.",
    nextStage: "trap",
  });
  const dead = applySimulationAction(
    trapped,
    startSimulation(trapped),
    "enter",
  ).state;
  assert.equal(dead.status, "completed");
  assert.equal(dead.outcome, "incomplete");
});

test("the student projection hides rules, effects and invisible variables", () => {
  const config = make();
  const start = startSimulation(config);
  const result = applySimulationAction(config, start, "improve");
  const view = simulationView(config, result.state, [result.event]);
  assert.equal(view.stage.id, "check");
  assert.deepEqual(
    view.actions.map((action) => action.id),
    ["win"],
  );
  assert.equal(view.variables.some((variable) => variable.id === "secret"), false);
  const json = JSON.stringify(view);
  assert.doesNotMatch(json, /availableWhen|effects|nextStage|secret/);
  assert.equal(view.history.length, 1);
  assert.equal(view.history[0].actionLabel, "Improve");
  assert.equal(view.completion, null);
});

test("deterministic feedback does not depend on Gemini, and the AI path falls back", async () => {
  const config = make();
  const start = startSimulation(config);
  const result = applySimulationAction(config, start, "improve");
  const finished = applySimulationAction(config, result.state, "win");
  const history = [result.event, finished.event];
  const feedback = deterministicSimulationFeedback(
    config,
    finished.state,
    history,
  );
  assert.equal(feedback.summary, "Good.");
  assert.equal(feedback.criteria.length, config.rubric.length);
  assert.ok(feedback.criteria.every((item) => item.assessment === "met"));
  assert.match(feedback.criteria[0].evidence, /1\. Improve → 2\. Win/);

  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.deepEqual(
      await simulationFeedback(config, finished.state, history),
      feedback,
    );
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
  assert.equal(outcomeScore("success"), 1);
  assert.equal(outcomeScore("partial"), 0.5);
  assert.equal(outcomeScore("failure"), null);
});

test("the software-engineering and business demos share one valid schema", () => {
  const blocks = [
    ...seEssentials.lessons.flatMap((lesson) => lesson.blocks),
    ...presentationDemos.flatMap((course) =>
      course.lessons.flatMap((lesson) => lesson.blocks),
    ),
  ].filter((block) => block.type === "activity" && block.activityType === "simulation");
  assert.ok(blocks.length >= 2);
  const domains = new Set<string>();
  for (const block of blocks) {
    const checked = validateActivity(block);
    assert.equal(checked.success, true);
    if (checked.success && checked.data.activityType === "simulation") {
      assert.deepEqual(simulationProblems(checked.data.config), []);
      const start = startSimulation(checked.data.config);
      assert.ok(availableActions(checked.data.config, start).length > 0);
      if (checked.data.config.scenario.description.includes("clinic")) {
        domains.add("software-engineering");
      } else {
        domains.add("business");
      }
    }
  }
  assert.equal(domains.size, 2);
});

test("database lesson payloads omit simulation rules and endings", () => {
  const source = seEssentials.lessons
    .flatMap((lesson) => lesson.blocks)
    .map((block) => validateActivity(block))
    .find((parsed) => parsed.success && parsed.data.activityType === "simulation");
  assert.ok(source?.success && source.data.activityType === "simulation");
  if (!source?.success || source.data.activityType !== "simulation") return;
  const redacted = redactCourseSimulations(seEssentials);
  const block = redacted.lessons
    .flatMap((lesson) => lesson.blocks)
    .find((item) => item.id === source.data.id);
  assert.equal(isLearnerSimulation(block), true);
  if (!isLearnerSimulation(block)) return;
  assert.equal(block.config.title, source.data.config.title);
  assert.equal(block.config.completion.maxSteps, source.data.config.completion.maxSteps);
  assert.deepEqual(block.config.scenario, source.data.config.scenario);
  const payload = JSON.stringify(block);
  assert.equal(payload.includes("success-ending"), false);
  assert.equal(payload.includes("shared-view"), false);
  assert.equal(payload.includes("\"stages\""), false);
  assert.equal(payload.includes("\"variables\""), false);
  assert.equal(validateActivity(block).success, false);
  assert.equal(
    JSON.stringify(seEssentials).includes("success-ending"),
    true,
  );
});

test("simulation engine errors keep their status", async () => {
  const stale = simulationApiError(
    new SimulationError("That choice is not part of this stage.", 409),
  );
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), {
    error: "That choice is not part of this stage.",
  });
  const generic = simulationApiError(new Error("database password"));
  assert.equal(generic.status, 500);
  const body = await generic.json();
  assert.equal(body.error, "Request failed.");
  assert.equal(JSON.stringify(body).includes("password"), false);
});
