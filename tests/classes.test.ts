import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASSIGNABLE, isJoinCode, newJoinCode, summariseRun } from "../src/lib/classes";
import { getProjectScenario } from "../src/lib/projects";
import { offlineEvaluator } from "../src/lib/projects/evaluate";
import { askClient, chooseAction, endInterview, startProject, submitBrief, submitRequirements } from "../src/lib/projects/runtime";
import { tidewaterSwimDraft } from "../src/lib/projects/tidewater-swim";

test("join codes are six unambiguous characters and match the table's check", () => {
  const check = readFileSync(new URL("../supabase/migrations/20261102090000_classes.sql", import.meta.url), "utf8").match(/join_code ~ '([^']+)'/)![1];
  const codes = new Set(Array.from({ length: 200 }, newJoinCode));
  assert.ok(codes.size > 190);
  for (const code of codes) assert.ok(isJoinCode(code) && new RegExp(check).test(code), code);
  assert.equal(isJoinCode("ABC1O0"), false);
  assert.equal(isJoinCode("abcdef"), false);
});

test("every built-in project can be assigned", () => {
  assert.deepEqual(ASSIGNABLE.map((project) => project.id), ["harbour-clinic", "tidewater-swim", "parcelpal", "ward-infection-audit"]);
});

test("a run shows the instructor where the student is, and which ideas they settled", async () => {
  const scenario = getProjectScenario("tidewater-swim")!;
  assert.deepEqual(summariseRun(scenario, null), { status: "not-started" });

  let state = startProject(scenario);
  // Opened but not played yet.
  assert.deepEqual(summariseRun(scenario, { state, status: "active", outcome: null, updated_at: "2026-11-02T10:00:00Z" }), { status: "not-started" });
  state = chooseAction(scenario, state, "pick-engineering").state;
  state = chooseAction(scenario, state, "call-grace").state;
  for (const fact of Object.values(tidewaterSwimDraft.facts)) state = (await askClient(scenario, state, fact.sampleQuestion, offlineEvaluator)).state;
  state = endInterview(scenario, state).state;
  state = (await submitRequirements(scenario, state, tidewaterSwimDraft.samples.requirements, offlineEvaluator)).state;
  // The brief covers the key but not the old tests, so Cody rewrites the pricing.
  state = (await submitBrief(scenario, state, `${tidewaterSwimDraft.constraints.rule.label}. ${tidewaterSwimDraft.constraints.scope.label}.`, offlineEvaluator)).state;

  const run = summariseRun(scenario, { state, status: "active", outcome: null, updated_at: "2026-11-02T10:00:00Z" });
  assert.ok(run.status === "active");
  assert.equal(run.stage, "Review Cody's work");
  assert.equal(run.track, "engineering");
  assert.equal(run.trust, 8);
  assert.deepEqual(run.concepts.map((concept) => [concept.name, concept.outcome]), [
    ["Regression testing", "shipped"],
    ["Keeping secrets out of code", "prevented"],
  ]);
});
