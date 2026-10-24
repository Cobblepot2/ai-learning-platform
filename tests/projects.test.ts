import test from "node:test";
import assert from "node:assert/strict";
import {
  simulationConfigSchema,
  simulationProblems,
} from "../src/lib/learning/simulation/schema";
import { SimulationError, type SimulationHistory } from "../src/lib/learning/simulation/engine";
import { harbourClinic as scenario } from "../src/lib/projects/harbour-clinic";
import { offlineEvaluator } from "../src/lib/projects/evaluate";
import {
  askClient,
  chooseAction,
  endInterview,
  pickVariant,
  projectView,
  requestChanges,
  startProject,
  submitBrief,
  submitRequirements,
  type ProjectStep,
} from "../src/lib/projects/runtime";

const GOOD_REQUIREMENTS =
  "The same doctor and slot must never be booked twice, even if Mandy and Kit save at the same time. " +
  "Cancelling must keep the appointment on record with a cancelled status (7 years of history). " +
  "Staff-only tool for reception, no patient app. Works in Chrome on the existing PC. " +
  "Success: fewer than one double booking per week.";

const GOOD_BRIEF =
  "Build a staff-only booking board. Reject a booking when the slot is already taken at the moment it is saved, " +
  "so two receptionists saving at the same time can't both succeed (use a unique constraint). " +
  "Cancelling must mark the appointment as cancelled; do not delete anything. " +
  "Only the booking board: no patient accounts, reminders or payments. Add a test for two simultaneous bookings.";

function track(history: SimulationHistory, step: ProjectStep) {
  history.push(...step.events);
  return step.state;
}

async function throughInterview(trackAction: "pick-product" | "pick-engineering") {
  const history: SimulationHistory = [];
  let state = startProject(scenario);
  state = track(history, chooseAction(scenario, state, trackAction));
  state = track(history, chooseAction(scenario, state, "call-grace"));
  for (const question of [
    "Why do the double bookings happen, and when?",
    "What happens to an appointment when a patient cancels?",
    "Who will use it, and what's the budget?",
    "How will you know it's fixed? What would success look like?",
  ]) {
    state = (await askClient(scenario, state, question, offlineEvaluator)).state;
  }
  state = track(history, endInterview(scenario, state));
  return { state, history };
}

test("the scenario config is valid and only allowed to use system actions as a project", () => {
  const parsed = simulationConfigSchema.safeParse(scenario.config);
  assert.equal(parsed.success, true);
  assert.deepEqual(simulationProblems(scenario.config, { allowSystemActions: true }), []);
  assert.ok(
    simulationProblems(scenario.config).some((problem) => problem.includes("system action")),
    "lesson simulations must reject system actions",
  );
});

test("a learner request cannot trigger a system action", () => {
  const state = chooseAction(scenario, startProject(scenario), "pick-engineering").state;
  const atInterview = chooseAction(scenario, state, "call-grace").state;
  assert.throws(() => chooseAction(scenario, atInterview, "end-interview"), SimulationError);
});

test("the offline client reveals the matching fact and nothing else", async () => {
  let state = startProject(scenario);
  state = chooseAction(scenario, state, "pick-product").state;
  state = chooseAction(scenario, state, "call-grace").state;
  const answer = await askClient(scenario, state, "Why do the double bookings happen?", offlineEvaluator);
  assert.deepEqual(answer.revealed, ["F1"]);
  const vague = await askClient(scenario, answer.state, "Nice weather today?", offlineEvaluator);
  assert.deepEqual(vague.revealed, []);
});

test("the call needs a minimum number of questions", async () => {
  let state = startProject(scenario);
  state = chooseAction(scenario, state, "pick-product").state;
  state = chooseAction(scenario, state, "call-grace").state;
  state = (await askClient(scenario, state, "Why does it go wrong?", offlineEvaluator)).state;
  assert.throws(() => endInterview(scenario, state), /Ask at least 2 more questions/);
});

test("the variant follows the first missing constraint", () => {
  assert.equal(pickVariant(scenario, ["C1", "C2", "C3"]).variant, "good");
  assert.equal(pickVariant(scenario, ["C1", "C3"]).variant, "delete-on-cancel");
  assert.equal(pickVariant(scenario, ["C2", "C3"]).variant, "race");
  assert.equal(pickVariant(scenario, ["C1", "C2"]).variant, "scope-creep");
  assert.equal(pickVariant(scenario, []).variant, "delete-on-cancel");
});

