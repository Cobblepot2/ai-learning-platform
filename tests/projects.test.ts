import test from "node:test";
import assert from "node:assert/strict";
import {
  simulationConfigSchema,
  simulationProblems,
} from "../src/lib/learning/simulation/schema";
import { SimulationError, type SimulationHistory } from "../src/lib/learning/simulation/engine";
import { harbourClinic as scenario } from "../src/lib/projects/harbour-clinic";
import { cueHits, normalise, offlineEvaluator } from "../src/lib/projects/evaluate";
import {
  askClient,
  chooseAction,
  endInterview,
  pickVariant,
  projectView,
  requestChanges,
  sendBack,
  startProject,
  submitBrief,
  submitRequirements,
  memoOf,
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

// With the keyword grader the standard questions uncover four facts (F1, F2, F3, F6);
// these add the other two, for a thorough call.
const MORE_QUESTIONS = [
  "What do you do with the records when a booking is cancelled?",
  "What computer and browser does reception use?",
  "How long is each appointment slot?",
];

async function throughInterview(trackAction: "pick-product" | "pick-engineering", extra: string[] = []) {
  const history: SimulationHistory = [];
  let state = startProject(scenario);
  state = track(history, chooseAction(scenario, state, trackAction));
  state = track(history, chooseAction(scenario, state, "call-grace"));
  for (const question of [
    "Why do the double bookings happen, and when?",
    "What happens to an appointment when a patient cancels?",
    "Who will use it, and what's the budget?",
    "How will you know it's fixed? What would success look like?",
    ...extra,
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

test("a note that catches a concept's flaw is graded on what goes wrong and why", async () => {
  const run = await throughInterview("pick-product");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, "Build the staff booking board. Cancelling must keep the record.", offlineEvaluator));
  assert.equal(state.variables.variant, "race");

  // A wrong reason is never graded, whatever the note says.
  state = track(run.history, await sendBack(scenario, state, { reasonId: "styling", explanation: "A race condition: both save at the same time." }, offlineEvaluator));
  assert.equal(memoOf(state).reviews[0].explanation?.concept, undefined);

  const note = "Mandy and Kit can both save at the same moment, so both bookings go through. It's a race condition: the check runs before either save.";
  state = track(run.history, await sendBack(scenario, state, { reasonId: "double-booking", explanation: note }, offlineEvaluator));
  assert.equal(state.variables.variant, "good");
  assert.deepEqual(memoOf(state).reviews[1].explanation?.covered, ["what", "why"]);
  const [wrong, right] = projectView(scenario, state, run.history).work!.reviews;
  assert.equal(wrong.explained, undefined);
  assert.equal(right.explained?.rating, "strong");
  assert.match(right.explained?.feedback ?? "", /race conditions/);

  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-measure"));
  const [race, audit] = projectView(scenario, state, run.history).completion!.concepts;
  assert.equal(race.outcome, "caught");
  assert.equal(race.rating, "strong");
  assert.equal(race.note?.text, note);
  assert.match(race.note?.feedback ?? "", /that's race conditions/);
  // The brief said cancelling keeps the record, so the audit-trail mistake never happened.
  assert.equal(audit.outcome, "prevented");
});

test("the report says, for each concept, whether it was found, prevented, caught, left out or missed", async () => {
  // A brief with every constraint: both mistakes are prevented.
  let run = await throughInterview("pick-product");
  let state = track(run.history, await submitRequirements(scenario, run.state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, GOOD_BRIEF, offlineEvaluator));
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-measure"));
  let concepts = projectView(scenario, state, run.history).completion!.concepts;
  assert.deepEqual(concepts.map((item) => [item.found, item.outcome, item.rating]), [[true, "prevented", "strong"], [true, "prevented", "strong"]]);

  // A brief with neither: the audit-trail flaw comes first and is caught; the fix also
  // covers the race, which nothing ever tested.
  run = await throughInterview("pick-product");
  state = track(run.history, await submitRequirements(scenario, run.state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, "Build the staff booking board. No patient accounts.", offlineEvaluator));
  assert.equal(state.variables.variant, "delete-on-cancel");
  state = track(run.history, await sendBack(scenario, state, { reasonId: "cancel-deletes", explanation: "Cancelling deletes it." }, offlineEvaluator));
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-measure"));
  concepts = projectView(scenario, state, run.history).completion!.concepts;
  assert.deepEqual(concepts.map((item) => item.outcome), ["left-out", "caught"]);
  assert.equal(concepts[1].rating, "mixed");

  // Approving the race version ships the mistake.
  run = await throughInterview("pick-product");
  state = track(run.history, await submitRequirements(scenario, run.state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, "Build the staff booking board. Cancelling must keep the record.", offlineEvaluator));
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-now"));
  concepts = projectView(scenario, state, run.history).completion!.concepts;
  assert.deepEqual(concepts.map((item) => [item.outcome, item.rating]), [["shipped", "weak"], ["prevented", "strong"]]);
});

test("a note that only says what to change gets pointed to the report", async () => {
  const run = await throughInterview("pick-product");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, "Build the staff booking board. Cancelling must keep the record.", offlineEvaluator));
  await assert.rejects(sendBack(scenario, state, { reasonId: "double-booking", explanation: "x".repeat(1001) }, offlineEvaluator), SimulationError);
  state = track(run.history, await sendBack(scenario, state, { reasonId: "double-booking", explanation: "Please fix the booking logic." }, offlineEvaluator));
  const review = projectView(scenario, state, run.history).work!.reviews[0];
  assert.equal(review.explained?.rating, "weak");
  assert.match(review.explained?.feedback ?? "", /the report explains it/);
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

test("a thorough call, a success measure, a measured release and success take trust to 10", async () => {
  const run = await throughInterview("pick-engineering", MORE_QUESTIONS);
  let state = run.state;
  assert.equal(memoOf(state).interview.revealed.length, 6);
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, GOOD_BRIEF, offlineEvaluator));
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-measure"));
  assert.equal(state.outcome, "success");
  assert.equal(state.variables.trust, 10);

  const trust = projectView(scenario, state, run.history).completion?.trust;
  assert.equal(trust?.start, 5);
  assert.deepEqual(
    trust?.changes.map((change) => change.delta),
    [1, 1, 1, 1, 1],
  );
  assert.deepEqual(trust?.changes.map((change) => change.reason), [
    scenario.trust.reasons["call-grace"],
    scenario.trust.reasons["end-interview-thorough"],
    scenario.trust.reasons["requirements-metric"],
    scenario.trust.reasons["release-measure"],
    scenario.trust.outcome.success?.reason,
  ]);
  // The outcome's change is applied once, even if the view is built again.
  assert.equal(projectView(scenario, state, run.history).completion?.trust.changes.length, 5);
});

test("a short cue matches whole words, so \"app\" is not found in \"appointment\"", () => {
  assert.equal(cueHits(normalise("When a patient cancels an appointment"), ["app"]), 0);
  assert.equal(cueHits(normalise("Is there an app? Which apps do you use?"), ["app"]), 1);
  assert.equal(cueHits(normalise("The charge nurse logged it in the night log."), ["log"]), 1);
  assert.equal(cueHits(normalise("Everything was logged"), ["log"]), 1);
  assert.equal(cueHits(normalise("A cancelled booking"), ["cancel"]), 1);
});

test("a short call earns no trust bonus", async () => {
  const run = await throughInterview("pick-engineering");
  assert.equal(memoOf(run.state).interview.revealed.length, 4);
  assert.equal(run.state.variables.trust, 6);
  assert.equal(run.history.at(-1)?.actionId, "end-interview");
});

test("switching everyone over at once costs trust, and a partial result adds nothing", async () => {
  const run = await throughInterview("pick-engineering", MORE_QUESTIONS);
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(run.history, await submitBrief(scenario, state, GOOD_BRIEF, offlineEvaluator));
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-now"));
  assert.equal(state.outcome, "partial");
  // 5 + call + thorough + measure - release now
  assert.equal(state.variables.trust, 7);
  assert.equal(memoOf(state).outcomeTrust, undefined);
});

test("a release that goes wrong loses two more points of trust", async () => {
  const run = await throughInterview("pick-engineering");
  let state = run.state;
  state = track(run.history, await submitRequirements(scenario, state, GOOD_REQUIREMENTS, offlineEvaluator));
  state = track(
    run.history,
    await submitBrief(scenario, state, "Build a staff-only booking board. Cancelling marks it cancelled, never delete. No patient app.", offlineEvaluator),
  );
  assert.equal(state.variables.variant, "race");
  state = track(run.history, chooseAction(scenario, state, "approve"));
  state = track(run.history, chooseAction(scenario, state, "release-now"));
  assert.equal(state.outcome, "failure");
  // 5 + call + measure - release now - failure
  assert.equal(state.variables.trust, 4);
  const changes = projectView(scenario, state, run.history).completion?.trust.changes ?? [];
  assert.deepEqual(changes.at(-1), { delta: -2, reason: scenario.trust.outcome.failure?.reason });
});
