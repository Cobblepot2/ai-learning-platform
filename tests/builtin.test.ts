import test from "node:test";
import assert from "node:assert/strict";
import { offlineEvaluator } from "../src/lib/projects/evaluate";
import { buildScenario } from "../src/lib/projects/generated/build";
import { projectDraftSchema } from "../src/lib/projects/generated/draft";
import { checkProject } from "../src/lib/projects/generated/validate";
import { askClient, chooseAction, endInterview, projectView, requestChanges, sendBack, startProject, submitBrief, submitRequirements, type ProjectStep } from "../src/lib/projects/runtime";
import { getProjectScenario } from "../src/lib/projects";
import { projectListings } from "../src/lib/projects/catalog";
import { parcelPalDraft } from "../src/lib/projects/parcelpal";
import { tidewaterSwimDraft } from "../src/lib/projects/tidewater-swim";
import { wardInfectionAuditDraft } from "../src/lib/projects/ward-infection-audit";

// Built-in projects written as drafts: they must pass the same checks as generated ones.
// The software projects have both roles; the others, the product lead only.
const drafts = { "tidewater-swim": tidewaterSwimDraft, parcelpal: parcelPalDraft, "ward-infection-audit": wardInfectionAuditDraft };
const productOnly = new Set(["ward-infection-audit"]);

for (const [id, draft] of Object.entries(drafts)) {
  const tracks = productOnly.has(id) ? (["product"] as const) : (["product", "engineering"] as const);
  test(`${id} passes every check and teaches its two concepts`, async () => {
    const parsed = projectDraftSchema.parse(draft);
    const check = await checkProject(buildScenario(parsed, { id }), parsed, { requireConcepts: true });
    assert.deepEqual(check.problems, []);
    assert.ok(getProjectScenario(id), "registered as a built-in project");
    assert.ok(projectListings.some((listing) => listing.id === id && listing.title === draft.title), "listed on the projects page");
  });

  // Both roles, like Harbour Clinic: the product lead reviews behaviour, the tech lead the code.
  async function reachReview(track: "product" | "engineering", brief: string) {
    const scenario = getProjectScenario(id)!;
    const take = (step: ProjectStep) => step.state;
    let state = startProject(scenario);
    state = take(chooseAction(scenario, state, track === "product" ? "pick-product" : "pick-engineering"));
    state = take(chooseAction(scenario, state, "call-grace"));
    for (const fact of Object.values(draft.facts)) {
      state = (await askClient(scenario, state, fact.sampleQuestion, offlineEvaluator)).state;
    }
    state = take(endInterview(scenario, state));
    state = take(await submitRequirements(scenario, state, draft.samples.requirements, offlineEvaluator));
    state = take(await submitBrief(scenario, state, brief, offlineEvaluator));
    return { scenario, state };
  }

  for (const track of tracks) {
    test(`${id} plays through to a 10/10 success as the ${track} lead`, async () => {
      const { scenario, state: review } = await reachReview(track, `${draft.samples.brief} Add a test.`);
      const work = projectView(scenario, review, []).work!;
      assert.equal(work.files.length > 0, track === "engineering");
      assert.equal(work.demo.length > 0, track === "product");
      let state = chooseAction(scenario, review, "approve").state;
      state = chooseAction(scenario, state, "release-measure").state;
      assert.equal(state.outcome, "success");
      assert.equal(state.variables.trust, 10);
    });
  }

  test(`${id} offers ${productOnly.has(id) ? "only the product lead role" : "both roles"}`, () => {
    const actions = getProjectScenario(id)!.config.stages.find((stage) => stage.id === "choose-track")!.actions.map((action) => action.id);
    assert.deepEqual(actions, productOnly.has(id) ? ["pick-product"] : ["pick-product", "pick-engineering"]);
  });

  if (productOnly.has(id)) continue;

  test(`${id}'s pull requests point at real lines, and the right line gets the fix`, async () => {
    const scenario = getProjectScenario(id)!;
    for (const variant of scenario.variants) {
      assert.equal(variant.problemLines.length === 0, variant.id === "good", variant.id);
      for (const { path, line } of variant.problemLines) {
        const file = variant.files.find((item) => item.path === path);
        assert.ok(file && line >= 1 && line <= file.lines.length && file.lines[line - 1].trim(), `${variant.id} ${path}:${line}`);
      }
    }
    // A brief without the problem constraint gets the problem version; its flagged line sends it back.
    const { state } = await reachReview("engineering", `${draft.constraints.rule.label}. ${draft.constraints.scope.label}.`);
    assert.equal(state.variables.variant, "misses-problem");
    const flawed = scenario.variants.find((item) => item.id === "misses-problem")!;
    const fixed = await sendBack(scenario, state, { ...flawed.problemLines[0], explanation: draft.concepts!.problem.explanation }, offlineEvaluator);
    assert.equal(fixed.state.variables.variant, "good");
    assert.equal(projectView(scenario, fixed.state, []).work?.reviews[0].correct, true);
    // Once fixed there is nothing left to send back for: only approving remains.
    assert.throws(() => requestChanges(scenario, fixed.state, flawed.problemLines[0]), /already fixed/);
  });
}