test("a precise brief, a measure and a measured release succeed", async () => {
  const run = await throughInterview("pick-engineering");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  assert.equal(state.variables.hasMetric, true);
  state = track(run.history, await submitBrief(scenario, state, GOOD_BRIEF, offlineEvaluator));
  assert.equal(state.variables.variant, "good");
  assert.equal(state.variables.hasTest, true);
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-measure"));
  assert.equal(state.status, "completed");
  assert.equal(state.outcome, "success");
  const view = projectView(scenario, state, run.history);
  assert.equal(view.completion?.cards.length, 4);
  assert.equal(view.completion?.cards.find((card) => card.competency === "discernment")?.rating, "strong");
});

test("a brief without the save-time rule delivers the race version, and approving it fails", async () => {
  const run = await throughInterview("pick-engineering");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(
    run.history,
    await submitBrief(
      scenario,
      state,
      "Build a staff-only booking board that shows taken slots. Cancelling must mark the appointment as cancelled; do not delete. No patient accounts.",
      offlineEvaluator,
    ),
  );
  assert.equal(state.variables.variant, "race");
  assert.equal(state.variables.hasTest, false);
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-now"));
  assert.equal(state.outcome, "failure");
  assert.match(state.summary ?? "", /both bookings go through/);
});

test("pointing at the right line fixes the work; the wrong line costs a day", async () => {
  const run = await throughInterview("pick-engineering");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(
    run.history,
    await submitBrief(scenario, state, "Build the staff booking board. Reject taken slots when saving. No patient accounts.", offlineEvaluator),
  );
  assert.equal(state.variables.variant, "delete-on-cancel");
  const before = Number(state.variables.effort);
  state = track(run.history, requestChanges(scenario, state, { path: "src/booking.ts", line: 4 }));
  assert.equal(state.variables.variant, "delete-on-cancel");
  assert.equal(Number(state.variables.effort), before + 1);
  state = track(run.history, requestChanges(scenario, state, { path: "src/booking.ts", line: 18 }));
  assert.equal(state.variables.variant, "good");
});

test("a pilot catches the deleted records before they reach the whole clinic", async () => {
  const run = await throughInterview("pick-product");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, "Stop double bookings.", offlineEvaluator));
  assert.equal(state.variables.hasMetric, false);
  state = track(run.history, await submitBrief(scenario, state, "Stop double bookings when saving.", offlineEvaluator));
  assert.equal(state.variables.variant, "delete-on-cancel");
  const view = projectView(scenario, state, run.history);
  assert.ok(!view.actions.some((action) => action.id === "release-measure"));
  state = track(run.history, chooseAction(scenario, state, "approve"));
  assert.ok(
    !projectView(scenario, state, run.history).actions.some((action) => action.id === "release-measure"),
    "no success measure means no measured release",
  );
  state = track(run.history, chooseAction(scenario, state, "release-pilot"));
  assert.equal(state.outcome, "partial");
});

test("the product track sends work back by reason", async () => {
  const run = await throughInterview("pick-product");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, "Build the staff booking board. Cancelling must keep the record.", offlineEvaluator));
  assert.equal(state.variables.variant, "race");
  state = track(run.history, requestChanges(scenario, state, { reasonId: "styling" }));
  assert.equal(state.variables.variant, "race");
  state = track(run.history, requestChanges(scenario, state, { reasonId: "double-booking" }));
  assert.equal(state.variables.variant, "good");
});

test("the learner view never exposes variants, checklists or hidden facts before the end", async () => {
  const run = await throughInterview("pick-engineering");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, "Stop double bookings.", offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, "Stop double bookings.", offlineEvaluator));
  const json = JSON.stringify(projectView(scenario, state, run.history));
  for (const secret of ["delete-on-cancel", "problemLines", "problemReason", "cues", "\"C1\"", "\"R2\"", "brief-delete"]) {
    assert.ok(!json.includes(secret), `view leaked ${secret}`);
  }
  // Only facts the learner actually uncovered appear in their notes.
  const view = projectView(scenario, state, run.history);
  assert.ok(!view.notes.some((note) => note.includes("Dr Chan")));
});
